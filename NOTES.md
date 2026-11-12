# NOTES (I1 → I2 → I3)
- 원작: SharpWizard/ironvale, source commit 41672ef32a42c154b237e579cdf357144709204a (2026-11-12, "README: note that the game is currently made for PC")
- 작업 폴더: /mnt/workspace/ironvale-ko (sandbox), build: `node build.js` (Node 22, 의존성 없음)
- 빌드: src/NN_*.js 를 정렬해 src/shell.html 의 /*__GAME_JS__*/ 에 합쳐 ironvale.html 생성. models/*.js(16MB), lib/three.min.js 는 외부 파일.
- 외부 요청: lib/three.min.js 실패 시에만 cdnjs three r128 fallback. 웹폰트 없음 (시스템 폰트: Georgia/serif 제목, system-ui 본문).
- 폰트: Georgia/system-ui 에 한글이 없어 font-family 에 Pretendard / Noto Sans KR / Apple SD Gothic Neo / Malgun Gothic (제목은 Noto Serif KR / Nanum Myeongjo 포함) 추가함. 시스템 글꼴만 사용.
- UI 문구: shell.html 정적 HTML(메뉴/설정/조작법/일시정지/연대기/기술/단축키/스토리/종료) + 각 모듈의 인라인 문자열 / innerHTML 템플릿.
- i18n: src/00_i18n.js(엔진: t(), DOM 텍스트노드/title 자동 번역 + MutationObserver, localStorage ironvale.lang, 기본 ko) + src/00_i18n_ko.js(사전·정규식 규칙). 소스의 영어 문자열은 그대로 두고(게임 로직이 비교에 사용) 표시 단계에서 번역. 사전 키 = 영어 원문.
- 용어집(I2/I3에서도 통일): 아이언베일 / 아즈르 왕국 / 크림슨 행군 / 윈드라이더 부족 / 스톤홀트 부족 / 앰버 연맹 / 주민 / 마을 회관 / 병영 / 사격장 / 마구간 / 대장간 / 불가사의 / 정착의 시대·봉건 시대·철기 시대. 자원: 식량·목재·석재·금.
- 게시 순서/커밋(모두 '게임: '): 루트(원작 영문 빌드) -> models -> lib -> src -> ironvale.html(한글화 빌드). README.md/NOTES.md 는 웹 편집기.
- 업로드 제약: 한 커밋 = 한 폴더, 새 폴더는 /upload/main/<폴더> 로 열어 breadcrumb 확인, 파일은 /downloads/<이름> 로 스테이징(폴더간 이름 충돌 주의). tools/(check-i18n.js만 I2에서 게시), screenshots/, PROMPTS.md 는 게시하지 않음(빌드와 무관).

## 문자열 인벤토리 (대략치, 영어 문자열 리터럴/단어 수, 셰이더 제외)
| 파일 | 내용 | 문자열 | 상태 |
|---|---|---|---|
| src/shell.html | 정적 UI(메뉴/설정/조작법/일시정지/연대기/기술/단축키/스토리/종료), title 툴팁 ~35 | ~230 | I1 완료(크레딧 제외 전부) |
| 01_core.js | 유닛/건물/기술 이름·설명, 시대·세력 이름 | ~44 (설명 문장 ~40) | I1 이름 + I2 설명 46개 완료 |
| 10_ui.js | 명령 버튼 제목/설명, 정보 패널, 알림, 연대기/종료 화면 템플릿 | ~81 | I1 + I2 완료(미번역 0, tools/check-i18n.js) |
| 17_ui2.js | 사건 기록, 생산 바, 기술 트리, 단축키 편집, 주민 목록 | ~33 | I2 완료(미번역 0) |
| 11_main.js / 09_input.js / 06_entities.js / 14_atmos.js / 15_extras.js | 알림·오류·세이브 메시지 | ~35 | I1 규칙 + I2 오류/종료 메시지 규칙 |
| 13_content.js | 캠페인 3개/10장 스토리·세력 설정·연대기·비트(목표 문구 제외) | ~135 문자열 | I3 완료(src/00_i18n_ko3.js, 미번역 0) |
| 15_extras.js 튜토리얼 Guide | 단계 8개 + 머리글 | 9 | I2 완료 |
| 13_content.js 목표 문구 | 트래커에 표시되는 목표 27종(사전에서만 번역, 파일은 수정 안 함) | 27 | I2 완료 |

## 라이브 확인 (I1)
- https://sigco3111.github.io/ironvale-ko/ 로드 OK, 한국어 메뉴·설정, 언어 전환(한국어/English) 동작, 1장 시작 후 HUD 도달(소프트웨어 렌더링 ~10fps).
- 미번역 확인된 곳(I2): 튜토리얼 Guide, 목표 트래커, 카메라 패널 일부(Cycle/Weather: Auto), 장/캠페인 제목·소개, 정보 패널 일부, 유닛·건물·기술 설명.
- 실수/주의: 빈 저장소의 첫 업로드는 /upload (루트)만 가능해 루트 파일을 먼저 올림. Pages 저장 버튼은 첫 시도에 적용되지 않아 재시도.

## I2 (이번 단계)
- 새 파일 src/00_i18n_ko2.js: 사전 238개(유닛·건물·기술 설명 46, 진영 고유 유닛/건물 10+설명 10, 야생동물·크립 이름 29+설명 29, 튜토리얼 8, 목표 27, 정보 패널·저장 슬롯 등) + 규칙 43개(조합 문장). 규칙은 `I18N.rule(re, fn, true)` (맨 앞에 삽입)로 일반 `A · B` 규칙보다 먼저 적용.
- 소스 수정(표시 전용, 게임 로직 그대로): 10_ui.js(정보 패널 빈 상태 문구를 I18N.t로, 종료 화면 자원 행 I18N.t(r)), 15_extras.js(튜토리얼 본문 I18N.t), 17_ui2.js(종료 그래프 제목·주민 작업 목록 자원 이름 I18N.t), 00_i18n.js(rule 의 first 인자).
- 튜토리얼 본문은 `<b>` 때문에 텍스트 노드가 쪼개져 어순이 안 맞으므로 HTML 전체를 키로 하는 I18N.t 를 사용.
- 주의: 'Stone' 단독 텍스트는 사전에서 '스톤'(맵/부족)이라 자원 표시에는 I18N.t(소문자 키)로 '석재'를 얻는다.
- 용어 추가: 약초사 / 석궁병 / 공성 대포 / 근접 방어·관통 방어 / 주둔 / 하역지(drop-off) / 붉은수염 선장 / 폭군 / 무덤 기사(보스 이름은 I3에서 확정 시 갱신).
- 검사: `node tools/check-i18n.js` — src 의 문자열 리터럴을 조각내 사전·규칙으로 번역되는지 확인(10_ui/17_ui2/15_extras/01_core 미번역 0). 조합되는 조각은 IGNORE 목록.
- 남은 일(I3): 13_content.js 캠페인 3개/10장 제목·소개·스토리·비트·연대기·세력 설명, 보스 이름, 장 제목(`Chapter N: 제목` 의 제목 부분).
- 13_content.js 의 유닛/건물 정의(진영 고유 유닛·건물, 야생동물, 크립, 약초사)는 파일을 고치지 않고 사전으로만 번역함. 보스 이름은 '폭군'(The Tyrant), '붉은수염 선장', '무덤 기사'로 임시 확정 — I3 에서 스토리 번역 시 맞출 것.
- 남은 영어(알려진 것): 장 제목(`제 1장: The Green Vale`), 캠페인 이름·영웅·소개, 스토리 문단, 연대기, 세력 설명/보너스(realmInfo), 지도 테마 설명(mapDesc) — 모두 13_content.js(I3).

## 라이브 확인 (I2)
- 페이지: https://sigco3111.github.io/ironvale-ko/ironvale.html?v=<난수> (캐시 비활성). 메인 메뉴·설정·1장 시작 후 15초: 콘솔 error/warning/uncaught/unhandledrejection/리소스 오류 0건 (console.* 후킹 + window error 캡처, CDP 이벤트는 이 환경에서 전달되지 않아 페이지 내 후킹으로 대체).
- 1장 HUD 도달, 정보 패널(마을 회관/주민), 카메라 패널(날씨: 자동), 명령 툴팁(설명·체력/공격/방어/초), 튜토리얼 Guide(안내 · 1/8단계), 목표 트래커(◆ 봉건 시대로 발전 …), 기술 트리 툴팁, 주민 목록(석재 표기 수정) 한국어 확인.
- 실수: 처음 목표 항목이 '◆ ' 기호가 앞에 붙은 한 텍스트 노드라 번역이 안 됨 → 기호 규칙 추가. 주민 목록의 'Stone'이 '스톤'으로 나옴 → 소스 수정. 이 환경의 소프트웨어 렌더링으로 게임 시간이 느리게 흘러(15초에 게임 1초 미만) 장시간 플레이 확인은 안 함.

## I3 (이번 단계)
- 새 파일 src/00_i18n_ko3.js: 사전 135개(캠페인 3개 이름·영웅·소개, 장 제목·소개·결말 10장, 진행 중 대사 30, 연대기 6, 세력 5개 표어·성향·설명·보너스, 지도 테마 5) + 규칙 1개(`Unique: X (unit) and Y (building)` → `고유: X (유닛), Y (건물)`). 13_content.js 는 수정하지 않음(표시 단계 번역).
- 문체: 서술은 합니다체, 지시문은 하세요체(튜토리얼과 동일), 대사는 말투에 맞는 존댓말.
- 고유명: 바른(Varn), 사르나이(Sarnai), 힐드(Hild), 브라노크(Brannoch), 바타르(Bataar), 개로우(Garrow), 청지기(Steward), 족장(Thane), 바람의 어머니(Windmother), 맹세의 돌(Oathstone), 회색 암말 부족(Grey Mare). 캠페인: 아이언베일의 균열 / 긴 바람의 기수들 / 스톤홀트의 맹세. 장: 푸른 계곡·해적 해안·태고의 야생지·텅 빈 늪 / 부족의 집결·앰버 가도·아즈르의 성벽 / 깊은 뿌리·텅 빈 늪의 왕·맹세의 돌.
- **보스 이름 최종 확정: 폭군(The Tyrant), 붉은수염 선장(Captain Redbeard), 무덤 기사(Grave Knight)** — 임시 아님.
- 주의: tools/check-i18n.js 는 따옴표로 끝나는 조각(진행 중 대사 `Name: "..."`)을 건너뛰므로 대사는 /tmp 스크립트로 별도 확인(전부 사전에 있음).
- 검사: `node build.js` 통과, `node tools/check-i18n.js 13_content.js` 미번역 0, 기본 검사 4개 파일도 0.
- 조합 조각 규칙 3개 추가(라이브 확인 중 발견): `— 소개`(굵은 영웅/세력 이름 뒤 텍스트 노드), `“표어”`, `N. 장 제목.`(연대기 전설 목록) — 실수: 처음 올린 빌드는 이 3곳이 영어로 남았고 재업로드로 수정.
- 규칙 수정으로 src/00_i18n_ko3.js 와 ironvale.html 을 재업로드(커밋 모두 '게임: ').

## 라이브 확인 (I3)
- 페이지: https://sigco3111.github.io/ironvale-ko/ironvale.html?v=<난수> (캐시 비활성), 페이지 내 console.error/warn·window error·unhandledrejection 후킹.
- 메인 메뉴(캠페인 3개 이름·장 목록), 캠페인 소개문, 연대기(세계 6·왕국 5·전설 목록/결말), 스커미시 세력 설명·지도 설명, 1장 시작 브리핑(제목·소개 3문단·목표·시작) 한국어 확인. 콘솔 error/warning/uncaught/unhandledrejection 0건.
- 진행 중 대사(비트)는 사전에 전부 있음(스크립트 확인)이나 라이브 재생은 확인하지 않음(소프트웨어 렌더링으로 게임 시간이 느림).
