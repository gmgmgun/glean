const $q = document.getElementById('q');
const $clear = document.getElementById('clear');
const $feed = document.getElementById('feed');
const $tagCloud = document.getElementById('tag-cloud');
const $empty = document.getElementById('empty');

let currentItems = [];
let activeTag = null;

async function load(query) {
  $feed.innerHTML = '<div class="loading">로딩 중...</div>';
  $empty.classList.add('hidden');
  try {
    const path = query
      ? `/items/search?q=${encodeURIComponent(query)}`
      : '/items?limit=200';
    const res = await fetch(path);
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try {
        const j = await res.json();
        if (j.error) msg += ` — ${j.error}`;
      } catch {}
      throw new Error(msg);
    }
    currentItems = await res.json();
    render();
  } catch (err) {
    currentItems = [];
    $tagCloud.innerHTML = '';
    $feed.innerHTML = `<div class="error">불러오기 실패: ${err.message}</div>`;
    $empty.classList.add('hidden');
  }
}

function render() {
  renderTagCloud();
  renderFeed();
}

function renderTagCloud() {
  const counts = new Map();
  for (const item of currentItems) {
    for (const t of item.tags || []) counts.set(t, (counts.get(t) || 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  $tagCloud.innerHTML = '';
  for (const [tag, n] of sorted) {
    const el = document.createElement('span');
    el.className = 'tag' + (tag === activeTag ? ' active' : '');
    el.title = `"${tag}" 태그 필터`;
    const label = document.createTextNode(tag);
    const cnt = document.createElement('span');
    cnt.className = 'count';
    cnt.textContent = n;
    el.appendChild(label);
    el.appendChild(cnt);
    el.addEventListener('click', () => filterByTag(tag));
    $tagCloud.appendChild(el);
  }
}

function renderFeed() {
  $feed.innerHTML = '';
  if (currentItems.length === 0) {
    $empty.classList.remove('hidden');
    return;
  }
  $empty.classList.add('hidden');
  for (const item of currentItems) {
    $feed.appendChild(renderCard(item));
  }
}

function renderCard(item) {
  const card = document.createElement('article');
  card.className = 'card';

  const titleEl = document.createElement('h2');
  titleEl.className = 'title';
  const a = document.createElement('a');
  a.href = item.url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.textContent = item.title || item.url;
  titleEl.appendChild(a);
  card.appendChild(titleEl);

  if (item.url) {
    const url = document.createElement('p');
    url.className = 'url';
    url.textContent = displayUrl(item.url);
    card.appendChild(url);
  }

  if (item.summary) {
    const sum = document.createElement('div');
    sum.className = 'summary';
    sum.textContent = item.summary;
    card.appendChild(sum);
  }

  const meta = document.createElement('div');
  meta.className = 'meta';

  for (const t of item.tags || []) {
    const tagEl = document.createElement('span');
    tagEl.className = 'tag';
    tagEl.textContent = t;
    tagEl.title = `"${t}" 태그 필터`;
    tagEl.addEventListener('click', () => filterByTag(t));
    meta.appendChild(tagEl);
  }

  const date = document.createElement('span');
  date.className = 'date';
  date.textContent = formatDate(item.created_at);
  meta.appendChild(date);

  const del = document.createElement('button');
  del.className = 'delete';
  del.textContent = '삭제';
  del.title = `id ${item.id} 삭제`;
  del.addEventListener('click', () => deleteItem(item.id, item.title));
  meta.appendChild(del);

  card.appendChild(meta);
  return card;
}

function filterByTag(tag) {
  if (activeTag === tag) {
    activeTag = null;
    $q.value = '';
    load();
  } else {
    activeTag = tag;
    $q.value = tag;
    load(tag);
  }
}

async function deleteItem(id, title) {
  const label = title ? `"${title}"` : `id ${id}`;
  if (!confirm(`${label} 삭제하시겠습니까?`)) return;
  try {
    const res = await fetch(`/items/${id}`, { method: 'DELETE' });
    if (res.status !== 204 && !res.ok) throw new Error(`HTTP ${res.status}`);
    const q = $q.value.trim();
    load(q || null);
  } catch (err) {
    alert(`삭제 실패: ${err.message}`);
  }
}

function displayUrl(u) {
  try {
    const url = new URL(u);
    return url.hostname + url.pathname;
  } catch {
    return u;
  }
}

function formatDate(s) {
  if (!s) return '';
  // SQLite "YYYY-MM-DD HH:MM:SS" → "YYYY-MM-DD HH:MM"
  return s.slice(0, 16);
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

$q.addEventListener(
  'input',
  debounce((e) => {
    const v = e.target.value.trim();
    activeTag = null; // 검색어 직접 입력 시 태그 활성 해제 (재렌더 시 active 표시 갱신)
    load(v || null);
  }, 250)
);

$clear.addEventListener('click', () => {
  $q.value = '';
  activeTag = null;
  load();
  $q.focus();
});

load();
