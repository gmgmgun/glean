const $q = document.getElementById('q');
const $clear = document.getElementById('clear');
const $feed = document.getElementById('feed');
const $tagCloud = document.getElementById('tag-cloud');
const $empty = document.getElementById('empty');

let allItems = [];        // 전체 자료 (태그 클라우드의 원천 — 고정)
let displayedItems = [];  // 피드에 표시할 자료 (필터 결과)
let activeTag = null;     // 현재 활성화된 태그 필터 (클라이언트 측)
let searchQuery = '';     // 현재 검색어 (서버 FTS5)

async function loadAll() {
  $feed.innerHTML = '<div class="loading">로딩 중...</div>';
  $empty.classList.add('hidden');
  try {
    const res = await fetch('/items?limit=200');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    allItems = await res.json();
    applyFilter();
  } catch (err) {
    allItems = [];
    displayedItems = [];
    $tagCloud.innerHTML = '';
    $feed.innerHTML = `<div class="error">불러오기 실패: ${err.message}</div>`;
  }
}

async function applyFilter() {
  if (searchQuery) {
    // 서버 FTS5 검색
    try {
      const res = await fetch(`/items/search?q=${encodeURIComponent(searchQuery)}`);
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try { const j = await res.json(); if (j.error) msg += ` — ${j.error}`; } catch {}
        throw new Error(msg);
      }
      displayedItems = await res.json();
    } catch (err) {
      displayedItems = [];
      renderTagCloud();
      $feed.innerHTML = `<div class="error">검색 실패: ${err.message}</div>`;
      $empty.classList.add('hidden');
      return;
    }
  } else if (activeTag) {
    // 태그 필터 — 클라이언트 측 정확 일치 (네트워크 X)
    displayedItems = allItems.filter((i) => (i.tags || []).includes(activeTag));
  } else {
    displayedItems = allItems;
  }
  render();
}

function render() {
  renderTagCloud();
  renderFeed();
}

function renderTagCloud() {
  // 항상 allItems 기준 — 필터/검색에 영향받지 않음
  const counts = new Map();
  for (const item of allItems) {
    for (const t of item.tags || []) counts.set(t, (counts.get(t) || 0) + 1);
  }
  const sorted = [...counts.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
  );
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
    el.addEventListener('click', () => toggleTag(tag));
    $tagCloud.appendChild(el);
  }
}

function renderFeed() {
  $feed.innerHTML = '';
  if (displayedItems.length === 0) {
    $empty.classList.remove('hidden');
    return;
  }
  $empty.classList.add('hidden');
  for (const item of displayedItems) {
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
    tagEl.addEventListener('click', () => toggleTag(t));
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

function toggleTag(tag) {
  if (activeTag === tag) {
    // 같은 태그 다시 클릭 → 해제
    activeTag = null;
  } else {
    // 다른 태그 → 활성화 (검색은 해제)
    activeTag = tag;
    searchQuery = '';
    $q.value = '';
  }
  applyFilter();
}

async function deleteItem(id, title) {
  const label = title ? `"${title}"` : `id ${id}`;
  if (!confirm(`${label} 삭제하시겠습니까?`)) return;
  try {
    const res = await fetch(`/items/${id}`, { method: 'DELETE' });
    if (res.status !== 204 && !res.ok) throw new Error(`HTTP ${res.status}`);
    // 삭제는 전체 자료에 영향 → 클라우드 갱신 위해 allItems 재로드
    loadAll();
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
    searchQuery = v;
    if (v) activeTag = null; // 검색 입력 시 태그 필터 해제
    applyFilter();
  }, 250)
);

$clear.addEventListener('click', () => {
  $q.value = '';
  searchQuery = '';
  activeTag = null;
  applyFilter();
  $q.focus();
});

loadAll();
