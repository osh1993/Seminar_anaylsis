# 강의분석 VLM (임성훈 교수) — 프로젝트 가이드

## 하네스: 발표자료 → 인터랙티브 해설 웹페이지

**목표:** 세미나 발표자료(VLM·시각인지)를 쉽고 정확하게, 인터랙티브하게 해설하는 웹페이지를 만든다. 모든 설명에 출처 슬라이드와 참조 논문을 정밀 표기한다.

**트리거:** 발표자료 해설/강의분석/인터랙티브 설명 사이트 제작·수정·재실행 요청 시 `lecture-web-orchestrator` 스킬을 사용하라. 단순 질문은 직접 응답 가능.

**구성:** 에이전트(`content-interpreter`, `reference-curator`, `visual-flow-designer`, `web-builder`, `qa-verifier`) + 스킬(`concept-explainer`, `reference-linker`, `interactive-web-builder`, `lecture-web-orchestrator`). 산출물은 `site/`, 중간물은 `_workspace/`.

**변경 이력:**
| 날짜 | 변경 내용 | 대상 | 사유 |
|------|----------|------|------|
| 2026-06-15 | 초기 구성 | 전체 | VLM 발표자료 해설 웹페이지 하네스 구축 |
