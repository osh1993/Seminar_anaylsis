/* 메인 앱: 흐름도·섹션·카드·참조·Q&A·라이트박스 렌더 및 인터랙션 */
(function () {
  "use strict";
  var D = window.SITE_DATA;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var el = function (tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  };
  var esc = function (s) { return (s == null ? "" : String(s)).replace(/[&<>"]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var pad = function (n) { return String(n).padStart(3, "0"); };
  var deckNo = { vlm: "자료2", vision: "자료1" };
  var slidePath = function (deck, n) { return "assets/slides/" + deck + "/p" + pad(n) + ".png"; };

  // 섹션 짧은 라벨
  var SHORT = {
    "vlm-foundation": "파운데이션", "vlm-data": "데이터", "vlm-pretraining": "사전학습",
    "vlm-adaptation": "적응", "vlm-future": "미래 방향",
    "vision-research": "시각인지", "vision-foundation": "딥러닝·로봇", "vision-sim2real": "Sim2Real",
    "vision-wfm": "World Model", "vision-meffit": "물리기반 생성"
  };

  /* ---------- 인덱스 구축 ---------- */
  var nodeById = {}, nodeSection = {};
  D.flow.nodes.forEach(function (n) { nodeById[n.id] = n; if (n.section_id) nodeSection[n.id] = n.section_id; });
  var figBySlide = {}; // "deck-n" -> figure
  D.figures.forEach(function (f) { figBySlide[f.deck + "-" + f.slide] = f; });
  var sectionById = {};
  D.sections.forEach(function (s) { sectionById[s.section_id] = s; });

  /* ---------- 히어로 통계 ---------- */
  (function () {
    var stats = [
      { n: D.meta.stats.cards, l: "개념 카드" },
      { n: D.meta.stats.papers, l: "참조 논문" },
      { n: "178", l: "발표 슬라이드" },
      { n: D.meta.stats.sections, l: "주제 섹션" }
    ];
    var wrap = $("#heroStats");
    stats.forEach(function (s) {
      var c = el("div", "stat");
      c.appendChild(el("div", "stat__n", s.n));
      c.appendChild(el("div", "stat__l", s.l));
      wrap.appendChild(c);
    });
  })();

  /* ---------- 상단 네비게이션 ---------- */
  (function () {
    var wrap = $("#navLinks");
    D.order.forEach(function (sid) {
      var a = el("a", null, esc(SHORT[sid] || sid));
      a.href = "#sec-" + sid;
      a.dataset.sid = sid;
      wrap.appendChild(a);
    });
  })();

  /* ---------- 기술 흐름 구성도 ---------- */
  (function () {
    var map = $("#flowMap");
    var tracks = D.flow.tracks.filter(function (t) { return t.id === "vlm" || t.id === "vision"; });

    tracks.forEach(function (tr) {
      var box = el("div", "track track--" + tr.id);
      var head = el("div", "track__head");
      head.appendChild(el("span", "track__tag", tr.id === "vlm" ? "자료2 · 교육 트랙" : "자료1 · 연구 트랙"));
      head.appendChild(el("span", "track__title", esc(tr.label)));
      head.appendChild(el("span", "track__desc", esc(tr.desc || "")));
      box.appendChild(head);

      var rail = el("div", "rail");
      // 트랙 노드를 등장 순서대로 섹션 단위로 그룹화
      var nodes = D.flow.nodes.filter(function (n) { return n.track === tr.id; });
      var groups = [];
      nodes.forEach(function (n) {
        var sid = n.section_id || n.id;
        var g = groups[groups.length - 1];
        if (!g || g.sid !== sid) { g = { sid: sid, nodes: [] }; groups.push(g); }
        g.nodes.push(n);
      });
      groups.forEach(function (g, gi) {
        var stage = el("div", "stage");
        var b = el("button", "stage__box");
        b.dataset.target = g.sid;
        b.innerHTML = '<div class="stage__k">STEP ' + (gi + 1) + '</div>' +
          '<div class="stage__t">' + esc(SHORT[g.sid] || g.sid) + '</div>';
        var nn = el("div", "stage__nodes");
        g.nodes.forEach(function (n) {
          var lbl = n.label.replace(/^\s*\d+[\.\)]\s*/, "").slice(0, 22);
          nn.appendChild(el("span", "chip", esc(lbl)));
        });
        b.appendChild(nn);
        b.title = (g.nodes[0].one_liner || "").slice(0, 120);
        b.addEventListener("click", function () { jumpTo(g.sid); });
        stage.appendChild(b);
        if (gi < groups.length - 1) stage.appendChild(el("div", "arrow", "→"));
        rail.appendChild(stage);
      });
      box.appendChild(rail);
      map.appendChild(box);
    });

    // 교차(공유) 개념 밴드
    var crossNodes = D.flow.nodes.filter(function (n) { return n.track !== "vlm" && n.track !== "vision"; });
    if (crossNodes.length) {
      var cb = el("div", "cross");
      cb.appendChild(el("div", "cross__h", "🔗 두 자료가 공유하는 핵심 개념 (교차 연결)"));
      var items = el("div", "cross__items");
      crossNodes.forEach(function (cn) {
        // 연결된 실제 노드들의 섹션 수집
        var linked = D.flow.edges.filter(function (e) { return e.from === cn.id || e.to === cn.id; })
          .map(function (e) { return e.from === cn.id ? e.to : e.from; })
          .map(function (id) { return nodeSection[id]; })
          .filter(function (x, i, a) { return x && a.indexOf(x) === i; });
        var it = el("div", "cross__item");
        var sub = linked.map(function (s) { return SHORT[s] || s; }).join(" ↔ ");
        it.innerHTML = esc(cn.label.replace(/^\s*\d+[\.\)]\s*/, "")) + "<small>" + esc(sub || "공유 개념") + "</small>";
        it.addEventListener("click", function () { if (linked[0]) jumpTo(linked[0]); });
        items.appendChild(it);
      });
      cb.appendChild(items);
      map.appendChild(cb);
    }
  })();

  /* ---------- 섹션 + 카드 ---------- */
  function paperChip(key) {
    var r = D.references[key];
    if (!r) return null;
    var label = r.short || r.title || key;
    var a;
    if (r.url) {
      a = el("a", "paper", "📄 " + esc(label));
      a.href = r.url; a.target = "_blank"; a.rel = "noopener";
      a.title = (r.title || "") + (r.venue ? " · " + r.venue : "");
    } else {
      a = el("a", "paper paper--dead", "🔍 " + esc(label));
      a.href = "https://scholar.google.com/scholar?q=" + encodeURIComponent(r.title || label);
      a.target = "_blank"; a.rel = "noopener";
      a.title = "원문 링크 미상 — 제목으로 검색: " + (r.title || label);
    }
    return a;
  }

  function srcBadge(deck, n) {
    var b = el("button", "src", "📄 " + deckNo[deck] + "·p" + n);
    b.addEventListener("click", function () { openLightbox(deck, n); });
    return b;
  }

  function figThumb(deck, n) {
    var f = figBySlide[deck + "-" + n];
    var t = el("button", "fig");
    var img = el("img");
    img.src = slidePath(deck, n);
    img.alt = (f ? f.caption : deckNo[deck] + " " + n + "페이지 슬라이드");
    img.loading = "lazy";
    t.appendChild(img);
    t.appendChild(el("div", "fig__cap", esc(f ? f.caption : deckNo[deck] + " · p" + n)));
    t.addEventListener("click", function () { openLightbox(deck, n); });
    return t;
  }

  function renderCard(card, idx, deck) {
    var c = el("article", "card");
    var btn = el("button", "card__btn");
    btn.setAttribute("aria-expanded", "false");
    btn.innerHTML = '<span class="card__idx">' + (idx + 1) + '</span>' +
      '<span class="card__head"><span class="card__headline">' + esc(card.headline) + '</span></span>' +
      '<span class="card__toggle">▾</span>';
    var body = el("div", "card__body");
    var inner = el("div", "card__bodyInner");
    var pad2 = el("div", "card__pad");

    if (card.intuition) {
      var iv = el("div", "lvl lvl--intuition");
      iv.appendChild(el("div", "lvl__k", "💡 쉽게 말하면"));
      iv.appendChild(el("p", null, esc(card.intuition)));
      pad2.appendChild(iv);
    }
    if (card.explanation) {
      var ev = el("div", "lvl lvl--explain");
      ev.appendChild(el("div", "lvl__k", "📖 자세한 설명"));
      ev.appendChild(el("p", null, esc(card.explanation)));
      pad2.appendChild(ev);
    }
    if (card.why) {
      var wv = el("div", "lvl lvl--why");
      wv.appendChild(el("div", "lvl__k", "🎯 왜 중요한가"));
      wv.appendChild(el("p", null, esc(card.why)));
      pad2.appendChild(wv);
    }
    // 비표준 출처 메모(자체연구 학회명 등)
    var note = card.source_slides_note || card.source_note;
    if (note) pad2.appendChild(el("div", "note", "📌 출처: " + esc(note)));

    // 개념 그림 (figure_slides)
    if (card.figure_slides && card.figure_slides.length) {
      pad2.appendChild(el("div", "figstrip__label", "관련 슬라이드 그림"));
      var strip = el("div", "figstrip");
      card.figure_slides.forEach(function (n) { strip.appendChild(figThumb(deck, n)); });
      pad2.appendChild(strip);
    }
    inner.appendChild(pad2);
    body.appendChild(inner);

    // 푸터: 출처 슬라이드 + 논문 + 신뢰도
    var foot = el("div", "card__foot");
    (card.source_slides || []).forEach(function (n) { foot.appendChild(srcBadge(deck, n)); });
    (card.papers || []).forEach(function (k) { var p = paperChip(k); if (p) foot.appendChild(p); });
    if (card.confidence && card.confidence !== "high") {
      foot.appendChild(el("span", "conf conf--" + card.confidence,
        card.confidence === "low" ? "추정 포함" : "보통 신뢰도"));
    }

    btn.addEventListener("click", function () {
      var open = c.classList.toggle("is-open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    });
    c.appendChild(btn);
    c.appendChild(body);
    if (foot.childNodes.length) c.appendChild(foot);
    return c;
  }

  (function () {
    var wrap = $("#sections");
    D.sections.forEach(function (sec) {
      var s = el("section", "section");
      s.id = "sec-" + sec.section_id;
      s.dataset.deck = sec.deck;
      var head = el("div", "section__head");
      head.appendChild(el("span", "badge badge--" + sec.deck,
        deckNo[sec.deck] + " · " + (sec.deck === "vlm" ? "비전-언어 사전학습" : "시각인지·World Model")));
      head.appendChild(el("h2", "section__title", esc(sec.title)));
      var pr = sec.page_range ? ("슬라이드 p" + sec.page_range[0] + "–p" + sec.page_range[1] + " · 카드 " + sec.cards.length + "개") : "";
      head.appendChild(el("div", "section__meta", pr));
      if (sec.summary) head.appendChild(el("p", "section__summary", esc(sec.summary)));
      s.appendChild(head);

      var cards = el("div", "cards");
      sec.cards.forEach(function (c, i) { cards.appendChild(renderCard(c, i, sec.deck)); });
      s.appendChild(cards);
      wrap.appendChild(s);
    });
  })();

  /* ---------- 참조 논문 ---------- */
  (function () {
    var keys = Object.keys(D.references);
    var verified = keys.filter(function (k) { return D.references[k].url; }).length;
    $("#refMeta").textContent = "(총 " + keys.length + "편 · 링크 " + verified + "편)";
    var list = $("#refList");
    function render(filter) {
      list.innerHTML = "";
      keys.map(function (k) { return D.references[k]; })
        .filter(function (r) {
          if (!filter) return true;
          var hay = (r.short + " " + r.title + " " + (r.authors || "") + " " + (r.venue || "")).toLowerCase();
          return hay.indexOf(filter) !== -1;
        })
        .sort(function (a, b) { return (b.year || 0) - (a.year || 0); })
        .forEach(function (r) {
          var d = el("div", "ref");
          var top = el("div", "ref__top");
          top.appendChild(el("div", "ref__short", esc(r.short || r.title)));
          top.appendChild(el("div", "ref__venue", esc((r.venue || "") + (r.year ? " · " + r.year : ""))));
          d.appendChild(top);
          var ttl = el("div", "ref__title");
          if (r.url) ttl.innerHTML = '<a href="' + esc(r.url) + '" target="_blank" rel="noopener">' + esc(r.title) + ' ↗</a>';
          else ttl.innerHTML = '<a href="https://scholar.google.com/scholar?q=' + encodeURIComponent(r.title) + '" target="_blank" rel="noopener">' + esc(r.title) + ' 🔍</a>';
          d.appendChild(ttl);
          var bot = el("div", "ref__bottom");
          if (r.authors) bot.appendChild(el("span", "ref__cite", esc(r.authors)));
          if (r.url) { var a = el("a", "ref__link", r.arxiv ? "arXiv:" + r.arxiv : "원문 ↗"); a.href = r.url; a.target = "_blank"; a.rel = "noopener"; bot.appendChild(a); }
          else bot.appendChild(el("span", "ref__no-link", "원문 링크 미상 · 제목 검색"));
          d.appendChild(bot);
          list.appendChild(d);
        });
    }
    render("");
    $("#refSearch").addEventListener("input", function (e) { render(e.target.value.trim().toLowerCase()); });
  })();

  /* ---------- 이동/하이라이트 ---------- */
  function jumpTo(sid) {
    var t = document.getElementById("sec-" + sid);
    if (!t) return;
    t.scrollIntoView({ behavior: "smooth", block: "start" });
    t.querySelectorAll(".card").forEach(function (c) { c.classList.add("is-open"); });
    var box = t.querySelector(".section__head");
    box.animate([{ background: "rgba(139,123,240,.18)" }, { background: "transparent" }], { duration: 1200 });
  }
  window.__jumpTo = jumpTo;

  /* ---------- 라이트박스 ---------- */
  var lb = $("#lightbox"), lbImg = $("#lbImg"), lbCap = $("#lbCap");
  function openLightbox(deck, n) {
    lbImg.src = slidePath(deck, n);
    var f = figBySlide[deck + "-" + n];
    lbImg.alt = f ? f.caption : (deckNo[deck] + " " + n + "페이지");
    lbCap.innerHTML = "<b>" + deckNo[deck] + " · " + n + "페이지</b>" +
      (f ? "<br>" + esc(f.caption) : "");
    lb.hidden = false;
    document.body.style.overflow = "hidden";
  }
  function closeLb() { lb.hidden = true; lbImg.src = ""; document.body.style.overflow = ""; }
  $("#lbClose").addEventListener("click", closeLb);
  $("#lbScrim").addEventListener("click", closeLb);

  /* ---------- 덱 필터 ---------- */
  (function () {
    $("#deckSeg").addEventListener("click", function (e) {
      var b = e.target.closest(".seg__btn"); if (!b) return;
      $("#deckSeg").querySelectorAll(".seg__btn").forEach(function (x) { x.classList.remove("is-active"); });
      b.classList.add("is-active");
      var deck = b.dataset.deck;
      document.querySelectorAll(".section").forEach(function (s) {
        s.style.display = (deck === "all" || s.dataset.deck === deck) ? "" : "none";
      });
      $("#navLinks").querySelectorAll("a").forEach(function (a) {
        var sd = sectionById[a.dataset.sid];
        a.style.display = (deck === "all" || (sd && sd.deck === deck)) ? "" : "none";
      });
    });
  })();

  /* ---------- 스크롤스파이 + 진행바 ---------- */
  (function () {
    var links = {};
    $("#navLinks").querySelectorAll("a").forEach(function (a) { links[a.dataset.sid] = a; });
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          var sid = en.target.id.replace("sec-", "");
          Object.keys(links).forEach(function (k) { links[k].classList.toggle("is-active", k === sid); });
        }
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    document.querySelectorAll(".section").forEach(function (s) { obs.observe(s); });
    window.addEventListener("scroll", function () {
      var h = document.documentElement;
      var p = h.scrollTop / (h.scrollHeight - h.clientHeight);
      $("#navProgress").style.width = (p * 100) + "%";
    }, { passive: true });
  })();

  /* ---------- Q&A 패널 ---------- */
  (function () {
    var panel = $("#qaPanel"), input = $("#qaInput"), results = $("#qaResults"), faqWrap = $("#qaFaq");
    function open() { panel.hidden = false; document.body.style.overflow = "hidden"; setTimeout(function () { input.focus(); }, 60); }
    function close() { panel.hidden = true; document.body.style.overflow = ""; }
    $("#openQa").addEventListener("click", open);
    $("#openQa2").addEventListener("click", open);
    $("#qaClose").addEventListener("click", close);
    $("#qaScrim").addEventListener("click", close);

    // FAQ 칩
    window.QAEngine.faq.forEach(function (f) {
      var chip = el("button", "qa__faqchip", esc(f.q));
      chip.addEventListener("click", function () { input.value = f.q; runSearch(f.q); });
      faqWrap.appendChild(chip);
    });

    function srcRow(deck, slides, papers, sid) {
      var row = el("div", "qres__src");
      (slides || []).forEach(function (n) { row.appendChild(srcBadge(deck, n)); });
      (papers || []).forEach(function (k) { var p = paperChip(k); if (p) row.appendChild(p); });
      if (sid) {
        var j = el("button", "qres__jump", "해당 해설로 →");
        j.addEventListener("click", function () { close(); setTimeout(function () { jumpTo(sid); }, 120); });
        row.appendChild(j);
      }
      return row;
    }

    function runSearch(q) {
      var out = window.QAEngine.search(q);
      results.innerHTML = "";
      if (!q.trim()) return;
      if (out.answer) {
        var f = out.answer;
        var box = el("div", "qres qres--answer");
        box.appendChild(el("div", "qres__q", "✅ " + esc(f.q)));
        box.appendChild(el("div", "qres__a", esc(f.a)));
        box.appendChild(srcRow(f.deck, f.slides, f.papers, f.section));
        results.appendChild(box);
      }
      if (out.results.length) {
        results.appendChild(el("div", "figstrip__label", out.answer ? "관련 개념 카드" : "검색 결과 (관련 개념 카드)"));
        out.results.forEach(function (x) {
          var e = x.e;
          var box = el("div", "qres");
          box.appendChild(el("div", "qres__q", "📍 " + esc(e.headline)));
          box.appendChild(el("div", "qres__a", esc(e.sectionTitle)));
          box.appendChild(srcRow(e.deck, e.slides, e.papers, e.section_id));
          results.appendChild(box);
        });
      }
      if (!out.answer && !out.results.length) {
        results.appendChild(el("div", "qa__empty", "관련 내용을 찾지 못했습니다.<br>다른 키워드로 시도해 보세요 (예: CLIP, 사전학습, World Model, 적응)."));
      }
    }
    $("#qaForm").addEventListener("submit", function (e) { e.preventDefault(); runSearch(input.value); });

    // 전역 단축키 / ESC
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { if (!panel.hidden) close(); if (!lb.hidden) closeLb(); }
      if (e.key === "/" && document.activeElement.tagName !== "INPUT" && panel.hidden) { e.preventDefault(); open(); }
    });
  })();

})();
