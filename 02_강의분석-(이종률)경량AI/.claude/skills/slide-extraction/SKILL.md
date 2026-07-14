---
name: slide-extraction
description: 세미나 PDF에서 슬라이드별 이미지(PNG)/텍스트/URL을 추출하여 _workspace에 저장. PDF 추출, 슬라이드 이미지 재생성, 새 PDF 추가, 추출 재실행 요청 시 반드시 이 스킬을 사용할 것.
---

# 슬라이드 추출

## 실행
```
python -X utf8 .claude/skills/slide-extraction/scripts/extract_slides.py
```
결정적 스크립트이므로 에이전트 판단 없이 그대로 실행한다. 소요 약 1~2분.

## 산출물
- `_workspace/slides/day{N}/{page:03d}.png` — 슬라이드 렌더링 (1.5배)
- `_workspace/01_extract_day{N}.json` — `[{day, page, text, urls, image}]`

`urls`는 PDF 하이퍼링크와 본문 정규식 매칭의 합집합이다. 슬라이드에 눈에 보이는 출처 표기("출처: https://...")가 여기 포함된다.

## 새 PDF 추가 시
스크립트 상단 `PDFS` 리스트에 `(day번호, 파일명)`을 추가한 뒤 재실행한다. 기존 day 출력은 덮어쓴다.

## 주의
- 렌더링 배율을 바꾸면(기본 1.5) 웹페이지 이미지가 모두 재생성되므로 webpage/slides 복사도 다시 해야 한다.
- 텍스트 추출이 빈약한 슬라이드(그림 중심)는 정상이다 — 해설 단계에서 이미지를 직접 읽어 보완한다.
