---
name: concept-explainer
description: 학술 발표자료/슬라이드의 어려운 개념을 비전공자도 이해하도록 쉽게, 단계적으로, 출처를 정확히 명시하며 해설하는 스킬. 세미나·강의·논문 발표자료를 "쉽게 설명", "개념 정리", "해설 콘텐츠 생성"하라는 요청 시 반드시 사용. content-interpreter 에이전트가 사용.
---

# Concept Explainer — 개념 해설 생성 스킬

발표 슬라이드의 압축된 학술 내용을 정확성을 지키면서 쉽게 풀어 구조화 JSON으로 만든다.

## 절차
1. **담당 섹션의 페이지 이미지를 모두 Read** — 슬라이드는 그림 중심이므로 시각 확인이 필수. 텍스트 덤프는 보조.
2. **개념 단위로 분해** — 한 슬라이드 또는 연속 슬라이드 묶음을 하나의 개념 카드로.
3. **개념의 사다리로 서술** — 각 카드:
   - `headline`: 한 줄 핵심 (쉬운 말)
   - `intuition`: 비유 또는 직관적 그림
   - `explanation`: 정확한 설명 (2~5문장, 수식은 말로 풀이)
   - `why`: 왜 중요/등장했는가
4. **출처·근거 부착** — 각 카드에 `source_slides`, `papers`(references.json 키), 유용하면 `figure_slides`.
5. **정직성** — 슬라이드에 없는 보충 지식은 `inferred: true`. 불확실은 `confidence: "low"`.

## 출력 스키마 (`_workspace/content/{section_id}.json`)
```json
{
  "section_id": "vlm-pretraining",
  "deck": "vlm",
  "title": "사전학습: 모델은 어떻게 배우는가",
  "summary": "한 문단 섹션 개요",
  "page_range": [12, 37],
  "cards": [
    {
      "id": "itc-clip",
      "headline": "...", "intuition": "...", "explanation": "...", "why": "...",
      "source_slides": [17,18,19,21],
      "papers": ["clip","align"],
      "figure_slides": [17,21],
      "inferred": false, "confidence": "high"
    }
  ]
}
```

## 품질 기준
- 전문용어 첫 등장 시 괄호로 짧은 풀이를 단다(예: "대조학습(서로 맞는 쌍은 가깝게, 아닌 쌍은 멀게 미는 학습)").
- 한 카드는 한 개념만. 너무 길면 분할.
- 수식은 그대로 베끼지 말고 의미를 한국어로 설명하되, 핵심 기호는 보존.
