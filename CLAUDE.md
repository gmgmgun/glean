# CLAUDE.md

이 문서는 Claude Code(또는 다른 AI 코딩 어시스턴트)가 이 프로젝트를 작업할 때 참조하는 컨텍스트 파일입니다.

---

## 프로젝트 개요

**프로젝트명**: my-curator (가칭)

**한 줄 설명**: 반도체 도메인 학습을 위한 개인용 웹 자료 큐레이션 시스템. 크롬에서 발견한 좋은 자료를 우클릭/단축키 한 번으로 저장하면, LLM이 자동으로 요약·태깅해서 검색 가능한 개인 지식 베이스로 누적한다.

**현재 단계**: MVP 백엔드 개발 중 (Phase 1)

---

## 배경과 동기

### 왜 만드는가

- 반도체 IT 회사의 SW 엔지니어로서, HW 도메인 지식을 평소 검색하며 학습하고 있다.
- 좋은 자료를 발견해도 브라우저 북마크나 머릿속에 흩어져 있어, 나중에 다시 찾기 어렵다.
- 같은 검색을 인생에서 반복하는 비효율을 해결하고 싶다.
- "외장 두뇌(second brain)"로서, 본인의 학습 맥락에 100% 맞춘 도구를 직접 만든다.

### 의식적으로 채택하지 않은 방향

- **사내 위키/블로그 모델**: 글쓰기 비용이 높아 죽은 시스템이 되기 쉬움. 본 프로젝트는 "쓰기"가 아니라 "큐레이션"이 핵심.
- **회사 차원 도입 우선**: 처음부터 동료들의 사용을 가정하면 부담만 커지고 만들기 전에 좌절하기 쉬움. 개인용으로 시작해 본인이 1년 쓰면서 가치를 검증한 후, 자연스러운 확산이 일어나면 그때 회사로 확장.
- **Notion API 저장소**: API가 느리고 데이터 모델이 과함. 자료 한 건은 "페이지"가 아니라 한 줄짜리 레코드.
- **풀스펙 첫 버전**: 시맨틱 검색, 익스텐션 UI, 다이제스트 메일 등은 모두 후순위. 백엔드부터 견고하게.

### 장기 비전 (현재 단계에서는 구현 안 함)

- 시맨틱 검색 (`sqlite-vec` 확장 + 임베딩 모델)
- 키워드(FTS5) + 시맨틱 하이브리드 검색
- 주간 다이제스트 메일
- 사내 확장 시 멀티유저 지원, 사내 LLM 연동

---

## 기술 스택과 결정 사항

### 채택

| 영역 | 선택 | 이유 |
|---|---|---|
| 언어 | Node.js (JavaScript) | 사용자가 JS/웹에 익숙 |
| HTTP 서버 | Express | 단순하고 익숙한 패턴 |
| DB | SQLite (`better-sqlite3`) | 파일 하나, 의존성 0, 동기 API로 코드 깔끔, 향후 `sqlite-vec`로 벡터 검색 확장 가능 |
| 검색 (현재) | SQLite FTS5 (`unicode61` 토크나이저) | 별도 설치 없이 한국어도 처리, 향후 하이브리드 검색의 키워드 백엔드로 계속 사용 |
| LLM | Anthropic Claude (`claude-haiku-4-5-20251001`) | 긴 컨텍스트 안정성, 한국어 품질, 비용 효율 |
| 환경변수 | `dotenv` | API 키는 절대 코드/Git에 들어가면 안 됨 |
| CORS | `cors` | 향후 크롬 익스텐션이 localhost로 호출하기 위함 |

### 의도적으로 단순하게 둔 부분

- **본문 추출**: 정규식으로 태그 제거 정도. 향후 `@mozilla/readability` 등으로 업그레이드 여지.
- **태그 체계**: 자유 생성이 아닌 **고정 태그 풀**에서 LLM이 선택. 새 태그는 1개까지 허용. 태그 난립 방지.
- **에러 처리**: 일단 try/catch + 500 응답. 재시도, 큐, 백오프 등은 후순위.
- **인증**: 개인 로컬 사용이므로 없음. 향후 사내 확장 시 추가.

---

## 디렉터리 구조

