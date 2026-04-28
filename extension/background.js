const DEFAULT_BACKEND = 'http://localhost:3001';
const CONTEXT_MENU_ID = 'glean-save';

chrome.runtime.onInstalled.addListener(async () => {
  chrome.contextMenus.create({
    id: CONTEXT_MENU_ID,
    title: '이 페이지 glean에 저장',
    contexts: ['page'],
  });
  const { backendUrl } = await chrome.storage.sync.get('backendUrl');
  if (!backendUrl) {
    await chrome.storage.sync.set({ backendUrl: DEFAULT_BACKEND });
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === CONTEXT_MENU_ID && tab) savePage(tab);
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'save-page') return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) savePage(tab);
});

async function savePage(tab) {
  if (!tab.url || !/^https?:/i.test(tab.url)) {
    return showToast(tab.id, { type: 'error', title: '저장 불가', message: 'http(s) 페이지에서만 저장됩니다' });
  }

  const { backendUrl = DEFAULT_BACKEND } = await chrome.storage.sync.get('backendUrl');

  await showToast(tab.id, { type: 'pending', title: 'glean', message: '저장 중...' });

  try {
    const res = await fetch(`${backendUrl}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: tab.url }),
    });

    let data = {};
    try { data = await res.json(); } catch { /* not JSON */ }

    if (res.status === 200 && data._duplicate) {
      return showToast(tab.id, {
        type: 'info', title: '이미 저장됨',
        message: data.title || '', summary: data.summary, tags: data.tags,
      });
    }
    if (res.status === 201) {
      return showToast(tab.id, {
        type: 'success', title: '저장 완료',
        message: data.title || '', summary: data.summary, tags: data.tags,
      });
    }
    return showToast(tab.id, {
      type: 'error', title: `오류 ${res.status}`,
      message: data.error || '서버 응답 비정상',
    });
  } catch (err) {
    return showToast(tab.id, {
      type: 'error', title: '백엔드 연결 실패',
      message: `${err.message}\n${backendUrl} 가 살아있는지 확인하세요`,
    });
  }
}

async function showToast(tabId, payload) {
  if (!tabId) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: injectToast,
      args: [payload],
    });
  } catch (err) {
    console.warn('[glean] toast 주입 실패:', err.message);
  }
}

// 이 함수는 페이지 컨텍스트에서 직렬화되어 실행됨. 외부 변수를 참조하면 안 됨.
function injectToast(payload) {
  const ROOT_ID = 'glean-toast-root';
  document.getElementById(ROOT_ID)?.remove();

  const colors = {
    success: '#0f766e',
    info: '#1e40af',
    pending: '#475569',
    error: '#b91c1c',
  };

  const root = document.createElement('div');
  root.id = ROOT_ID;
  root.style.cssText = `
    all: initial;
    position: fixed; top: 16px; right: 16px; z-index: 2147483647;
    max-width: 360px; min-width: 240px;
    background: ${colors[payload.type] || '#1f2937'};
    color: #fff; padding: 12px 14px; border-radius: 8px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif;
    font-size: 13px; line-height: 1.45;
    box-shadow: 0 8px 24px rgba(0,0,0,0.18);
    transition: opacity 0.25s ease, transform 0.25s ease;
    opacity: 0; transform: translateY(-6px);
    pointer-events: auto;
  `;

  const titleEl = document.createElement('div');
  titleEl.style.cssText = 'font-weight: 600; margin-bottom: 4px; color: #fff;';
  titleEl.textContent = `glean — ${payload.title || ''}`;
  root.appendChild(titleEl);

  if (payload.message) {
    const msgEl = document.createElement('div');
    msgEl.style.cssText = 'font-size: 12px; opacity: 0.9; color: #fff; white-space: pre-wrap;';
    msgEl.textContent = payload.message;
    root.appendChild(msgEl);
  }

  if (payload.summary) {
    const sumEl = document.createElement('div');
    sumEl.style.cssText = 'margin-top: 8px; font-size: 12px; color: #fff; opacity: 0.95;';
    const txt = payload.summary;
    sumEl.textContent = txt.length > 220 ? txt.slice(0, 220) + '…' : txt;
    root.appendChild(sumEl);
  }

  if (payload.tags && payload.tags.length) {
    const tagBox = document.createElement('div');
    tagBox.style.cssText = 'display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px;';
    for (const tag of payload.tags) {
      const t = document.createElement('span');
      t.style.cssText = 'background: rgba(255,255,255,0.2); color: #fff; padding: 2px 8px; border-radius: 999px; font-size: 11px;';
      t.textContent = tag;
      tagBox.appendChild(t);
    }
    root.appendChild(tagBox);
  }

  // 클릭하면 닫힘
  root.addEventListener('click', () => {
    root.style.opacity = '0';
    setTimeout(() => root.remove(), 250);
  });

  document.body.appendChild(root);
  requestAnimationFrame(() => {
    root.style.opacity = '1';
    root.style.transform = 'translateY(0)';
  });

  // 자동 사라짐 (pending은 다음 토스트가 덮어씀)
  if (payload.type !== 'pending') {
    setTimeout(() => {
      root.style.opacity = '0';
      root.style.transform = 'translateY(-6px)';
      setTimeout(() => root.remove(), 300);
    }, 5500);
  }
}
