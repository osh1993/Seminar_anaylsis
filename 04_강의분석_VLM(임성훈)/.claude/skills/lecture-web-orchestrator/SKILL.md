---
name: lecture-web-orchestrator
description: 폴더의 세미나/강의 발표자료(PDF/PPTX)를 분석해 인터랙티브 교육 해설 웹페이지를 만드는 전체 워크플로우를 조율하는 오케스트레이터. "발표자료 해설 웹페이지 만들어줘", "강의 분석 사이트", "세미나 인터랙티브 설명 페이지", 그리고 후속 요청("다시 생성", "재실행", "업데이트", "수정", "보완", "특정 섹션만 다시", "이전 결과 기반 개선") 시 사용. VLM/시각인지 발표자료 해설 작업의 진입점.
---

# Lecture → Interactive Web 오케스트레이터

발표자료를 쉽게·정확히·인터랙티브하게 해설하는 웹페이지를 만든다. 출처(슬라이드)와 참조 논문을 정밀히 표기하는 것이 최우선 원칙.

## 실행 모드
하이브리드: **추출(인라인) → 병렬 콘텐츠 생성(서브) → 통합 빌드(서브) → QA(서브)**. 모든 Agent 호출은 `model: "opus"`.

## Phase 0: 컨텍스트 확인
- `_workspace/` 존재 + 부분 수정 요청 → **부분 재실행**(해당 에이전트만, 기존 JSON 읽고 개선)
- `_workspace/` 존재 + 새 자료 → **새 실행**(기존을 `_workspace_prev/`로 이동)
- 미존재 → **초기 실행**

## Phase 1: 추출 (인라인)
1. 폴더의 PDF/PPTX 탐색 → `_workspace/extract.py`로 페이지별 텍스트(md) + 페이지 PNG 렌더(2x) + manifest.json 생성.
2. 페이지 PNG는 `site/assets/slides/{deck}/pNNN.png`에도 복제(웹에서 그림으로 사용).
3. 텍스트 덤프를 읽어 발표자료 구조(섹션·페이지 범위)를 파악하고 섹션 분할표를 만든다.

## Phase 2: 인용 DB + 흐름 설계 (병렬 서브)
- `reference-curator` → `_workspace/references.json`
- `visual-flow-designer` → `_workspace/flow.json`, `_workspace/figures.json`
두 작업은 독립적이므로 병렬 실행.

## Phase 3: 섹션별 개념 해설 (병렬 서브, 팬아웃)
섹션 분할표의 각 섹션마다 `content-interpreter`를 병렬 스폰. 각 에이전트는 담당 페이지 이미지를 읽고 `_workspace/content/{section_id}.json` 생성. references.json 키를 참조.

## Phase 4: 웹 빌드 (서브, 팬인)
`web-builder`가 content/*.json + references.json + flow.json + figures.json을 인라인하여 `site/` 단일 페이지 앱 빌드. 기술 흐름 구성도·개념 카드·Q&A·라이트박스·출처 배지·논문 링크 포함.

## Phase 5: QA (서브)
`qa-verifier`(general-purpose)가 출처↔슬라이드, 논문 링크, 그림 경로, 데이터-렌더 정합, Q&A 동작을 교차 검증 → `_workspace/qa_report.md`. critical/major는 해당 에이전트 1회 재호출로 수정 후 재검증.

## 데이터 전달
- 파일 기반(`_workspace/`)이 1차. 중간 산출물 보존(감사용). 최종 산출물은 `site/`.
- 파일명: `content/{section_id}.json`, `references.json`, `flow.json`, `figures.json`, `qa_report.md`.

## 에러 핸들링
- 에이전트 1회 재시도 후 실패 시 해당 섹션 없이 진행하고 사이트에 "준비 중" + qa_report에 누락 명시.
- 상충 인용/내용은 삭제하지 않고 출처 병기.
- arXiv 링크 불확실 시 지어내지 말고 검색 링크 또는 비활성 처리.

## 공유 JSON 스키마
- content: concept-explainer 스킬 참조
- references: reference-linker 스킬 참조
- flow: `{ tracks:[...], nodes:[{id,label,track,one_liner,models:[],section_id,source_slides:[]}], edges:[{from,to,kind}] }`
- figures: `{ figures:[{id,deck,slide,image,caption,node_id,source_slides:[]}] }`

## 테스트 시나리오
- 정상: PDF 2개 → 추출 → 인용/흐름 → 10섹션 해설 → 빌드 → QA 통과 → `site/index.html` 브라우저 오픈.
- 에러: 한 섹션 에이전트 실패 → 나머지 9섹션으로 빌드, 해당 섹션 "준비 중", qa_report에 기록.
- 후속: "사전학습 섹션 더 쉽게" → content-interpreter만 부분 재실행 → web-builder 부분 갱신.
