# 프로젝트: 세미나 분석 (Seminar_Analysis)

세미나/강의 발표자료 폴더(`NN_이름/`)를 분석해 인터랙티브 해설 웹페이지를 만들고 GitHub Pages에 게시하는 저장소.
게시 주소: https://osh1993.github.io/Seminar_anaylsis/ (원격: https://github.com/osh1993/Seminar_anaylsis, PUBLIC — 원본 PDF/zip/_workspace는 .gitignore로 게시 제외)

## 하네스: 세미나 해설 웹 파이프라인

**목표:** 발표자료 폴더를 받아 추출 → 구간 해설 → 개념 심층 리서치(웹 검색) → 참조 큐레이션 → 강조·연구 흐름 → 인터랙티브 웹 빌드 → QA → 웹 게시까지 수행한다.

**트리거:** 발표자료 분석/해설/웹페이지/개념 사전/검색·Q&A/QA/게시 관련 작업 요청 시 `seminar-analysis-orchestrator` 스킬을 사용하라. 단순 질문은 직접 응답 가능.
단, `02_강의분석-(이종률)경량AI/` 내부 작업은 그 폴더의 로컬 하네스(.claude)가 우선한다.

**변경 이력:**
| 날짜 | 변경 내용 | 대상 | 사유 |
|------|----------|------|------|
| 2026-07-14 | 초기 구성 (에이전트 5, 스킬 7) — 02 로컬 하네스를 루트로 일반화. 개념 심층 리서치(concept-researcher)·웹 게시(web-publish)·허브 인덱스 신설, 참조 웹 검증·강조/연구 흐름 뷰를 기본 파이프라인에 내장 | 전체 | 폴더 단위 범용 분석·게시 에이전트 요청 |
| 2026-07-14 | 두 모드 공존 체계: ① 모든 세미나 페이지에 "← 세미나 목록" 허브 복귀 링크 필수화, ② 📖 강의 노트 모드(09_note.json → note.html, 01 스타일 서사형) 신설 — 슬라이드 해설 모드와 상호 전환. 허브 카드를 모드별 진입 버튼으로 개편. 02 로컬 스킬에도 동일 명세 추가 | skills/slide-interpretation, webpage-build, 02/.claude/skills/(slide-interpretation, webpage-build) | 허브 복귀 링크 + 01 형식 설명 모드 공존 사용자 요청 |
