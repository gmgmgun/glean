const { YoutubeTranscript } = require('youtube-transcript');

const MAX_CONTENT_LEN = 15000;

async function fetchPage(url) {
  const ytId = extractYouTubeId(url);
  if (ytId) return fetchYouTube(ytId);
  return fetchHtml(url);
}

// YouTube ID 추출. 다음 형식 지원:
//   youtube.com/watch?v=ID  (mobile/www 포함)
//   youtu.be/ID
//   youtube.com/shorts/ID  (shorts)
//   youtube.com/embed/ID, /v/ID  (임베드)
function extractYouTubeId(input) {
  try {
    const u = new URL(input);
    const host = u.hostname.toLowerCase();
    if (host === 'youtu.be') {
      const id = u.pathname.slice(1).split('/')[0];
      return isValidId(id) ? id : null;
    }
    if (/(^|\.)youtube\.com$/.test(host)) {
      if (u.pathname === '/watch') {
        const id = u.searchParams.get('v');
        return isValidId(id) ? id : null;
      }
      const m = u.pathname.match(/^\/(shorts|embed|v)\/([^/?#]+)/);
      if (m && isValidId(m[2])) return m[2];
    }
  } catch {
    // not a valid URL
  }
  return null;
}

function isValidId(id) {
  // YouTube videoId: 11자, 영숫자/_/-
  return typeof id === 'string' && /^[A-Za-z0-9_-]{11}$/.test(id);
}

async function fetchYouTube(videoId) {
  const title = await fetchYouTubeTitle(videoId);

  // 자막 우선순위: ko → en → 기본(언어 미지정 — 라이브러리가 첫 번째 반환)
  let segments = null;
  let lastErr = null;
  for (const opts of [{ lang: 'ko' }, { lang: 'en' }, undefined]) {
    try {
      segments = await YoutubeTranscript.fetchTranscript(videoId, opts);
      if (segments && segments.length) break;
    } catch (err) {
      lastErr = err;
    }
  }

  if (!segments || !segments.length) {
    throw new Error(
      `YouTube 자막 추출 실패. 자막 없거나 비공개/연령제한 영상일 수 있음.${lastErr ? ` (${lastErr.message})` : ''}`
    );
  }

  const raw = segments.map((s) => s.text || '').join(' ');
  const content = decodeEntities(raw).replace(/\s+/g, ' ').trim().slice(0, MAX_CONTENT_LEN);
  return { title, content };
}

async function fetchYouTubeTitle(videoId) {
  // oEmbed: API 키 불필요, JSON 응답에 title/author_name 포함
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const res = await fetch(oembedUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; glean-curator/0.1)' },
    });
    if (res.ok) {
      const data = await res.json();
      const t = (data.title || '').trim();
      const author = (data.author_name || '').trim();
      if (t) return author ? `${t} — ${author}` : t;
    }
  } catch {
    // oEmbed 실패 시 폴백
  }
  return `YouTube ${videoId}`;
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; glean-curator/0.1; +personal-use)',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  });

  if (!res.ok) {
    throw new Error(`fetch 실패: ${res.status} ${res.statusText}`);
  }

  const html = await res.text();
  const title = extractTitle(html) || url;
  const content = extractText(html).slice(0, MAX_CONTENT_LEN);

  return { title, content };
}

function extractTitle(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? decodeEntities(m[1]).replace(/\s+/g, ' ').trim() : null;
}

function extractText(html) {
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ');
  return decodeEntities(stripped).replace(/\s+/g, ' ').trim();
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

module.exports = { fetchPage, extractYouTubeId };
