/* ===== PE & Vibe Coding 세미나 해설 · 앱 로직 =====
   - 데이터는 data.js 의 window.SEMINAR_DATA 로 주입됨 (fetch 미사용, file:// 동작)
   - 8개 뷰: 슬라이드 / 개념 사전 / 강조 / 학습 흐름 / 검색 / Q&A / 참고문헌 / 내 메모
*/
(function () {
  "use strict";
  var D = window.SEMINAR_DATA;
  if (!D) { document.body.innerHTML = "<p>데이터 로드 실패: data.js 확인</p>"; return; }

  /* 슬라이드를 day, page 순으로 정렬한 배열/인덱스 준비 */
  var order = Object.keys(D.slides).sort(function (a, b) {
    var A = D.slides[a], B = D.slides[b];
    return A.day - B.day || A.page - B.page;
  });
  var indexOfId = {};
  order.forEach(function (id, i) { indexOfId[id] = i; });
  var currentId = order[0];

  /* 개념 id→개념 조회 맵 */
  var conceptById = {};
  (D.concepts || []).forEach(function (c) { conceptById[c.id] = c; });

  /* ---------- 유틸 ---------- */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function slideKey(day, page) { return "d" + day + "p" + page; }

  /* ---------- 메모 저장소 (localStorage, 브라우저별) ---------- */
  function memoKeyOf(id) { return "memo:" + id; }
  function getMemo(id) {
    try { return localStorage.getItem(memoKeyOf(id)) || ""; }
    catch (e) { return ""; }
  }
  function setMemo(id, val) {
    try {
      if (val && val.trim()) localStorage.setItem(memoKeyOf(id), val);
      else localStorage.removeItem(memoKeyOf(id));
    } catch (e) { /* localStorage 접근 불가 시 무시 */ }
  }
  function hasMemo(id) { return !!getMemo(id).trim(); }

  // 해설 텍스트 → 안전 HTML: 인용 태그 링크 + (배경지식)/(모델 지식) 배지 변환
  function renderText(raw) {
    var html = esc(raw);
    // (배경지식)·(모델 지식) 마커 → 회색 배지 (슬라이드 근거와 시각적으로 구분)
    html = html.replace(/\(배경지식\)/g, '<span class="bg-badge">배경지식</span>');
    html = html.replace(/\(모델 지식\)/g, '<span class="bg-badge model">모델 지식</span>');
    // 인용 태그 [D1-p23] → 슬라이드 점프 링크 (변환 누락 0건)
    html = html.replace(/\[D(\d+)-p(\d+)\]/g, function (m, d, p) {
      var id = "d" + d + "p" + p;
      var exists = D.slides[id] ? "" : " missing";
      return '<a class="cite-link' + exists + '" href="#' + id +
             '" data-jump="' + id + '">[D' + d + '-p' + p + ']</a>';
    });
    return html;
  }

  /* ---------- 뷰 전환 ---------- */
  var views = ["slides", "concepts", "highlights", "flow", "search", "qa", "refs", "memos"];
  function showView(name) {
    views.forEach(function (v) {
      document.getElementById("view-" + v).classList.toggle("active", v === name);
    });
    Array.prototype.forEach.call(document.querySelectorAll(".tab"), function (t) {
      t.classList.toggle("active", t.dataset.view === name);
    });
    if (name === "memos") buildMemos();
  }
  Array.prototype.forEach.call(document.querySelectorAll(".tab"), function (t) {
    t.addEventListener("click", function () { showView(t.dataset.view); });
  });

  /* ---------- 목차(TOC) ---------- */
  function buildTOC() {
    var toc = document.getElementById("toc");
    var html = "";
    var lastDay = null;
    D.sections.forEach(function (sec) {
      if (sec.day !== lastDay) {
        var dmeta = D.meta.days.filter(function (x) { return x.day === sec.day; })[0] || {};
        html += '<div class="day-title">' + esc(dmeta.title || ("Day " + sec.day)) + '</div>';
        lastDay = sec.day;
      }
      html += '<div class="sec-title">' + esc(sec.name) + '</div>';
      sec.pages.forEach(function (p) {
        var id = slideKey(sec.day, p);
        var s = D.slides[id];
        var label = (s && s.title) ? s.title : ("슬라이드 " + p);
        html += '<button class="toc-slide' + (hasMemo(id) ? ' has-memo' : '') + '" data-id="' + id + '">' +
                '<span class="pnum">p' + p + '</span> ' + esc(label) +
                '<span class="memo-dot" title="메모 있음"></span></button>';
      });
    });
    toc.innerHTML = html;
    toc.addEventListener("click", function (e) {
      var btn = e.target.closest(".toc-slide");
      if (btn) { location.hash = "#" + btn.dataset.id; }
    });
  }

  function highlightTOC(id) {
    Array.prototype.forEach.call(document.querySelectorAll(".toc-slide"), function (b) {
      var on = b.dataset.id === id;
      b.classList.toggle("current", on);
      if (on) b.scrollIntoView({ block: "nearest" });
    });
  }

  function updateTocBadge(id) {
    var b = document.querySelector('.toc-slide[data-id="' + id + '"]');
    if (b) b.classList.toggle("has-memo", hasMemo(id));
  }

  /* ---------- 슬라이드 뷰 렌더 ---------- */
  function memoBlockHTML() {
    return '<div class="ep-h">내 메모</div>' +
      '<div class="memo-wrap">' +
      '<textarea id="memoInput" class="memo-input" rows="4" ' +
      'placeholder="이 슬라이드에 대한 메모를 남기세요. 자동 저장됩니다."></textarea>' +
      '<div class="memo-status"><span id="memoStatus" class="memo-saved"></span>' +
      '<span class="memo-hint">메모는 이 브라우저에만 저장됩니다.</span></div>' +
      '</div>';
  }

  function wireMemo(id) {
    var ta = document.getElementById("memoInput");
    var status = document.getElementById("memoStatus");
    if (!ta) return;
    ta.value = getMemo(id);
    status.textContent = ta.value.trim() ? "저장됨" : "";
    var timer;
    ta.addEventListener("input", function () {
      status.textContent = "입력 중…";
      clearTimeout(timer);
      timer = setTimeout(function () {
        setMemo(id, ta.value);
        status.textContent = ta.value.trim() ? "저장됨 ✓" : "";
        updateTocBadge(id);
      }, 500);
    });
  }

  // 슬라이드에 매핑된 개념 → "개념 더 보기" 칩
  function conceptChipsHTML(ids) {
    var chips = (ids || []).filter(function (id) { return conceptById[id]; });
    if (!chips.length) return "";
    var h = '<div class="ep-h">개념 더 보기</div><div class="ep-concepts">';
    chips.forEach(function (id) {
      var c = conceptById[id];
      var ko = String(c.name || id).split(/[（(]/)[0].trim();
      h += '<button class="concept-chip" data-concept="' + esc(id) + '" title="개념 사전에서 보기">' +
           esc(ko) + '</button>';
    });
    h += '</div>';
    return h;
  }

  function renderExplain(s) {
    var p = document.getElementById("explainPanel");
    var id = slideKey(s.day, s.page);
    if (!s.has_explanation) {
      p.innerHTML = '<span class="pending-badge">해설 준비 중</span>' +
        '<div class="ep-h">슬라이드 원문</div><pre class="ep-explain">' + esc(s.text) + '</pre>' +
        memoBlockHTML();
      wireMemo(id);
      return;
    }
    var h = "";
    if (s.difficulty) {
      var dmap = { basic: "기초", intermediate: "중급", advanced: "심화" };
      h += '<span class="difficulty ' + esc(s.difficulty) + '">' +
           (dmap[s.difficulty] || s.difficulty) + '</span>';
    }
    if (s.section) h += '<span class="ep-section-tag">' + esc(s.section) + '</span>';
    h += '<h2 class="ep-title">' + esc(s.title) + '</h2>';
    if (s.one_liner) h += '<div class="ep-oneliner">' + renderText(s.one_liner) + '</div>';

    h += '<div class="ep-h">해설</div><div class="ep-explain">' + renderText(s.explanation) + '</div>';

    if (s.lecture_note) {
      h += '<div class="ep-h lecture-h">🎙️ 강의 실황</div>' +
           '<div class="lecture-note">' + renderText(s.lecture_note) + '</div>';
    }

    if (s.key_terms && s.key_terms.length) {
      h += '<div class="ep-h">핵심 용어</div><ul class="term-list">';
      s.key_terms.forEach(function (t) {
        h += '<li><span class="t">' + esc(t.term) + '</span> — ' + esc(t.easy) + '</li>';
      });
      h += '</ul>';
    }

    // 개념 더 보기(개념 사전 링크)
    h += conceptChipsHTML(s.concept_ids);

    if (s.references && s.references.length) {
      h += '<div class="ep-h">참조 문헌</div>';
      s.references.forEach(function (r) {
        if (r.url) {
          var badge = r.verified_manual
            ? ' <span class="ref-verified" title="원문 URL을 수동 검증한 참고문헌입니다">검증됨</span>'
            : '';
          var ctx = r.context ? ' <span class="ref-ctx">— ' + esc(r.context) + '</span>' : '';
          h += '<div class="ref-item">' +
               '<a href="' + esc(r.url) + '" target="_blank" rel="noopener">' + esc(r.url) + '</a>' +
               badge + ctx + '</div>';
        } else {
          var text = r.citation || r.context || "(서지 정보)";
          var extra = (r.citation && r.context) ? ' <span class="ref-ctx">— ' + esc(r.context) + '</span>' : '';
          h += '<div class="ref-item ref-nolink">' +
               '<span class="ref-cite" title="슬라이드 원문에 링크가 없는 서지 인용입니다">' + esc(text) + '</span>' +
               extra +
               ' <span class="ref-nolink-tag" title="슬라이드 원문에 링크가 없는 서지 인용입니다">슬라이드에 링크 없음</span>' +
               '</div>';
        }
      });
    }
    if (s.related_slides && s.related_slides.length) {
      h += '<div class="ep-h">관련 슬라이드</div>';
      s.related_slides.forEach(function (r) {
        var rid = slideKey(r.day, r.page);
        h += '<div class="related-item"><a class="cite-link" href="#' + rid + '" data-jump="' + rid + '">[D' +
             r.day + '-p' + r.page + ']</a> ' + esc(r.why || "") + '</div>';
      });
    }
    if (s.qa && s.qa.length) {
      h += '<div class="ep-h">확인 질문</div>';
      s.qa.forEach(function (q) {
        var live = q.from_lecture
          ? ' <span class="qa-live" title="실제 강의 중 오간 질문입니다">강의 중 질문</span>' : '';
        h += '<div class="qa-item' + (q.from_lecture ? ' qa-from-lecture' : '') + '">' +
             '<div class="q">Q. ' + esc(q.q) + live + '</div>' +
             '<div class="a">A. ' + renderText(q.a) + '</div></div>';
      });
    }
    h += memoBlockHTML();
    p.innerHTML = h;
    wireMemo(id);
  }

  function showSlide(id, skipHash) {
    if (!D.slides[id]) return;
    currentId = id;
    var s = D.slides[id];
    document.getElementById("slideImg").src = s.image;
    document.getElementById("slideImg").alt = "Day" + s.day + " p" + s.page + " " + (s.title || "");
    document.getElementById("slideRaw").textContent = s.text || "(원문 없음)";
    var idx = indexOfId[id];
    document.getElementById("slideCounter").textContent =
      s.page + "쪽  (" + (idx + 1) + " / " + order.length + ")";
    renderExplain(s);
    highlightTOC(id);
    document.querySelector(".slide-stage").scrollTop = 0;
    document.getElementById("explainPanel").scrollTop = 0;
    if (!skipHash && location.hash !== "#" + id) {
      history.replaceState(null, "", "#" + id);
    }
  }

  function step(delta) {
    var idx = indexOfId[currentId];
    var ni = Math.min(order.length - 1, Math.max(0, idx + delta));
    location.hash = "#" + order[ni];
  }
  document.getElementById("prevBtn").addEventListener("click", function () { step(-1); });
  document.getElementById("nextBtn").addEventListener("click", function () { step(1); });
  document.addEventListener("keydown", function (e) {
    if (!document.getElementById("view-slides").classList.contains("active")) return;
    if (/input|textarea|select/i.test((e.target.tagName || ""))) return;
    if (e.key === "ArrowLeft") { step(-1); e.preventDefault(); }
    else if (e.key === "ArrowRight") { step(1); e.preventDefault(); }
  });

  /* ---------- 인용/점프 링크 + 개념 칩 전역 위임 ---------- */
  document.addEventListener("click", function (e) {
    var a = e.target.closest("[data-jump]");
    if (a) { e.preventDefault(); location.hash = "#" + a.dataset.jump; return; }
    var cc = e.target.closest("[data-concept]");
    if (cc) { e.preventDefault(); location.hash = "#concept-" + cc.dataset.concept; }
  });

  /* ---------- 해시 라우팅 ---------- */
  function onHash() {
    var raw = (location.hash || "").replace(/^#/, "");
    if (raw.indexOf("concept-") === 0) {
      var cid = raw.slice("concept-".length);
      if (conceptById[cid]) { showView("concepts"); showConcept(cid); }
      return;
    }
    if (D.slides[raw]) {
      showView("slides");
      showSlide(raw, true);
    }
  }
  window.addEventListener("hashchange", onHash);

  /* ---------- 검색 ---------- */
  function tokenize(q) {
    return q.toLowerCase().split(/\s+/).filter(function (t) { return t.length > 0; });
  }
  function scoreSlide(s, tokens) {
    var title = (s.title || "").toLowerCase();
    var terms = (s.key_terms || []).map(function (t) { return (t.term + " " + t.easy); }).join(" ").toLowerCase();
    var expl = (s.explanation || "").toLowerCase();
    var lect = (s.lecture_note || "").toLowerCase();
    var text = (s.text || "").toLowerCase();
    // 매핑된 개념명도 검색 대상(개념사전 1.5점 가중)
    var conc = (s.concept_ids || []).map(function (id) {
      var c = conceptById[id]; return c ? (c.name + " " + (c.aliases || []).join(" ")) : "";
    }).join(" ").toLowerCase();
    var memo = getMemo(slideKey(s.day, s.page)).toLowerCase();
    var score = 0, matched = 0;
    tokens.forEach(function (tk) {
      var hit = false;
      if (title.indexOf(tk) >= 0) { score += 3; hit = true; }
      if (terms.indexOf(tk) >= 0) { score += 2; hit = true; }
      if (expl.indexOf(tk) >= 0) { score += 1.5; hit = true; }
      if (lect && lect.indexOf(tk) >= 0) { score += 1.5; hit = true; }
      if (conc && conc.indexOf(tk) >= 0) { score += 1.5; hit = true; }
      if (text.indexOf(tk) >= 0) { score += 1; hit = true; }
      if (memo && memo.indexOf(tk) >= 0) { score += 1; hit = true; }
      if (hit) matched++;
    });
    if (matched === 0) return 0;
    if (matched === tokens.length) score += 10;
    return score;
  }
  function snippet(s, tokens) {
    var src = s.explanation || s.text || "";
    var low = src.toLowerCase(), pos = -1;
    for (var i = 0; i < tokens.length; i++) {
      var p = low.indexOf(tokens[i]);
      if (p >= 0 && (pos < 0 || p < pos)) pos = p;
    }
    if (pos < 0) pos = 0;
    var start = Math.max(0, pos - 40);
    var frag = (start > 0 ? "…" : "") + src.substr(start, 160) + "…";
    var out = esc(frag);
    tokens.forEach(function (tk) {
      var re = new RegExp("(" + tk.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "gi");
      out = out.replace(re, "<mark>$1</mark>");
    });
    return out;
  }
  function runSearch(q) {
    var box = document.getElementById("searchResults");
    var tokens = tokenize(q);
    if (!tokens.length) { box.innerHTML = '<p class="empty">검색어를 입력하세요.</p>'; return; }
    var results = [];
    order.forEach(function (id) {
      var sc = scoreSlide(D.slides[id], tokens);
      if (sc > 0) results.push({ id: id, score: sc });
    });
    results.sort(function (a, b) {
      return b.score - a.score ||
        (D.slides[a.id].day - D.slides[b.id].day) ||
        (D.slides[a.id].page - D.slides[b.id].page);
    });
    if (!results.length) { box.innerHTML = '<p class="empty">일치하는 슬라이드가 없습니다.</p>'; return; }
    var html = '<p class="hint">' + results.length + '개 슬라이드 검색됨</p>';
    results.slice(0, 60).forEach(function (r) {
      var s = D.slides[r.id];
      html += '<button class="result-card" data-jump="' + r.id + '">' +
        '<img loading="lazy" src="' + esc(s.image) + '" alt="">' +
        '<span class="rc-body">' +
        '<span class="rc-title">' + esc(s.title || ("슬라이드 " + s.page)) + '</span>' +
        '<span class="rc-meta">' + s.page + '쪽' +
        (s.section ? ' · ' + esc(s.section) : '') + '</span>' +
        '<span class="rc-snippet">' + snippet(s, tokens) + '</span>' +
        '</span></button>';
    });
    box.innerHTML = html;
  }
  var searchInput = document.getElementById("searchInput");
  var searchTimer;
  searchInput.addEventListener("input", function () {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () { runSearch(searchInput.value); }, 120);
  });

  /* ---------- Q&A ---------- */
  function answerQA(q) {
    var box = document.getElementById("qaAnswer");
    var tokens = tokenize(q);
    if (!tokens.length) { box.innerHTML = '<p class="empty">질문을 입력하세요.</p>'; return; }

    var qaHits = [];
    order.forEach(function (id) {
      var s = D.slides[id];
      (s.qa || []).forEach(function (qa) {
        var ql = (qa.q + " " + qa.a).toLowerCase();
        var overlap = 0;
        tokens.forEach(function (tk) { if (ql.indexOf(tk) >= 0) overlap++; });
        if (overlap > 0) qaHits.push({ id: id, qa: qa, ov: overlap });
      });
    });
    qaHits.sort(function (a, b) { return b.ov - a.ov; });

    var scored = [];
    order.forEach(function (id) {
      var sc = scoreSlide(D.slides[id], tokens);
      if (sc > 0) scored.push({ id: id, score: sc });
    });
    scored.sort(function (a, b) { return b.score - a.score; });

    var html = "";
    if (qaHits.length) {
      var top = qaHits[0];
      var s = D.slides[top.id];
      html += '<div class="ans-block"><strong>가장 가까운 확인 질문</strong>' +
        '<div class="qa-item"><div class="q">Q. ' + esc(top.qa.q) + '</div>' +
        '<div class="a">A. ' + renderText(top.qa.a) + '</div></div>' +
        '<div class="src-line">출처: <a class="cite-link" href="#' + top.id + '" data-jump="' + top.id + '">[D' +
        s.day + '-p' + s.page + ']</a> ' + esc(s.title || "") + '</div></div>';
    }
    if (scored.length) {
      html += '<div class="ans-block"><strong>관련 해설 (검색 상위 슬라이드)</strong>';
      scored.slice(0, 3).forEach(function (r) {
        var s2 = D.slides[r.id];
        html += '<div style="margin-top:10px">' +
          '<a class="cite-link" href="#' + r.id + '" data-jump="' + r.id + '">[D' +
          s2.day + '-p' + s2.page + ']</a> <strong>' + esc(s2.title || "") + '</strong>' +
          '<div class="a" style="margin-top:4px">' + renderText(s2.one_liner || (s2.explanation || "").slice(0, 200)) + '</div></div>';
      });
      html += '</div>';
    }
    if (!html) html = '<p class="empty">관련 내용을 찾지 못했습니다. 다른 표현으로 질문해 보세요.</p>';
    box.innerHTML = html;
  }
  document.getElementById("qaBtn").addEventListener("click", function () {
    answerQA(document.getElementById("qaInput").value);
  });
  document.getElementById("qaInput").addEventListener("keydown", function (e) {
    if (e.key === "Enter") answerQA(this.value);
  });

  function buildFAQ() {
    var box = document.getElementById("faqButtons");
    box.innerHTML = (D.faq || []).map(function (f) {
      return '<button data-q="' + esc(f.q) + '">' + esc(f.q) + '</button>';
    }).join("");
    box.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-q]");
      if (b) {
        document.getElementById("qaInput").value = b.dataset.q;
        answerQA(b.dataset.q);
      }
    });
  }

  /* ---------- 참고문헌 ---------- */
  function buildRefs() {
    var box = document.getElementById("refsList");
    var groups = {};
    var labelMap = { paper: "논문", "blog/news": "블로그 / 뉴스", docs: "공식 문서", tool: "도구 / 코드", etc: "기타" };
    var orderTypes = ["paper", "docs", "blog/news", "tool", "etc"];
    (D.references || []).forEach(function (r) {
      var t = r.type || "etc";
      (groups[t] = groups[t] || []).push(r);
    });
    var typeKeys = orderTypes.filter(function (t) { return groups[t]; })
      .concat(Object.keys(groups).filter(function (t) { return orderTypes.indexOf(t) < 0; }));
    var html = "";
    typeKeys.forEach(function (t) {
      html += '<div class="ref-group"><h3>' + esc(labelMap[t] || t) +
        ' <span style="color:var(--muted);font-weight:400">(' + groups[t].length + ')</span></h3>';
      groups[t].forEach(function (r) {
        var cited = (r.cited_by || []).map(function (c) {
          var id = slideKey(c.day, c.page);
          return '<a class="cite-link" href="#' + id + '" data-jump="' + id + '">[D' + c.day + '-p' + c.page + ']</a>';
        }).join(" ");
        var badge = r.verified_manual ? ' <span class="ref-verified">검증 등재</span>' : '';
        html += '<div class="ref-row">' +
          '<div class="r-label">' + esc(r.label || r.id) + badge + '</div>' +
          (r.url ? '<div class="r-url"><a href="' + esc(r.url) + '" target="_blank" rel="noopener">' + esc(r.url) + '</a></div>' : '') +
          (cited ? '<div class="cited">인용: ' + cited + '</div>' : '') +
          '</div>';
      });
      html += '</div>';
    });
    box.innerHTML = html;
  }

  /* ---------- 개념 사전 ---------- */
  var conceptSel = null;
  function buildConcepts() {
    var list = document.getElementById("conceptList");
    var cs = D.concepts || [];
    if (!cs.length) { list.innerHTML = '<p class="empty">개념 데이터가 없습니다.</p>'; return; }
    // 카테고리별 그룹핑(등장 순서 유지)
    var order2 = [], bucket = {};
    cs.forEach(function (c) {
      var cat = c.category || "기타";
      if (!bucket[cat]) { bucket[cat] = []; order2.push(cat); }
      bucket[cat].push(c);
    });
    var html = '';
    order2.forEach(function (cat) {
      html += '<div class="cx-cat">' + esc(cat) + '</div>';
      bucket[cat].forEach(function (c) {
        var ko = String(c.name || c.id).split(/[（(]/)[0].trim();
        html += '<button class="cx-item" data-concept="' + esc(c.id) + '">' + esc(ko) + '</button>';
      });
    });
    list.innerHTML = html;
    list.addEventListener("click", function (e) {
      var b = e.target.closest(".cx-item");
      if (b) location.hash = "#concept-" + b.dataset.concept;
    });
  }

  function showConcept(id) {
    var c = conceptById[id];
    var box = document.getElementById("conceptDetail");
    if (!c) { box.innerHTML = '<p class="empty">개념을 찾을 수 없습니다.</p>'; return; }
    conceptSel = id;
    Array.prototype.forEach.call(document.querySelectorAll(".cx-item"), function (b) {
      b.classList.toggle("on", b.dataset.concept === id);
      if (b.dataset.concept === id) b.scrollIntoView({ block: "nearest" });
    });
    var h = '<div class="cx-d-head">';
    h += '<h2 class="cx-name">' + esc(c.name || c.id) + '</h2>';
    h += '<div class="cx-tags"><span class="cx-cat-badge">' + esc(c.category || "기타") + '</span>';
    if (c.web_verified) h += '<span class="cx-verified" title="웹 검색으로 출처를 검증한 개념입니다">웹 검증</span>';
    h += '</div>';
    if (c.aliases && c.aliases.length) {
      h += '<div class="cx-aliases">다른 이름: ' + c.aliases.map(esc).join(", ") + '</div>';
    }
    h += '</div>';

    if (c.easy_def) h += '<div class="cx-easy">' + renderText(c.easy_def) + '</div>';
    if (c.detail) h += '<div class="cx-sec-h">자세히</div><div class="cx-body">' + renderText(c.detail) + '</div>';
    if (c.in_this_seminar) h += '<div class="cx-sec-h">이 세미나에서는</div><div class="cx-body cx-inseminar">' + renderText(c.in_this_seminar) + '</div>';
    if (c.misconceptions) h += '<div class="cx-sec-h">흔한 오해</div><div class="cx-body cx-misc">' + renderText(c.misconceptions) + '</div>';

    if (c.sources && c.sources.length) {
      h += '<div class="cx-sec-h">출처 · 더 읽을거리</div><div class="cx-sources">';
      c.sources.forEach(function (sr) {
        var why = sr.why ? '<span class="cx-src-why">' + esc(sr.why) + '</span>' : '';
        h += '<div class="cx-src">' +
          '<a href="' + esc(sr.url) + '" target="_blank" rel="noopener">' + esc(sr.title || sr.url) + '</a>' +
          why + '</div>';
      });
      h += '</div>';
    }

    var rel = (c.related_concepts || []).filter(function (r) { return conceptById[r]; });
    if (rel.length) {
      h += '<div class="cx-sec-h">관련 개념</div><div class="cx-related">';
      rel.forEach(function (r) {
        var rc = conceptById[r];
        var ko = String(rc.name || r).split(/[（(]/)[0].trim();
        h += '<button class="concept-chip" data-concept="' + esc(r) + '">' + esc(ko) + '</button>';
      });
      h += '</div>';
    }
    box.innerHTML = h;
    box.scrollTop = 0;
  }

  /* ---------- 강조 ---------- */
  var HL_CAT_ORDER = ["핵심 기법", "실무 조언", "주의·함정", "강사 평가", "산업 인사이트"];
  var HL_CAT_CLASS = {
    "핵심 기법": "cat-key", "실무 조언": "cat-tip", "주의·함정": "cat-warn",
    "강사 평가": "cat-eval", "산업 인사이트": "cat-industry"
  };
  var hlFilter = "all";
  function buildHighlights() {
    var box = document.getElementById("highlightsList");
    var fbox = document.getElementById("highlightFilters");
    var items = (D.highlights || []).slice();
    if (!items.length) { box.innerHTML = '<p class="empty">강조 항목이 없습니다.</p>'; return; }
    // 정의 순서 + 미정의 카테고리는 뒤에 이어붙임
    var cats = HL_CAT_ORDER.filter(function (c) {
      return items.some(function (it) { return it.category === c; });
    });
    items.forEach(function (it) {
      if (cats.indexOf(it.category) < 0 && it.category) cats.push(it.category);
    });
    var fhtml = '<button class="hl-fbtn' + (hlFilter === "all" ? " on" : "") +
      '" data-cat="all">전체 <span class="cnt">' + items.length + '</span></button>';
    cats.forEach(function (c) {
      var n = items.filter(function (it) { return it.category === c; }).length;
      fhtml += '<button class="hl-fbtn ' + (HL_CAT_CLASS[c] || "") + (hlFilter === c ? " on" : "") +
        '" data-cat="' + esc(c) + '">' + esc(c) + ' <span class="cnt">' + n + '</span></button>';
    });
    fbox.innerHTML = fhtml;
    function rank(it) { return (it.importance === "high" ? 0 : 1); }
    var shown = items.filter(function (it) { return hlFilter === "all" || it.category === hlFilter; });
    var byCat = {};
    shown.forEach(function (it) { (byCat[it.category] = byCat[it.category] || []).push(it); });
    var html = "";
    cats.forEach(function (c) {
      var arr = byCat[c];
      if (!arr || !arr.length) return;
      arr.sort(function (a, b) { return rank(a) - rank(b); });
      html += '<div class="hl-group"><h3 class="hl-cat-h ' + (HL_CAT_CLASS[c] || "") + '">' + esc(c) + '</h3>';
      arr.forEach(function (it) {
        var pages = (it.pages || []).map(function (p) {
          var id = "d" + (it.day || 1) + "p" + p;
          return '<a class="cite-link" href="#' + id + '" data-jump="' + id + '">[D' + (it.day || 1) + '-p' + p + ']</a>';
        }).join(" ");
        html += '<div class="hl-card ' + (HL_CAT_CLASS[c] || "") + (it.importance === "high" ? " is-high" : "") + '">' +
          '<div class="hl-card-top">' +
          (it.importance === "high" ? '<span class="hl-star" title="특히 강조">★</span>' : '') +
          '<span class="hl-title">' + esc(it.title) + '</span></div>' +
          '<div class="hl-point">' + renderText(it.point) + '</div>' +
          (pages ? '<div class="hl-pages">' + pages + '</div>' : '') +
          '</div>';
      });
      html += '</div>';
    });
    box.innerHTML = html || '<p class="empty">해당 카테고리 항목이 없습니다.</p>';
    fbox.onclick = function (e) {
      var b = e.target.closest(".hl-fbtn");
      if (!b) return;
      hlFilter = b.dataset.cat;
      buildHighlights();
    };
  }

  /* ---------- 학습 흐름 (인터랙티브) ---------- */
  var flowTracksAll = [];
  var flowSel = 0;
  var flowExpanded = {};
  var flowFocus = -1;

  function stripFirstSentence(t) {
    var s = String(t || "").replace(/\[D\d+-p\d+\]/g, "").replace(/\(배경지식\)/g, "").replace(/\(모델 지식\)/g, "").trim();
    var m = s.match(/^[^.!?]*[.!?]/);
    return m ? m[0].trim() : s.slice(0, 50);
  }
  function flowPageLinks(day, pages) {
    return (pages || []).map(function (p) {
      var id = "d" + (day || 1) + "p" + p;
      return '<a class="cite-link" href="#' + id + '" data-jump="' + id + '">[D' + (day || 1) + '-p' + p + ']</a>';
    }).join(" ");
  }

  function buildFlow() {
    var intro = document.getElementById("flowIntro");
    var tabs = document.getElementById("flowTabs");
    var stage = document.getElementById("flowStage");
    var flows = D.flow || [];
    flowTracksAll = [];
    flows.forEach(function (f) {
      (f.tracks || []).forEach(function (t) {
        flowTracksAll.push({ day: f.day || 1, track: t.track, summary: t.summary, steps: t.steps || [] });
      });
    });
    if (!flowTracksAll.length) { stage.innerHTML = '<p class="empty">학습 흐름 데이터가 없습니다.</p>'; return; }
    intro.innerHTML = flows.map(function (f) { return renderText(f.intro || ""); }).join(" ");

    tabs.innerHTML = flowTracksAll.map(function (t, i) {
      var label = String(t.track).split(":")[0].split("—")[0].trim();
      return '<button class="flow-tab' + (i === flowSel ? " on" : "") + '" data-tk="' + i + '">' +
        '<span class="flow-tab-num">' + (i + 1) + '</span>' + esc(label) + '</button>';
    }).join("");
    tabs.onclick = function (e) {
      var b = e.target.closest(".flow-tab");
      if (!b) return;
      flowSel = parseInt(b.dataset.tk, 10);
      flowFocus = -1;
      flowExpanded[flowSel] = flowExpanded[flowSel] || new Set();
      Array.prototype.forEach.call(tabs.querySelectorAll(".flow-tab"), function (x) {
        x.classList.toggle("on", x.dataset.tk === String(flowSel));
      });
      renderFlowStage();
    };
    renderFlowStage();
  }

  function renderFlowStage(scrollToFocus) {
    var stage = document.getElementById("flowStage");
    var t = flowTracksAll[flowSel];
    var exp = flowExpanded[flowSel] = flowExpanded[flowSel] || new Set();
    var steps = t.steps;
    var allOpen = steps.every(function (_, i) { return exp.has(i); });

    var html = '<div class="fx-track-head">' +
      '<div class="fx-th-title"><span class="fx-th-num">' + (flowSel + 1) + '</span>' +
      '<h3>' + esc(t.track) + '</h3></div>' +
      (t.summary ? '<p class="fx-th-summary">' + renderText(t.summary) + '</p>' : '') +
      '<div class="fx-controls">' +
      '<button class="fx-btn" data-act="prev" title="이전 개념">◀ 이전</button>' +
      '<span class="fx-progress" id="fxProgress"></span>' +
      '<button class="fx-btn primary" data-act="next" title="다음 개념">다음 개념 ▶</button>' +
      '<button class="fx-btn ghost" data-act="toggleAll">' + (allOpen ? "모두 접기" : "모두 펼치기") + '</button>' +
      '</div></div>';

    html += '<div class="fx-flow">';
    steps.forEach(function (s, i) {
      var open = exp.has(i);
      var focus = (i === flowFocus);
      var concept = s.concept || stripFirstSentence(s.note);
      html += '<div class="fx-step' + (open ? " open" : "") + (focus ? " focus" : "") + '" data-step="' + i + '">' +
        '<button class="fx-node" data-toggle="' + i + '">' +
        '<span class="fx-dot">' + (i + 1) + '</span>' +
        '<span class="fx-node-main">' +
        '<span class="fx-label">' + esc(s.label) + (s.era ? ' <span class="fx-era">' + esc(s.era) + '</span>' : '') + '</span>' +
        '<span class="fx-concept">' + esc(concept) + '</span>' +
        '</span><span class="fx-caret">' + (open ? "▲" : "▼") + '</span></button>';
      if (open) {
        html += '<div class="fx-body">' +
          (s.note ? '<div class="fx-note">' + renderText(s.note) + '</div>' : '') +
          (s.pages && s.pages.length ? '<div class="fx-pages">근거 슬라이드: ' + flowPageLinks(t.day, s.pages) + '</div>' : '') +
          '</div>';
      }
      html += '</div>';
      if (i < steps.length - 1) {
        html += '<div class="fx-bridge">' +
          '<span class="fx-arrow">↓</span>' +
          (s.transition ? '<span class="fx-transition">' + renderText(s.transition) + '</span>'
                        : '<span class="fx-transition muted">다음 단계</span>') +
          '</div>';
      }
    });
    html += '</div>';
    stage.innerHTML = html;

    var prog = document.getElementById("fxProgress");
    if (prog) prog.textContent = (flowFocus >= 0 ? (flowFocus + 1) : "–") + " / " + steps.length;

    if (scrollToFocus && flowFocus >= 0) {
      var node = stage.querySelector('.fx-step[data-step="' + flowFocus + '"]');
      if (node) node.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }

  document.getElementById("flowStage").addEventListener("click", function (e) {
    var tog = e.target.closest("[data-toggle]");
    var act = e.target.closest("[data-act]");
    var exp = flowExpanded[flowSel] = flowExpanded[flowSel] || new Set();
    var steps = flowTracksAll[flowSel].steps;
    if (tog) {
      if (e.target.closest("[data-jump]")) return;
      var i = parseInt(tog.dataset.toggle, 10);
      if (exp.has(i)) exp.delete(i); else exp.add(i);
      flowFocus = i;
      renderFlowStage();
      return;
    }
    if (act) {
      var a = act.dataset.act;
      if (a === "next") {
        if (flowFocus < steps.length - 1) { flowFocus++; exp.add(flowFocus); renderFlowStage(true); }
      } else if (a === "prev") {
        if (flowFocus > 0) { exp.delete(flowFocus); flowFocus--; renderFlowStage(true); }
        else if (flowFocus === 0) { exp.delete(0); flowFocus = -1; renderFlowStage(); }
      } else if (a === "toggleAll") {
        var allOpen = steps.every(function (_, i2) { return exp.has(i2); });
        if (allOpen) { exp.clear(); flowFocus = -1; }
        else { steps.forEach(function (_, i2) { exp.add(i2); }); }
        renderFlowStage();
      }
    }
  });

  /* ---------- 내 메모 모아보기 / 내보내기 ---------- */
  function collectMemos() {
    var arr = [];
    order.forEach(function (id) {
      var v = getMemo(id);
      if (v && v.trim()) arr.push({ id: id, s: D.slides[id], memo: v });
    });
    return arr;
  }
  function buildMemos() {
    var box = document.getElementById("memosList");
    var arr = collectMemos();
    if (!arr.length) {
      box.innerHTML = '<p class="empty">아직 저장된 메모가 없습니다. 슬라이드 뷰의 해설 패널에서 메모를 남겨 보세요.</p>';
      return;
    }
    var html = '<p class="hint">' + arr.length + '개 슬라이드에 메모가 있습니다.</p>';
    arr.forEach(function (m) {
      var s = m.s;
      html += '<div class="memo-card">' +
        '<div class="memo-card-head">' +
        '<a class="cite-link" href="#' + m.id + '" data-jump="' + m.id + '">[D' + s.day + '-p' + s.page + ']</a> ' +
        '<span class="memo-card-title">' + esc(s.title || ("슬라이드 " + s.page)) + '</span></div>' +
        '<div class="memo-card-body">' + esc(m.memo) + '</div></div>';
    });
    box.innerHTML = html;
  }

  var MEMO_HEADING_RE = /^##\s+\[D(\d+)-p(\d+)\]/;

  function escapeMemoBody(text) {
    return String(text).split("\n").map(function (line) {
      return line.replace(/^(\\*#)/, "\\$1");
    }).join("\n");
  }
  function unescapeMemoBody(text) {
    return String(text).split("\n").map(function (line) {
      return line.replace(/^\\(\\*#)/, "$1");
    }).join("\n");
  }

  function buildExportMarkdown(arr) {
    var md = "# 내 메모 — " + D.meta.title + "\n\n";
    md += "<!-- 이 파일은 '내 메모' 내보내기 결과입니다. '## [D{일}-p{쪽}]' 헤딩 형식을 유지하면 다시 가져올 수 있습니다. -->\n\n";
    arr.forEach(function (m) {
      var s = m.s || D.slides[m.id] || {};
      var day = s.day, page = s.page;
      if (day == null || page == null) {
        var mt = /^d(\d+)p(\d+)$/.exec(m.id) || [];
        day = day == null ? mt[1] : day;
        page = page == null ? mt[2] : page;
      }
      var title = (s && s.title) ? s.title : ("슬라이드 " + page);
      md += "## [D" + day + "-p" + page + "] " + title + "\n\n" +
            escapeMemoBody(m.memo.trim()) + "\n\n";
    });
    return md;
  }

  function parseMemoMarkdown(text) {
    var lines = String(text).replace(/\r\n?/g, "\n").split("\n");
    var entries = [], cur = null;
    lines.forEach(function (line) {
      var m = MEMO_HEADING_RE.exec(line);
      if (m) {
        if (cur) entries.push(cur);
        cur = { id: "d" + parseInt(m[1], 10) + "p" + parseInt(m[2], 10), body: [] };
      } else if (cur) {
        cur.body.push(line);
      }
    });
    if (cur) entries.push(cur);
    return entries.map(function (e) {
      var body = unescapeMemoBody(e.body.join("\n")).replace(/^\n+/, "").replace(/\s+$/, "");
      return { id: e.id, memo: body };
    });
  }

  function exportMemos() {
    var arr = collectMemos();
    if (!arr.length) { alert("내보낼 메모가 없습니다."); return; }
    var md = buildExportMarkdown(arr);
    var blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "내메모_PE바이브코딩세미나.md";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function showImportResult(msg, kind) {
    var box = document.getElementById("importResult");
    if (!box) return;
    box.hidden = false;
    box.className = "import-result" + (kind ? " " + kind : "");
    box.innerHTML = msg;
  }

  function refreshMemoUI() {
    order.forEach(function (id) { updateTocBadge(id); });
    var ta = document.getElementById("memoInput");
    if (ta) {
      ta.value = getMemo(currentId);
      var st = document.getElementById("memoStatus");
      if (st) st.textContent = ta.value.trim() ? "저장됨" : "";
    }
    buildMemos();
  }

  function importMemos(text) {
    var parsed = parseMemoMarkdown(text);
    if (!parsed.length) {
      showImportResult("가져올 메모를 찾지 못했습니다. '## [D1-p23] …' 형식의 헤딩이 있는지 확인하세요.", "warn");
      return;
    }
    var toWrite = [], conflicts = [], invalidKeys = [], identical = 0;
    parsed.forEach(function (p) {
      if (!p.memo) return;
      if (!D.slides[p.id]) { invalidKeys.push(p.id); return; }
      var existing = getMemo(p.id).trim();
      var incoming = p.memo.trim();
      if (!existing) { toWrite.push({ id: p.id, memo: incoming }); }
      else if (existing === incoming) { identical++; }
      else { conflicts.push({ id: p.id, memo: incoming }); }
    });

    var overwrite = true;
    if (conflicts.length) {
      overwrite = window.confirm("기존 메모 " + conflicts.length +
        "건과 내용이 다릅니다. 덮어쓰시겠습니까?\n(취소하면 해당 " + conflicts.length +
        "건은 기존 메모를 유지하고 건너뜁니다.)");
    }

    var restored = 0;
    toWrite.forEach(function (w) { setMemo(w.id, w.memo); restored++; });
    if (overwrite) {
      conflicts.forEach(function (w) { setMemo(w.id, w.memo); restored++; });
    }

    var declined = overwrite ? 0 : conflicts.length;
    var skipped = invalidKeys.length + identical + declined;

    refreshMemoUI();

    var detail = [];
    if (invalidKeys.length) {
      var keyLabels = invalidKeys.slice(0, 20).map(function (id) {
        var mt = /^d(\d+)p(\d+)$/.exec(id) || [];
        return "[D" + (mt[1] || "?") + "-p" + (mt[2] || "?") + "]";
      }).join(" ");
      detail.push("존재하지 않는 슬라이드 " + invalidKeys.length + "건 건너뜀: " + esc(keyLabels) +
        (invalidKeys.length > 20 ? " …" : ""));
    }
    if (identical) detail.push("이미 동일한 메모 " + identical + "건 유지");
    if (declined) detail.push("덮어쓰기 취소로 " + declined + "건 유지");
    var head = "<strong>복원 " + restored + "건 / 건너뜀 " + skipped + "건</strong>";
    showImportResult(head + (detail.length ? "<div class=\"ir-detail\">" + detail.join("<br>") + "</div>" : ""),
      restored ? "ok" : "warn");
  }

  function wireImport() {
    var btn = document.getElementById("importMemosBtn");
    var file = document.getElementById("importMemosFile");
    if (!btn || !file) return;
    btn.addEventListener("click", function () { file.value = ""; file.click(); });
    file.addEventListener("change", function () {
      var f = file.files && file.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function () {
        try { importMemos(String(reader.result || "")); }
        catch (e) { showImportResult("가져오기 중 오류가 발생했습니다: " + esc(e.message), "warn"); }
      };
      reader.onerror = function () { showImportResult("파일을 읽지 못했습니다.", "warn"); };
      reader.readAsText(f, "utf-8");
    });
  }

  /* ---------- 뷰어 크기 조절 (드래그 스플리터) ---------- */
  var LS_TOC = "layout:tocW", LS_PANEL = "layout:panelW";
  var DEF_TOC = 260, DEF_PANEL = 400;
  var MIN_TOC = 160, MIN_PANEL = 280, MIN_CENTER = 320;
  var SPLIT_W = 14;
  var grid = document.getElementById("view-slides");
  var curToc = DEF_TOC, curPanel = DEF_PANEL;

  function applyLayout() {
    grid.style.setProperty("--toc-w", curToc + "px");
    grid.style.setProperty("--panel-w", curPanel + "px");
  }
  function loadLayout() {
    var t = parseInt(localStorage.getItem(LS_TOC), 10);
    var p = parseInt(localStorage.getItem(LS_PANEL), 10);
    if (!isNaN(t)) curToc = t;
    if (!isNaN(p)) curPanel = p;
    applyLayout();
  }
  function saveLayout() {
    try {
      localStorage.setItem(LS_TOC, Math.round(curToc));
      localStorage.setItem(LS_PANEL, Math.round(curPanel));
    } catch (e) { /* 저장 실패 무시 */ }
  }
  function startDrag(which, e) {
    e.preventDefault();
    var rect = grid.getBoundingClientRect();
    var overlay = document.createElement("div");
    overlay.className = "drag-overlay";
    document.body.appendChild(overlay);
    document.body.classList.add("dragging");
    var target = document.getElementById(which === "left" ? "splitLeft" : "splitRight");
    if (target) target.classList.add("active");

    function onMove(ev) {
      if (which === "left") {
        var maxT = rect.width - curPanel - MIN_CENTER - SPLIT_W;
        curToc = Math.max(MIN_TOC, Math.min(ev.clientX - rect.left, maxT));
      } else {
        var maxP = rect.width - curToc - MIN_CENTER - SPLIT_W;
        curPanel = Math.max(MIN_PANEL, Math.min(rect.right - ev.clientX, maxP));
      }
      applyLayout();
    }
    function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      overlay.remove();
      document.body.classList.remove("dragging");
      if (target) target.classList.remove("active");
      saveLayout();
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }
  function wireSplitters() {
    var left = document.getElementById("splitLeft");
    var right = document.getElementById("splitRight");
    if (left) {
      left.addEventListener("mousedown", function (e) { startDrag("left", e); });
      left.addEventListener("dblclick", function () { curToc = DEF_TOC; applyLayout(); saveLayout(); });
    }
    if (right) {
      right.addEventListener("mousedown", function (e) { startDrag("right", e); });
      right.addEventListener("dblclick", function () { curPanel = DEF_PANEL; applyLayout(); saveLayout(); });
    }
  }

  /* ---------- 첫 진입 안내 카드 ---------- */
  function wireIntro() {
    var card = document.getElementById("introCard");
    var close = document.getElementById("introClose");
    if (!card || !close) return;
    try { if (localStorage.getItem("introDismissed") === "1") card.style.display = "none"; }
    catch (e) { /* 무시 */ }
    close.addEventListener("click", function () {
      card.style.display = "none";
      try { localStorage.setItem("introDismissed", "1"); } catch (e) { /* 무시 */ }
    });
  }

  /* ---------- 초기화 ---------- */
  function init() {
    document.getElementById("siteTitle").textContent = D.meta.title;
    document.getElementById("siteSub").textContent = D.meta.lecturer + " · 프롬프트 엔지니어링과 바이브 코딩";
    document.getElementById("footerMeta").textContent =
      D.meta.title + " · 총 " + D.meta.total_slides + "장 · 개념 " + (D.concepts || []).length + "개 · 정적 SPA";
    loadLayout();
    wireSplitters();
    wireIntro();
    buildTOC();
    buildFAQ();
    buildRefs();
    buildConcepts();
    buildHighlights();
    buildFlow();
    document.getElementById("exportMemosBtn").addEventListener("click", exportMemos);
    wireImport();
    // 초기 라우팅: 해시가 개념/슬라이드면 그곳으로, 아니면 첫 슬라이드
    var raw = (location.hash || "").replace(/^#/, "");
    if (raw.indexOf("concept-") === 0 && conceptById[raw.slice(8)]) {
      showView("concepts"); showConcept(raw.slice(8));
      showSlide(order[0], true);
    } else {
      showSlide(D.slides[raw] ? raw : order[0], true);
    }
  }
  init();
})();
