/* Q&A 검색 엔진 — 큐레이션 FAQ + 전체 카드 키워드 검색.
   백엔드 없이 동작하며, 모든 답변에 출처(섹션/슬라이드/논문)를 함께 반환한다. */
(function (global) {
  "use strict";
  var D = global.SITE_DATA;

  // 토크나이즈: 영문/숫자/한글 토큰 추출 (소문자화)
  function tokenize(s) {
    if (!s) return [];
    return (s.toLowerCase().match(/[a-z0-9]+|[가-힣]+/g) || [])
      .filter(function (t) { return t.length >= 1; });
  }

  // 동의어/키워드 보강 (한국어 질문 → 핵심 개념 토큰)
  var SYN = {
    "클립": "clip", "씨엘아이피": "clip", "대조": "contrastive itc",
    "마스킹": "mask mae bert mim mlm", "마스크": "mask mae bert",
    "사전학습": "pretrain pretraining", "적응": "adaptation finetune",
    "미세조정": "finetune fine-tuning adaptation", "제로샷": "zero-shot zeroshot",
    "파운데이션": "foundation", "토대모델": "foundation",
    "월드모델": "world model wfm cosmos", "코스모스": "cosmos",
    "확산": "diffusion", "디퓨전": "diffusion",
    "분할": "segmentation sam", "세그먼트": "segmentation sam",
    "로봇": "robot vla rt", "행동": "action vla", "자율주행": "autonomous driving",
    "비디오": "video", "영상": "video generation", "생성": "generation generative",
    "형태": "shape", "질감": "texture", "스타일": "style transfer",
    "데이터": "data dataset", "큐레이션": "curation filtering",
    "어텐션": "attention", "궤적": "trajectory meffit", "물리": "physics physical"
  };

  function expand(q) {
    var toks = tokenize(q);
    var extra = [];
    Object.keys(SYN).forEach(function (k) {
      if (q.indexOf(k) !== -1) extra = extra.concat(tokenize(SYN[k]));
    });
    return toks.concat(extra);
  }

  // 카드 코퍼스 구축
  var CORPUS = [];
  D.sections.forEach(function (sec) {
    sec.cards.forEach(function (c) {
      var text = [c.headline, c.intuition, c.explanation, c.why].join(" ");
      CORPUS.push({
        section_id: sec.section_id, sectionTitle: sec.title, deck: sec.deck,
        cardId: c.id, headline: c.headline,
        slides: c.source_slides || [], papers: c.papers || [],
        hayHead: c.headline.toLowerCase(),
        hayText: text.toLowerCase(),
        tokens: tokenize(text)
      });
    });
  });

  function scoreEntry(qTokens, qRaw, e) {
    var s = 0, hit = 0;
    qTokens.forEach(function (t) {
      if (e.hayHead.indexOf(t) !== -1) { s += 3; hit++; }
      else if (e.hayText.indexOf(t) !== -1) { s += 1; hit++; }
    });
    // 원문 구절 부분일치 보너스
    if (qRaw.length >= 2 && e.hayText.indexOf(qRaw) !== -1) s += 2;
    // 다어절 질의에서 여러 토큰이 함께 등장하면 가산(관련도 높은 카드 상위 노출)
    if (qTokens.length >= 2 && hit >= 2) s += hit;
    return s;
  }

  function searchFaq(qTokens, qRaw) {
    var best = null, bestScore = 0;
    D.faq.forEach(function (f) {
      var hay = (f.q + " " + f.a).toLowerCase();
      var s = 0;
      qTokens.forEach(function (t) { if (hay.indexOf(t) !== -1) s += (f.q.toLowerCase().indexOf(t) !== -1 ? 3 : 1); });
      if (qRaw.length >= 2 && f.q.toLowerCase().indexOf(qRaw) !== -1) s += 4;
      if (s > bestScore) { bestScore = s; best = f; }
    });
    return { faq: best, score: bestScore };
  }

  function search(query) {
    var qRaw = (query || "").trim().toLowerCase();
    var qTokens = expand(query);
    if (!qRaw) return { answer: null, results: [] };

    var faqHit = searchFaq(qTokens, qRaw);

    var scored = CORPUS.map(function (e) {
      return { e: e, score: scoreEntry(qTokens, qRaw, e) };
    }).filter(function (x) { return x.score > 0; })
      .sort(function (a, b) { return b.score - a.score; })
      .slice(0, 6);

    return {
      answer: (faqHit.score >= 4) ? faqHit.faq : null,
      results: scored
    };
  }

  global.QAEngine = { search: search, faq: D.faq };
})(window);