```
my-curator/
└── backend/
    ├── package.json
    ├── .env              # API 키 (Git에 절대 커밋 금지)
    ├── .gitignore
    ├── server.js         # Express 라우팅
    ├── db.js             # SQLite 래퍼
    ├── llm.js            # Claude API 호출 (요약·태깅)
    ├── fetcher.js        # 웹페이지 본문 추출
    └── data.db           # SQLite 파일 (자동 생성, Git 제외)
```

향후 추가 예정:
```
├── extension/            # 크롬 익스텐션 (Phase 2)
└── web/                  # 검색·열람용 웹 UI (Phase 3, 선택)
```

---

## API 명세 (현재)

베이스 URL: `http://localhost:3000`

| 메서드 | 경로 | 설명 | 요청 | 응답 |
|---|---|---|---|---|
| GET | `/health` | 헬스체크 | - | `{"ok": true}` |
| POST | `/items` | 자료 저장 (URL → 요약·태깅 → DB) | `{"url": "..."}` | `201` + item / `200` + `{_duplicate: true}` |
| GET | `/items?limit=50` | 최근 자료 목록 | - | `[item, ...]` |
| GET | `/items/search?q=...` | FTS5 키워드 검색 | - | `[item, ...]` |
| GET | `/items/:id` | 개별 자료 상세 | - | `item` / `404` |
| DELETE | `/items/:id` | 자료 삭제 | - | `204` / `404` |

### Item 스키마

```json
{
  "id": 1,
  "url": "https://...",
  "title": "...",
  "summary": "3~5문장 요약 (SW 엔지니어 관점 포함)",
  "tags": ["DRAM", "기초개념"],
  "content": "원문 본문 (검색용, 최대 15000자)",
  "created_at": "2026-04-28 12:34:56"
}
```

---

## DB 스키마

```sql
CREATE TABLE items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL UNIQUE,
  title TEXT,
  summary TEXT,
  tags TEXT,            -- JSON 배열을 문자열로 저장
  content TEXT,         -- 원문 본문 (검색용)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_created_at ON items(created_at DESC);

-- FTS5 가상 테이블 (전문 검색)
CREATE VIRTUAL TABLE items_fts USING fts5(
  title, summary, tags, content,
  content='items', content_rowid='id',
  tokenize='unicode61'
);

-- INSERT/DELETE 트리거로 FTS 자동 동기화
```

---

## LLM 프롬프트 설계

### 핵심 원칙

1. **도메인 컨텍스트 명시**: "반도체 도메인", "SW 엔지니어가 HW 학습" 맥락을 시스템 프롬프트에 항상 포함.
2. **태그 풀 제약**: 자유 생성 금지. 사전 정의된 풀에서 선택. 새 태그는 1개까지.
3. **출력 포맷 강제**: JSON only, 마크다운 코드블록 금지. 파싱 시 `{...}` 정규식으로 견고하게.
4. **요약 형식**: 3~5문장, "SW 엔지니어 관점에서 왜 알 가치가 있는지" 포함.

### 태그 풀 (현재)

```
메모리: DRAM, SRAM, NAND, NOR, HBM, GDDR, LPDDR
공정/소자: FinFET, GAA, EUV, lithography, etching, CMP, doping
설계: RTL, verification, DFT, timing, power, layout
인터페이스: PCIe, CXL, DDR, SerDes, AXI
SW 관점: firmware, driver, kernel, compiler
일반: reliability, yield, packaging, testing, EDA
한국어: 기초개념, 튜토리얼, 심화, 논문, 백서
```

태그 풀은 사용하면서 본인 검색 패턴에 맞게 계속 다듬을 것.

---

## 개발 환경 설정

### 초기 셋업

```bash
mkdir my-curator && cd my-curator
mkdir backend && cd backend
npm init -y
npm install express better-sqlite3 @anthropic-ai/sdk dotenv cors
npm install --save-dev nodemon
```

### `.env` 파일

```
ANTHROPIC_API_KEY=sk-ant-...
PORT=3000
```

API 키는 https://console.anthropic.com 에서 발급. 처음 $5 충전이면 한참 쓸 수 있음.

### `.gitignore`

```
node_modules/
.env
data.db
data.db-*
*.log
```

### `package.json` scripts

```json
"scripts": {
  "dev": "nodemon server.js",
  "start": "node server.js"
}
```

---

## 실행 및 테스트

