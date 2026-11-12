# NOTES (I1)
- 원작: SharpWizard/ironvale, source commit 41672ef32a42c154b237e579cdf357144709204a (2026-11-12, "README: note that the game is currently made for PC")
- 작업 폴더: /mnt/workspace/ironvale-ko (sandbox), build: `node build.js` (Node 22, 의존성 없음)
- 빌드: src/NN_*.js 를 정렬해 src/shell.html 의 /*__GAME_JS__*/ 에 합쳐 ironvale.html 생성. models/*.js(16MB), lib/three.min.js 는 외부 파일.
- 외부 요청: lib/three.min.js 실패 시에만 cdnjs three r128 fallback. 웹폰트 없음 (시스템 폰트: Georgia/serif 제목, system-ui 본문).
- 폰트: Georgia/system-ui 에 한글이 없어 font-family 에 Pretendard / Noto Sans KR / Apple SD Gothic Neo / Malgun Gothic (제목은 Noto Serif KR / Nanum Myeongjo 포함) 추가함. 시스템 글꼴만 사용.
- UI 문구: shell.html 정적 HTML(메뉴/설정/조작법/일시정지/연대기/기술/단축키/스토리/종료) + 각 모듈의 인라인 문자열 / innerHTML 템플릿.
- i18n: src/00_i18n.js(엔진: t(), DOM 텍스트노드/title 자동 번역 + MutationObserver, localStorage ironvale.lang, 기본 ko) + src/00_i18n_ko.js(사전·정규식 규칙). 소스의 영어 문자열은 그대로 두고(게임 로직이 비교에 사용) 표시 단계에서 번역. 사전 키 = 영어 원문.
- 용어집(I2/I3에서도 통일): 아이언베일 / 아즈르 왕국 / 크림슨 행군 / 윈드라이더 부족 / 스톤홀트 부족 / 앰버 연맹 / 주민 / 마을 회관 / 병영 / 사격장 / 마구간 / 대장간 / 불가사의 / 정착의 시대·봉건 시대·철기 시대. 자원: 식량·목재·석재·금.
- 게시 순서/커밋(모두 '게임: '): 루트(원작 영문 빌드) -> models -> lib -> src -> ironvale.html(한글화 빌드). README.md/NOTES.md 는 웹 편집기.
- 업로드 제약: 한 커밋 = 한 폴더, 새 폴더는 /upload/main/<폴더> 로 열어 breadcrumb 확인, 파일은 /downloads/<이름> 로 스테이징(폴더간 이름 충돌 주의). tools/, screenshots/, PROMPTS.md 는 게시하지 않음(빌드와 무관).

## 문자열 인벤토리 (대략치, 영어 문자열 리터럴/단어 수, 셰이더 제외)
| 파일 | 내용 | 문자열 | 상태 |
|---|---|---|---|
| src/shell.html | 정적 UI(메뉴/설정/조작법/일시정지/연대기/기술/단축키/스토리/종료), title 툴팁 ~35 | ~230 | I1 완료(크레딧 제외 전부) |
| 01_core.js | 유닛/건물/기술 이름·설명, 시대·세력 이름 | ~44 (설명 문장 ~40) | 이름만 I1, 설명 I2 |
| 10_ui.js | 명령 버튼 제목/설명, 정보 패널, 알림, 연대기/종료 화면 템플릿 | ~81 | 일부 I1(명령 버튼·알림), 나머지 I2 |
| 17_ui2.js | 사건 기록, 생산 바, 기술 트리, 단축키 편집, 주민 목록 | ~33 | I2 |
| 11_main.js / 09_input.js / 06_entities.js / 14_atmos.js / 15_extras.js | 알림·오류·세이브 메시지 | ~35 | 대부분 I1 규칙으로 처리, 확인 필요 |
| 13_content.js | 캠페인 3개/10장 스토리·목표·세력 설정·연대기 | ~93 문자열, ~970 단어 | I3 |
| 튜토리얼/팁(Guide) | 13_content.js 내 tips | 포함 | I2 |

## 라이브 확인 (I1)
- https://sigco3111.github.io/ironvale-ko/ 로드 OK, 한국어 메뉴·설정, 언어 전환(한국어/English) 동작, 1장 시작 후 HUD 도달(소프트웨어 렌더링 ~10fps).
- 미번역 확인된 곳(I2): 튜토리얼 Guide, 목표 트래커, 카메라 패널 일부(Cycle/Weather: Auto), 장/캠페인 제목·소개, 정보 패널 일부, 유닛·건물·기술 설명.
- 실수/주의: 빈 저장소의 첫 업로드는 /upload (루트)만 가능해 루트 파일을 먼저 올림. Pages 저장 버튼은 첫 시도에 적용되지 않아 재시도.
