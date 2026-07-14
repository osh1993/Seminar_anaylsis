---
name: seminar-analysis-orchestrator
description: 세미나/강의 발표자료 폴더를 분석해 인터랙티브 해설 웹페이지를 만들고 GitHub Pages에 게시하는 전체 파이프라인 오케스트레이터. 새 발표자료 폴더 추가·분석, 해설 웹페이지 생성/재생성/업데이트/수정/보완, 특정 슬라이드 다시 해설, 개념 사전 보강, 검색·Q&A 기능 수정, QA 재검증, 새 PDF/녹취록 추가, 웹 게시, "이전 결과 기반으로 개선", "다시 실행" 등 세미나 분석 관련 모든 작업 요청 시 반드시 이 스킬을 사용할 것.
---

# 세미나 분석 오케스트레이터

**실행 모드: 하이브리드** — 해설(Phase 2)·개념 리서치(Phase 3)는 구간/그룹별 독립 작업이라 서브 에이전트 팬아웃, 빌드→QA(Phase 6~7)는 생성-검증 패턴(서브 순차), 게시(Phase 8)는 오케스트레이터 직접 수행. 팀 통신이 필요한 상호 조율 지점이 없어 팀 모드 오버헤드를 배제했다. 일관성은 공유 스킬(slide-interpretation 등)의 스키마·인용 규칙으로 확보한다.

모든 Agent 호출: `model: "opus"`, `run_in_background: true`(팬아웃 시), 프롬프트에 **에이전트 정의 파일 경로와 필수 스킬 경로를 읽으라는 지시 + 담당 세미나 폴더 + 입출력 파일 경로**를 포함한다.

## Phase 0: 컨텍스트 확인
1. 대상 세미나 폴더를 식별한다 (루트의 `NN_이름/` 컨벤션, 새 자료면 다음 번호로 폴더 생성 권고).
2. `{폴더}/_workspace/` 존재 여부와 산출물 단계(00_sources → 01_extract → 02_interpret → 03_references → 05/06/07/08 → webpage → 04_qa_report)를 확인한다.
3. 실행 모드 결정:
   - 산출물 없음 → **초기 실행** (Phase 1부터)
   - 부분 수정 요청 (예: "doc1 50~60 다시", "검색 고쳐줘", "개념 X 보강") → **부분 재실행**: 해당 Phase의 해당 에이전트만 재호출 후, 하류 Phase(빌드·QA·게시)를 연쇄 갱신
   - 원본 PDF 갱신 → 텍스트 대조로 변경 슬라이드만 재해설 (slide-extraction 스킬 "PDF 갱신본 반영" 절)
   - 완전 새 실행 요청 → 기존 `_workspace/`를 `_workspace_prev/`로 이동 후 초기 실행
   - "게시만" → Phase 8만
4. 완성된 기존 세미나(예: 01, 02)는 명시적 요청 없이 재분석하지 않는다. 02 폴더 내부 작업은 그 폴더의 로컬 하네스(.claude)가 우선한다.

## Phase 1: 추출 (스크립트, 에이전트 불요)
`slide-extraction` 스킬대로 실행. 갱신본/구버전 PDF가 섞인 폴더면 처리할 PDF를 인자로 명시. 산출: `00_sources.json`, `01_extract_day{N}.json`, `slides/`.

## Phase 2: 해설 (서브 에이전트 팬아웃)
- doc별 페이지를 ~35p 단위 구간으로 분할해 병렬 팬아웃 (구간당 slide-interpreter 1개, `.claude/agents/slide-interpreter.md` + slide-interpretation 스킬).
- 산출: `02_interpret_day{d}_{start:03d}-{end:03d}.json`

## Phase 2.5: 강의 실황 오버레이 (선택, 팬아웃)
녹취록(.md)이 폴더에 있거나 반영 요청 시. 녹취록 topic↔페이지 매핑 후 ~35p 구간 팬아웃(slide-interpreter 강의 실황 모드). 산출: `05_lecture_day{d}_*.json`.

## Phase 3: 개념 심층 리서치 (서브 에이전트 팬아웃)
1. 오케스트레이터가 `02_interpret_*.json`의 `deep_dive_candidates`를 집계·중복 제거·별칭 통합해 개념 목록(15~40개)을 만든다.
2. 8~12개씩 그룹으로 나눠 concept-researcher 팬아웃 (`.claude/agents/concept-researcher.md` + concept-research 스킬). 웹 검색이 있어 구간 해설보다 오래 걸린다.
3. 산출: `08_concepts_{group:02d}.json`

## Phase 4: 참조 큐레이션 (서브 1)
reference-curator 호출 (Phase 2 완료 후). 서지-only 항목의 웹 검증 등재 포함. 산출: `03_references.json`.

## Phase 5: 종합 뷰 큐레이션 (서브 2, 병렬)
slide-interpreter 종합 큐레이션 모드 2개 병렬: ⭐강조(`06_highlights_day{N}.json`), 🧭연구 흐름(`07_flow_day{N}.json`).

## Phase 6: 웹 빌드 (서브 1)
web-builder 호출, webpage-build 스킬 준수. 산출: `{폴더}/webpage/` 일체 + 루트 허브 index.html 카드 갱신.

## Phase 7: QA (생성-검증)
qa-verifier 호출 (**general-purpose 타입** — 검증 스크립트 실행 필요), citation-qa 스킬 준수. 산출: `04_qa_report.md`.
- 치명/중대 결함 발견 시: 담당 에이전트를 결함 목록과 함께 재호출 → 수정 후 재검증. **최대 2회 반복**, 그 후에도 남으면 잔여 결함을 사용자에게 보고.

## Phase 8: 웹 게시 (오케스트레이터 직접)
`web-publish` 스킬대로 수행: 게시 전 점검(검사 7) → 커밋 → 푸시 → Pages 빌드 확인 → 게시 URL 보고.

## 데이터 전달 (파일 기반)
`{폴더}/_workspace/{단계번호}_{산출물}.json` 컨벤션. 중간 산출물은 삭제하지 않는다(감사 추적). 최종 산출물만 `{폴더}/webpage/`.

## 에러 핸들링
- 팬아웃 에이전트 1개 실패 → 1회 재시도 → 재실패 시 해당 구간/그룹 없이 진행하되 web-builder에 누락을 알리고("해설 준비 중" 처리) 최종 보고에 명시.
- 상충 데이터(같은 슬라이드에 두 해설, 같은 id의 두 개념) 발생 시 삭제하지 말고 나중 것을 채택, 보고서에 병기.
- 웹 검증 실패 개념은 `web_verified: false`로 표시하고 진행 — 게시를 막지 않는다.
- 푸시/Pages 실패는 web-publish 스킬의 주의 절 참조. 강제 푸시 금지.

## 실행 후
완료 보고에 게시 URL·QA 요약·누락 사항을 담고, 개선할 부분이 있는지 피드백을 요청한다. 피드백은 CLAUDE.md 변경 이력에 기록하며 해당 스킬/에이전트에 반영한다.

## 테스트 시나리오
- **정상 흐름**: `03_PE & Vibe Coding` 초기 실행 → 추출 → 구간 팬아웃 해설 → 개념 30개 리서치 → 참조 통합 → 강조/흐름 → webpage 생성+허브 카드 → QA 치명 0건 → 게시 → 사용자에게 https://osh1993.github.io/Seminar_anaylsis/ 하위 URL 안내.
- **에러 흐름**: 개념 그룹 2 에이전트가 검색 실패로 미검증 항목 산출 → QA 검사 4에서 중대 검출 → concept-researcher 해당 그룹만 재호출 → 재검증 통과 → 게시.
