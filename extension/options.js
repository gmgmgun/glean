const $url = document.getElementById('url');
const $save = document.getElementById('save');
const $status = document.getElementById('status');

const DEFAULT_BACKEND = 'http://localhost:3001';

async function load() {
  const { backendUrl = DEFAULT_BACKEND } = await chrome.storage.sync.get('backendUrl');
  $url.value = backendUrl;
}

function setStatus(text, ok) {
  $status.textContent = text;
  $status.className = `status ${ok ? 'ok' : 'err'}`;
}

async function save() {
  const v = $url.value.trim().replace(/\/+$/, '');
  if (!/^https?:\/\/.+/i.test(v)) {
    return setStatus('유효한 http(s) URL을 입력하세요', false);
  }
  await chrome.storage.sync.set({ backendUrl: v });
  setStatus('저장됨 ✓', true);

  // 헬스체크
  try {
    const res = await fetch(`${v}/health`, { method: 'GET' });
    if (res.ok) setStatus('저장됨 ✓ — 서버 연결 OK', true);
    else setStatus(`저장됨 — 서버 응답 ${res.status}`, false);
  } catch (err) {
    setStatus(`저장됨 — 서버 연결 실패 (${err.message}). 서버가 실행 중인지 확인하세요.`, false);
  }
}

$save.addEventListener('click', save);
$url.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
load();
