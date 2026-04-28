# glean 크롬 익스텐션 (Phase 2)

현재 페이지를 한 번의 액션으로 glean 백엔드에 저장.

## 설치 (개발자 모드)

1. Chrome → `chrome://extensions` 접속
2. 우상단 **개발자 모드** 토글 ON
3. **압축해제된 확장 프로그램을 로드합니다** 클릭 → 이 `extension/` 폴더 선택
4. 익스텐션 목록에 `glean`이 표시되면 완료

## 사용

### 두 가지 트리거
- **우클릭 메뉴**: 아무 페이지에서 마우스 우클릭 → "이 페이지 glean에 저장"
- **단축키**: <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>G</kbd> (Mac: <kbd>⌘</kbd>+<kbd>Shift</kbd>+<kbd>G</kbd>)

### 결과 표시
페이지 우상단에 토스트가 뜸:
- **녹색**: 저장 완료 + 요약·태그 미리보기
- **파란색**: 이미 저장된 URL (중복)
- **회색**: 저장 중...
- **빨간색**: 에러 (백엔드 연결 실패, http(s) 페이지 아님 등)

토스트는 5.5초 후 자동 사라짐. 클릭하면 즉시 닫힘.

## 옵션

`chrome://extensions` → glean → **세부정보** → **확장 프로그램 옵션**
- 백엔드 URL 변경 (기본 `http://localhost:3001`)
- 저장 시 자동으로 헬스체크 수행

## 단축키 변경

`chrome://extensions/shortcuts` 에서 `Ctrl+Shift+G`를 다른 키로 변경 가능.

## 제한

- `chrome://`, `edge://`, Chrome 웹스토어 페이지 등 특수 페이지에서는 동작 안 함 (`activeTab` 권한 제한)
- PDF 뷰어, 일부 파일 프로토콜 페이지에서도 토스트가 안 뜰 수 있음

## 권한 설명

- `contextMenus` — 우클릭 메뉴 항목 추가
- `storage` — 백엔드 URL 저장 (`chrome.storage.sync`)
- `scripting` — 토스트 UI를 현재 페이지에 주입
- `activeTab` — 사용자가 명시적으로 트리거할 때만 현재 탭 접근
- `host_permissions: localhost:*` — 백엔드 API 호출

원격 서버를 쓰려면 `manifest.json`의 `host_permissions`에 해당 도메인 추가 필요.

## 아이콘

현재 아이콘 파일 미포함 — Chrome 기본 퍼즐 조각 아이콘 사용. 나중에 `icons/16.png`, `icons/48.png`, `icons/128.png`를 추가하고 manifest에 `icons` 필드 등록하면 됨.
