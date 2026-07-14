---
name: slide-extraction
description: 세미나 폴더의 PDF에서 슬라이드별 이미지(PNG)/텍스트/URL을 추출하여 해당 폴더의 _workspace에 저장. PDF 추출, 슬라이드 이미지 재생성, 새 세미나 폴더/PDF 추가, 추출 재실행 요청 시 반드시 이 스킬을 사용할 것.
---

# 슬라이드 추출

## 실행
```
python -X utf8 .claude/skills/slide-extraction/scripts/extract_slides.py "<세미나폴더>"
```
결정적 스크립트이므로 에이전트 판단 없이 그대로 실행한다. PDF 100페이지당 약 30초.

- PDF를 지정하지 않으면 폴더 내 `*.pdf`를 이름순 자동 발견 — **파일명 순서가 doc 번호(1, 2, ...)가 되므로, 갱신본/구버전이 섞여 있으면 처리할 PDF를 인자로 명시**한다:
  `... extract_slides.py "<폴더>" "1일차.pdf" "2일차.pdf"`
- 특정 doc만 재추출: `--doc N` (PDF 목록은 동일하게 유지)
- 스모크 테스트: `--limit 3 --out <임시폴더>`

## 산출물
- `{폴더}/_workspace/slides/day{N}/{page:03d}.png` — 슬라이드 렌더링 (1.5배)
- `{폴더}/_workspace/01_extract_day{N}.json` — `[{day, page, text, urls, image}]`
- `{폴더}/_workspace/00_sources.json` — doc 번호↔PDF 매핑

`urls`는 PDF 하이퍼링크와 본문 정규식 매칭의 합집합이다. 슬라이드에 보이는 출처 표기("출처: https://...")가 여기 포함된다.

## PDF 갱신본 반영 시
전체 재해설 대신 텍스트 대조로 변경 슬라이드만 식별한다: 구버전과 신버전의 01_extract를 페이지 텍스트로 매칭해 (재사용/변경/신규)를 분류하고, 재사용분은 태그 재매핑, 변경·신규분만 재해설한다. 선례 구현: `02_강의분석-(이종률)경량AI/_workspace/update_day2/compare.py`.

## 주의
- 렌더링 배율을 바꾸면(기본 1.5) 웹페이지 이미지가 모두 재생성되므로 webpage/slides 복사도 다시 해야 한다.
- 텍스트 추출이 빈약한 슬라이드(그림 중심)는 정상이다 — 해설 단계에서 이미지를 직접 읽어 보완한다.
- PPTX 등 PDF가 아닌 자료는 먼저 PDF로 변환한다 (LibreOffice `soffice --headless --convert-to pdf` 가능 시).
