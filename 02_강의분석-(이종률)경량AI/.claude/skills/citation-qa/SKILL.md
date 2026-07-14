---
name: citation-qa
description: 해설-슬라이드 인용 정합성 및 웹페이지 기능 검증 방법론. 인용 검증, 품질 검사, QA, 정합성 확인, 검수 요청 시 반드시 이 스킬을 읽고 따를 것. qa-verifier 에이전트의 필수 스킬.
---

# 인용 정합성 QA 방법론

## 원칙
"파일이 있다"는 검증이 아니다. **경계면 양쪽을 동시에 읽고 내용을 맞대는 것**이 검증이다.
검증 스크립트와 결과는 `_workspace/qa/`에 남긴다 (재실행·감사 추적).

## 검사 1: 인용 태그 전수 검사 (스크립트)
`02_interpret_*.json`의 모든 텍스트 필드에서 `\[D(\d)-p(\d+)\]`를 추출해:
- day∈{1,2}, 유효 페이지 범위는 하드코딩하지 말고 **`01_extract_day{N}.json`의 슬라이드 수를 읽어** 판정 (현재 day1 221, day2 227) → 위반은 **치명**
- 태그도 (배경지식) 마커도 없는 explanation 문장 비율 계산 → 10% 초과 시 **중대**

## 검사 2: 인용 내용 표본 대조 (모델 판단)
day별 10개 이상 슬라이드를 균등 간격 추출하여, 해설과 원문 text(필요시 PNG)를 비교:
- 해설의 주장이 원문에 실제로 있는가? 없으면 **치명** (환각)
- 수치/기법명이 원문과 일치하는가? 불일치는 **중대**

## 검사 3: 참조 URL 전수 대조 (스크립트)
`02_*.json`의 references.url과 `03_references.json`의 url이 `01_extract_*.json`의 urls 합집합에 존재하는지 확인. 원문에 없는 URL은 **치명** (URL 환각). 단, 대소문자/말미 구두점 차이는 정규화 후 비교.
예외: `verified_manual:true` 항목은 슬라이드 원문에 없는 URL이 허용된다 — 사용자 요청으로 외부 검증(arXiv 등 원문 대조)을 거쳐 수동 등재한 링크이며, curate_refs.py의 MANUAL_URLS에 검증 근거가 기록되어 있어야 한다. 근거 기록이 없는 verified_manual은 **중대**.

## 검사 4: 웹 데이터 정합성 (스크립트)
- data.js 슬라이드 수 = `01_extract_day*.json` 슬라이드 수 합계 (현재 448 = day1 221 + day2 227), 해설 수 = 해설 JSON 합계
- 해설 JSON의 explanation과 data.js의 explanation 무작위 5건 문자열 일치
- 인용 태그가 링크로 변환되는지: app.js에 변환 정규식 존재 확인 + 태그 수 대조

## 검사 5: 웹 기능 정적 검증
- `node --check`로 JS 문법 (node 없으면 Python으로 괄호 균형이라도)
- index.html에 검색 input, Q&A input, 탭 요소 id가 존재하고 app.js가 해당 id를 참조하는지 교차 확인
- 이미지 경로 표본 10건이 실제 파일로 존재하는지

## 보고서: `_workspace/04_qa_report.md`
심각도별(치명/중대/경미) 결함 목록. 각 결함에 위치(파일, 슬라이드 키), 증거(기대 vs 실제), 수정 담당(web-builder | slide-interpreter | reference-curator)을 명시한다. 결함 0건이어도 수행한 검사와 표본 크기를 기록한다.
