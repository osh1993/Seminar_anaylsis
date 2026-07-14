---
name: seminar-web-orchestrator
description: 세미나 자료(모델경량화 PDF) 해설 웹페이지 파이프라인 오케스트레이터. 웹페이지 생성/재생성/업데이트, 해설 수정·보완, 특정 슬라이드 다시 해설, 검색·Q&A 기능 수정, QA 재검증, 새 PDF 추가, "이전 결과 기반으로 개선" 등 세미나 해설 관련 모든 작업 요청 시 반드시 이 스킬을 사용할 것.
---

# 세미나 해설 웹 오케스트레이터

**실행 모드: 하이브리드** — 해설(Phase 2)은 구간별 독립 작업이라 서브 에이전트 팬아웃, 빌드→QA(Phase 4~5)는 생성-검증 패턴(서브 순차). 팀 통신이 필요한 상호 조율 지점이 없어 팀 모드 오버헤드를 배제했다. 일관성은 공유 스킬(slide-interpretation)의 스키마·인용 규칙으로 확보한다.

## Phase 0: 컨텍스트 확인
1. `_workspace/` 존재 여부와 산출물 단계(01_extract → 02_interpret → 03_references → webpage → 04_qa_report)를 확인한다.
2. 실행 모드 결정:
   - 산출물 없음 → **초기 실행** (Phase 1부터)
   - 부분 수정 요청 (예: "day1 50~60 해설 다시", "검색 기능 고쳐줘") → **부분 재실행**: 해당 Phase의 해당 에이전트만 재호출 후, 하류 Phase(빌드·QA)를 연쇄 갱신
   - 새 PDF 추가 → 기존 `_workspace/`를 `_workspace_prev/`로 이동 후 초기 실행

## Phase 1: 추출 (스크립트, 에이전트 불요)
`slide-extraction` 스킬대로 실행. 산출: `01_extract_day{N}.json`, `slides/`.

## Phase 2: 해설 (서브 에이전트 팬아웃)
- 구간 분할: day별 페이지를 ~36p 단위 구간으로 분할해 에이전트 병렬 팬아웃 (구간당 1 에이전트). PDF 갱신 시에는 전체 재해설 대신 `_workspace/update_day{N}/` 방식의 텍스트 대조(compare.py/remap.py 참고)로 변경 슬라이드만 재해설하고 나머지는 태그 재매핑 후 재사용한다.
- 각 에이전트: `slide-interpreter` 정의 적용, `model: "opus"`, `run_in_background: true`
- 프롬프트에 포함할 것: 에이전트 정의 파일 경로(.claude/agents/slide-interpreter.md)와 slide-interpretation 스킬 경로를 읽으라는 지시, 담당 day/페이지 범위, 입력/출력 파일 경로
- 산출: `02_interpret_day{d}_{start:03d}-{end:03d}.json` ×12

## Phase 2.5: 강의 실황 오버레이 (서브 에이전트 팬아웃, 선택)
강의 녹취록(transcript `.md`)을 반영하라는 요청 시 실행한다. 해설(explanation)을 덮어쓰지 않고 별도 오버레이로 강사 구술 서사를 덧입힌다.
- 녹취록 topic을 슬라이드 페이지에 매핑한 뒤, day별 페이지를 ~35p 구간으로 나눠 `slide-interpreter`를 강의 실황 모드로 팬아웃(`model:"opus"`, background). 각 에이전트 프롬프트에 담당 범위·녹취록 파일·topic↔page 매핑·중복 회피용 기존 해설 경로를 준다.
- 산출: `_workspace/05_lecture_day{d}_{start:03d}-{end:03d}.json` (스키마·규칙은 `slide-interpretation` 스킬의 "강의 실황 오버레이" 절).
- build_data.py가 자동 병합(→ 슬라이드별 `lecture_note` + `qa.from_lecture`). Day별 독립 파일이라 Day2 녹취록은 나중에 파일만 추가하면 반영된다.

## Phase 3: 참조 큐레이션 (서브 1)
`reference-curator` 호출 (Phase 2 완료 후 — 해설의 references까지 통합해야 하므로). 산출: `03_references.json`.

## Phase 4: 웹 빌드 (서브 1)
`web-builder` 호출, `webpage-build` 스킬 준수. 산출: `webpage/` 일체.

## Phase 5: QA (생성-검증)
`qa-verifier` 호출 (**general-purpose 타입** — 스크립트 실행 필요), `citation-qa` 스킬 준수. 산출: `04_qa_report.md`.
- 치명/중대 결함 발견 시: 담당 에이전트(web-builder 또는 slide-interpreter)를 결함 목록과 함께 재호출 → 수정 후 qa-verifier 재검증. **최대 2회 반복**, 그 후에도 남으면 잔여 결함을 사용자에게 보고.

## 데이터 전달 (파일 기반)
`_workspace/{단계번호}_{산출물}.json` 컨벤션. 중간 산출물은 삭제하지 않는다(감사 추적). 최종 산출물만 `webpage/`.

## 에러 핸들링
- 해설 에이전트 1개 실패 → 1회 재시도 → 재실패 시 해당 구간 없이 진행하되 web-builder에 누락 구간을 알리고("해설 준비 중" 처리) 최종 보고에 명시.
- 상충 데이터(같은 슬라이드에 두 해설) 발생 시 삭제하지 말고 나중 것을 채택, 보고서에 병기.

## 테스트 시나리오
- **정상 흐름**: 초기 실행 → 12구간 해설 완료 → 참조 137건 통합 → webpage 생성 → QA 치명 0건 → 사용자에게 webpage/index.html 안내.
- **에러 흐름**: day2 구간 3 에이전트가 스키마 위반 JSON 출력 → QA 검사 1에서 태그 위반 검출 → slide-interpreter를 해당 구간만 재호출 → 재검증 통과.