### 서버 실행

```bash
npm run dev
```

### 동작 확인 (curl)

```bash
# 헬스체크
curl http://localhost:3000/health

# 자료 저장
curl -X POST http://localhost:3000/items \
  -H "Content-Type: application/json" \
  -d '{"url": "https://en.wikipedia.org/wiki/Dynamic_random-access_memory"}'

# 목록 조회
curl http://localhost:3000/items

# 검색
curl "http://localhost:3000/items/search?q=DRAM"

# 삭제
curl -X DELETE http://localhost:3000/items/1
```

저장 요청은 5~10초 소요 (페이지 fetch + LLM 호출).

---

## Phase 1 완성 체크리스트

- [ ] `package.json` + 의존성 설치
- [ ] `.env` 파일 + API 키 설정
- [ ] `.gitignore` 작성
- [ ] `db.js` — SQLite 초기화, FTS5 테이블, CRUD 함수
- [ ] `fetcher.js` — URL → 제목/본문 추출
- [ ] `llm.js` — Claude 호출, 태그 풀 적용, JSON 파싱
- [ ] `server.js` — Express 라우팅 5개
- [ ] curl로 저장 → 목록 → 검색 동작 확인
- [ ] Wikipedia DRAM 페이지로 실제 요약·태그 품질 확인

---

## Phase 1 이후 로드맵

### Phase 2: 크롬 익스텐션 (Manifest V3)
- 우클릭 컨텍스트 메뉴: "이 페이지 저장"
- 단축키 (예: Cmd/Ctrl+Shift+S)
- 저장 결과 토스트 알림 (요약·태그 미리보기)
- 옵션 페이지 (백엔드 URL 설정)

### Phase 3: 검색·열람 UI
- 간단한 웹 페이지 (`localhost:3000/`)
- 최근 자료 피드, 태그 필터, 검색
- 개별 자료 상세 (요약 + 원본 링크)

### Phase 4: 시맨틱 검색
- `sqlite-vec` 확장 도입
- 임베딩 모델 (OpenAI `text-embedding-3-small` 또는 오픈소스 `bge-m3`)
- 저장 시 자동 임베딩, 검색 시 FTS5 + 벡터 하이브리드 (RRF 등)

### Phase 5 이후 (가정)
- 회사 확장 시: 멀티유저, 인증, 사내 LLM 연동, 주간 다이제스트 메일
- 본인이 1년 사용 후 가치 검증된 시점에 검토

---

## 코딩 스타일·규칙

- **한글 주석 OK**: 본인용 프로젝트이므로 영어 강요 안 함. 의도와 맥락 위주로 주석.
- **try/catch는 라우트 핸들러 레벨에서**: 내부 함수는 throw, 라우트에서 잡아서 응답.
- **동기 API 우선**: `better-sqlite3`는 의도적으로 동기. async/await 남용 금지.
- **외부 API 호출은 항상 await**: Claude API, fetch는 비동기.
- **불필요한 추상화 금지**: ORM, 레이어드 아키텍처 등 도입 금지. 파일 4개로 충분.
- **MVP 철칙**: "동작하는 단순한 것"이 "동작하지 않는 정교한 것"보다 100배 낫다.

---

## AI 어시스턴트(Claude Code 등)에게 부탁

이 프로젝트를 작업할 때:

1. **MVP 단계임을 항상 의식**. 과도한 추상화, 불필요한 의존성 추가 금지.
2. **사용자가 JS/웹에 익숙**하므로 기본 문법 설명은 생략. 의도와 트레이드오프 설명에 집중.
3. **이 문서에 없는 큰 결정**(새 라이브러리 도입, 아키텍처 변경 등)은 사용자에게 먼저 물어볼 것.
4. **태그 풀은 사용자 도메인 자산**이므로 임의로 변경하지 말고, 변경이 필요하면 제안만.
5. **DB 스키마 변경**은 마이그레이션 영향 함께 설명.
6. **Phase 경계를 넘는 기능**(시맨틱 검색, 익스텐션 등)은 현재 Phase가 끝났는지 확인 후 진행.
7. **에러 메시지는 한글 OK**. 본인용이므로 디버깅 편의 우선.

---

## 변경 이력

- 2026-04-28: 초기 작성. Phase 1 백엔드 설계 확정.
