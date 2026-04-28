# glean

> 반도체 도메인 학습을 위한 개인용 웹 자료 큐레이션 시스템

크롬에서 발견한 좋은 자료를 한 번의 액션으로 저장하면, LLM이 자동으로 요약·태깅해서 검색 가능한 개인 지식 베이스로 누적한다. 같은 검색을 인생에서 반복하지 않기 위한 "외장 두뇌(second brain)" 프로젝트.

## 왜 만드는가

- 반도체 IT 회사 SW 엔지니어가 HW 도메인을 평소 검색으로 학습 중
- 좋은 자료가 브라우저 북마크와 머릿속에 흩어져 다시 찾기 어려움
- "쓰기"가 아닌 **"큐레이션"** 이 핵심 — 사내 위키/블로그 모델은 글쓰기 비용이 높아 죽기 쉬움
- 본인 학습 맥락에 100% 맞춘 도구를 직접 만들고, 1년 사용해 가치 검증 후 자연스러운 확산을 기대

## 현재 단계

**Phase 3: 검색·열람 웹 UI 동작 가능**

| Phase | 내용 | 상태 |
|---|---|---|
| 1 | Node + Express + SQLite + Claude API 백엔드 | 완료 |
| 2 | 크롬 익스텐션 (우클릭/단축키 저장) | 완료 |
| 3 | 검색·열람 웹 UI | 완료 |
| 4 | 시맨틱 검색 (`sqlite-vec` + 임베딩) | 예정 |

## 기술 스택

- **런타임**: Node.js
- **HTTP**: Express
- **DB**: SQLite (`better-sqlite3`) + FTS5 (한국어 `unicode61` 토크나이저)
- **LLM**: Anthropic Claude (`claude-haiku-4-5-20251001`)
- **본문 추출**: 정규식 기반 (향후 `@mozilla/readability` 검토)

설계 결정 배경은 [CLAUDE.md](./CLAUDE.md) 참조.

## 빠른 시작

```bash
cd backend
npm install
cp .env.example .env   # ANTHROPIC_API_KEY 채우기
npm run dev
```

서버는 `http://localhost:3001` 에서 동작 (포트 변경은 `.env`의 `PORT`).

- **웹 UI**: 브라우저에서 `http://localhost:3001/` 열기 → 자료 피드 + 태그 필터 + 검색
- **크롬 익스텐션**: 페이지 우클릭 또는 `Ctrl+Shift+G` 로 한 번에 저장 ([설치 가이드](./extension/README.md))

```bash
# 자료 저장
curl -X POST http://localhost:3000/items \
  -H "Content-Type: application/json" \
  -d '{"url": "https://en.wikipedia.org/wiki/Dynamic_random-access_memory"}'

# 검색
curl "http://localhost:3000/items/search?q=DRAM"
```

저장은 페이지 fetch + LLM 호출로 5~10초 소요.

## API 요약

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/health` | 헬스체크 |
| POST | `/items` | URL 저장 (요약·태깅 포함) |
| GET | `/items?limit=50` | 최근 자료 목록 |
| GET | `/items/search?q=...` | FTS5 키워드 검색 |
| GET | `/items/:id` | 개별 상세 |
| DELETE | `/items/:id` | 삭제 |

전체 명세는 [CLAUDE.md](./CLAUDE.md#api-명세-현재) 참조.

## 디렉터리 구조

```
glean/
├── CLAUDE.md             # AI 어시스턴트용 컨텍스트 (설계 문서 겸용)
├── README.md
├── backend/              # Phase 1 (완료)
│   ├── server.js         # Express 라우팅 + 정적 서빙
│   ├── db.js             # SQLite + FTS5
│   ├── llm.js            # Claude 호출 (요약·태깅)
│   ├── fetcher.js        # 웹페이지 본문 추출
│   ├── data.db           # 자동 생성 (Git 제외)
│   └── web/              # Phase 3 (완료) — 검색·열람 웹 UI
│       ├── index.html
│       ├── style.css
│       └── app.js        # vanilla JS (프레임워크/빌드 없음)
└── extension/            # Phase 2 (완료) — 크롬 MV3 익스텐션
    ├── manifest.json
    ├── background.js     # 컨텍스트 메뉴 + 단축키 + 토스트 주입
    ├── options.html
    └── options.js
```

## 라이선스

개인 프로젝트 — 라이선스 미지정.
