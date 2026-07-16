---
name: reference-linker
description: 발표자료/논문에 등장하는 인용을 추출하여 arXiv 등 검증된 외부 링크가 달린 인용 DB(references.json)를 만드는 스킬. "참조 논문 링크", "출처 정리", "인용 DB 구축" 요청 시 사용. reference-curator 에이전트가 사용.
---

# Reference Linker — 인용 DB 구축 스킬

## 절차
1. 텍스트 덤프에서 `[n] 저자, "제목," 학회/arXiv:ID (연도)` 패턴을 모두 추출.
2. arXiv ID가 있으면 `https://arxiv.org/abs/{ID}`로 URL 생성. ID 형식: 신형 `YYMM.NNNNN`, 구형 `arch-ive/YYMMNNN`.
3. arXiv ID가 없으면 `arxiv:null, url:null`로 두되 제목·저자·학회를 정확히 보존(추후 검색용). 필요 시 WebSearch로 보강하되 **URL을 지어내지 않는다**.
4. 같은 논문은 통칭 키로 병합, `cited_in`에 모든 출현(deck, slide, ref_no) 수집.
5. 상충 표기는 `notes`에 병기(삭제 금지).

## 출력 스키마 (`_workspace/references.json`)
```json
{
  "clip": {
    "title": "Learning transferable visual models from natural language supervision",
    "short": "CLIP",
    "authors": "Radford et al.",
    "venue": "ICML 2021",
    "year": 2021,
    "arxiv": "2103.00020",
    "url": "https://arxiv.org/abs/2103.00020",
    "link_verified": true,
    "cited_in": [{"deck":"vlm","slide":17,"ref_no":5}],
    "notes": "슬라이드에 ICML20/ICML21 혼재 표기"
  }
}
```

## 핵심 규율
- 신뢰할 수 없는 URL은 만들지 않는다. arXiv ID가 텍스트에 있으면 그것이 1차 진실.
- 잘 알려진 논문(CLIP, MAE, SAM 등)의 arXiv ID는 텍스트에 ID가 없을 때 WebSearch로 확인 가능하나, 확인된 것만 `link_verified:true`.
