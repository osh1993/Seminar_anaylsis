/* ===== 모델 경량화 세미나 해설 · 앱 로직 =====
   - 데이터는 data.js 의 window.SEMINAR_DATA 로 주입됨 (fetch 미사용, file:// 동작)
   - 4개 뷰: 슬라이드 / 검색 / Q&A / 참고문헌
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

  /* ---------- 유틸 ---------- */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function slideKey(day, page) { return "d" + day + "p" + page; }

  /* ---------- 메모 저장소 (localStorage, 브라우저별) ----------
     슬라이드 id("d{day}p{page}")가 곧 키이므로 memo 키는 "memo:" + id 로 통일한다. */
  function memoKeyOf(id) { return "memo:" + id; }
  function getMemo(id) {
    try { return localStorage.getItem(memoKeyOf(id)) || ""; }
    catch (e) { return ""; }
  }
  function setMemo(id, val) {
    try {
      if (val && val.trim()) localStorage.setItem(memoKeyOf(id), val);
      else localStorage.removeItem(memoKeyOf(id));
    } catch (e) { /* localStorage 접근 불가(사생활 모드 등) 시 무시 */ }
  }
  function hasMemo(id) { return !!getMemo(id).trim(); }

  // 해설 텍스트 → 안전 HTML: 인용 태그 링크 + (배경지식) 배지 변환
  function renderText(raw) {
    var html = esc(raw);
    // (배경지식) 마커 → 회색 배지
    html = html.replace(/\(배경지식\)/g, '<span class="bg-badge">배경지식</span>');
    // 인용 태그 [D1-p23] → 슬라이드 점프 링크 (변환 누락 0건)
    html = html.replace(/\[D(\d)-p(\d+)\]/g, function (m, d, p) {
      var id = "d" + d + "p" + p;
      var exists = D.slides[id] ? "" : " missing";
      return '<a class="cite-link' + exists + '" href="#' + id +
             '" data-jump="' + id + '">[D' + d + '-p' + p + ']</a>';
    });
    return html;
  }

  /* ---------- 뷰 전환 ---------- */
  var views = ["slides", "highlights", "flow", "search", "qa", "refs", "memos"];
  function showView(name) {
    views.forEach(function (v) {
      document.getElementById("view-" + v).classList.toggle("active", v === name);
    });
    Array.prototype.forEach.call(document.querySelectorAll(".tab"), function (t) {
      t.classList.toggle("active", t.dataset.view === name);
    });
    // "내 메모" 뷰는 진입 시마다 최신 메모로 다시 렌더
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
        html += '<div class="day-title">Day ' + sec.day + ' · ' + esc(dmeta.title || "") + '</div>';
        lastDay = sec.day;
      }
      html += '<div class="sec-title">' + esc(sec.name) + '</div>';
      sec.pages.forEach(function (p) {
        var id = slideKey(sec.day, p);
        var s = D.slides[id];
        var label = (s && s.title) ? s.title : ("슬라이드 " + p);
        // 메모가 있는 슬라이드는 점 배지 표시(has-memo 클래스)
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

  // 메모 저장/삭제 후 해당 목차 항목의 점 배지 갱신
  function updateTocBadge(id) {
    var b = document.querySelector('.toc-slide[data-id="' + id + '"]');
    if (b) b.classList.toggle("has-memo", hasMemo(id));
  }

  /* ---------- 슬라이드 뷰 렌더 ---------- */
  // 슬라이드별 메모 입력 영역 HTML(해설 유무와 무관하게 항상 노출)
  function memoBlockHTML() {
    return '<div class="ep-h">내 메모</div>' +
      '<div class="memo-wrap">' +
      '<textarea id="memoInput" class="memo-input" rows="4" ' +
      'placeholder="이 슬라이드에 대한 메모를 남기세요. 자동 저장됩니다."></textarea>' +
      '<div class="memo-status"><span id="memoStatus" class="memo-saved"></span>' +
      '<span class="memo-hint">메모는 이 브라우저에만 저장됩니다.</span></div>' +
      '</div>';
  }

  // 메모 textarea 값 로드 + debounce 자동 저장 배선
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

    // 강의 실황: 강사가 말로 전한 서사·직관·업계 사례 (녹취록 기반)
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
    if (s.references && s.references.length) {
      h += '<div class="ep-h">참조 문헌</div>';
      s.references.forEach(function (r) {
        if (r.url) {
          // URL 있음: 링크로 렌더 (+검증된 URL이면 "검증됨" 배지)
          var badge = r.verified_manual
            ? ' <span class="ref-verified" title="원문 URL을 수동 검증한 참고문헌입니다">검증됨</span>'
            : '';
          var ctx = r.context ? ' <span class="ref-ctx">— ' + esc(r.context) + '</span>' : '';
          h += '<div class="ref-item">' +
               '<a href="' + esc(r.url) + '" target="_blank" rel="noopener">' + esc(r.url) + '</a>' +
               badge + ctx + '</div>';
        } else {
          // URL 없음: 깨진 링크 대신 회색 서지 텍스트 + "슬라이드에 링크 없음" 안내
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
        var id = slideKey(r.day, r.page);
        h += '<div class="related-item"><a class="cite-link" href="#' + id + '" data-jump="' + id + '">[D' +
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
      "Day " + s.day + " · " + s.page + "쪽  (" + (idx + 1) + " / " + order.length + ")";
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

  /* ---------- 인용/점프 링크 전역 위임 ---------- */
  document.addEventListener("click", function (e) {
    var a = e.target.closest("[data-jump]");
    if (a) { e.preventDefault(); location.hash = "#" + a.dataset.jump; }
  });

  /* ---------- 해시 라우팅 ---------- */
  function onHash() {
    var id = (location.hash || "").replace(/^#/, "");
    if (D.slides[id]) {
      showView("slides");
      showSlide(id, true);
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
    // 내 메모도 검색 대상에 포함(원문과 동일한 1점 가중)
    var memo = getMemo(slideKey(s.day, s.page)).toLowerCase();
    var score = 0, matched = 0;
    tokens.forEach(function (tk) {
      var hit = false;
      if (title.indexOf(tk) >= 0) { score += 3; hit = true; }
      if (terms.indexOf(tk) >= 0) { score += 2; hit = true; }
      if (expl.indexOf(tk) >= 0) { score += 1.5; hit = true; }
      if (lect && lect.indexOf(tk) >= 0) { score += 1.5; hit = true; }
      if (text.indexOf(tk) >= 0) { score += 1; hit = true; }
      if (memo && memo.indexOf(tk) >= 0) { score += 1; hit = true; }
      if (hit) matched++;
    });
    if (matched === 0) return 0;
    // AND 우선: 모든 토큰 포함 시 큰 가산점
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
        '<span class="rc-meta">Day ' + s.day + ' · ' + s.page + '쪽' +
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

    // (a) 수집된 qa 중 단어 겹침 최고 매칭
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

    // (b) 검색 점수 상위 슬라이드
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
    var labelMap = { paper: "논문", "blog/news": "블로그 / 뉴스", tool: "도구 / 코드", etc: "기타" };
    var orderTypes = ["paper", "blog/news", "tool", "etc"];
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
        html += '<div class="ref-row">' +
          '<div class="r-label">' + esc(r.label || r.id) + '</div>' +
          (r.url ? '<div class="r-url"><a href="' + esc(r.url) + '" target="_blank" rel="noopener">' + esc(r.url) + '</a></div>' : '') +
          (cited ? '<div class="cited">인용: ' + cited + '</div>' : '') +
          '</div>';
      });
      html += '</div>';
    });
    box.innerHTML = html;
  }

  /* ---------- 강조 (강사가 강조한 내용) ---------- */
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
    // 카테고리 등장 집계(정의된 순서 우선)
    var cats = HL_CAT_ORDER.filter(function (c) {
      return items.some(function (it) { return it.category === c; });
    });
    // 필터 버튼
    var fhtml = '<button class="hl-fbtn' + (hlFilter === "all" ? " on" : "") +
      '" data-cat="all">전체 <span class="cnt">' + items.length + '</span></button>';
    cats.forEach(function (c) {
      var n = items.filter(function (it) { return it.category === c; }).length;
      fhtml += '<button class="hl-fbtn ' + (HL_CAT_CLASS[c] || "") + (hlFilter === c ? " on" : "") +
        '" data-cat="' + esc(c) + '">' + esc(c) + ' <span class="cnt">' + n + '</span></button>';
    });
    fbox.innerHTML = fhtml;
    // high 우선 정렬(카테고리 순서 유지)
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
          (it.importance === "high" ? '<span class="hl-star" title="강사가 특히 강조">★</span>' : '') +
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

  /* ---------- 연구 흐름 (인터랙티브 개념 탐색) ---------- */
  var flowTracksAll = [];   // 모든 track을 day와 함께 평탄화
  var flowSel = 0;          // 선택된 track 인덱스
  var flowExpanded = {};    // track 인덱스 → 펼친 step 인덱스 Set
  var flowFocus = -1;       // 자동 따라가기 포커스 step

  // note에서 태그 제거 후 첫 문장 — concept 폴백용
  function stripFirstSentence(t) {
    var s = String(t || "").replace(/\[D\d-p\d+\]/g, "").replace(/\(배경지식\)/g, "").trim();
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
    if (!flowTracksAll.length) { stage.innerHTML = '<p class="empty">연구 흐름 데이터가 없습니다.</p>'; return; }
    intro.innerHTML = flows.map(function (f) { return renderText(f.intro || ""); }).join(" ");

    // 갈래 탭
    tabs.innerHTML = flowTracksAll.map(function (t, i) {
      // "제목: 부제" 형태면 앞부분만 칩 라벨로
      var label = String(t.track).split(":")[0].trim();
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
      // 단계 전환 다리(마지막 제외): 다음 기법이 등장한 이유
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

  // 연구 흐름 상호작용(위임)
  document.getElementById("flowStage").addEventListener("click", function (e) {
    var tog = e.target.closest("[data-toggle]");
    var act = e.target.closest("[data-act]");
    var exp = flowExpanded[flowSel] = flowExpanded[flowSel] || new Set();
    var steps = flowTracksAll[flowSel].steps;
    if (tog) {
      // 인용 링크 클릭은 점프에 양보
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
  // 슬라이드 순서대로 메모가 있는 항목만 수집
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
  /* ---------- 메모 내보내기 / 가져오기 왕복(round-trip) ----------
     내보내기 .md 형식:
       # 내 메모 — {제목}
       ## [D{day}-p{page}] {슬라이드 제목}   ← 슬라이드 키를 파싱하는 헤딩
       (빈 줄)
       메모 본문 …
     - 헤딩은 반드시 "## [D{day}-p{page}] " 로 시작한다(가져오기 파서 기준).
     - 메모 본문에 '#' 로 시작하는 줄(예: '## 무언가')이 있어도 헤딩으로 오파싱되지
       않도록, 본문의 줄머리 '#'(앞의 백슬래시 포함)에 백슬래시 하나를 덧붙여
       이스케이프한다. 가져오기 때 정확히 역변환하여 손실 없이 복원한다. */

  // 헤딩 판정: "## [D1-p23] ..." → {day, page}. 아니면 null
  var MEMO_HEADING_RE = /^##\s+\[D(\d+)-p(\d+)\]/;

  // 본문 이스케이프: 줄머리의 (백슬래시*)# 앞에 백슬래시 1개 추가
  function escapeMemoBody(text) {
    return String(text).split("\n").map(function (line) {
      return line.replace(/^(\\*#)/, "\\$1");
    }).join("\n");
  }
  // 본문 언이스케이프: 줄머리의 백슬래시 1개(뒤에 (백슬래시*)# 가 올 때) 제거
  function unescapeMemoBody(text) {
    return String(text).split("\n").map(function (line) {
      return line.replace(/^\\(\\*#)/, "$1");
    }).join("\n");
  }

  // 내보내기 .md 문자열 생성 (테스트 가능하도록 순수 함수로 분리)
  function buildExportMarkdown(arr) {
    var md = "# 내 메모 — " + D.meta.title + "\n\n";
    md += "<!-- 이 파일은 '내 메모' 내보내기 결과입니다. '## [D{일}-p{쪽}]' 헤딩 형식을 유지하면 다시 가져올 수 있습니다. -->\n\n";
    arr.forEach(function (m) {
      var s = m.s || D.slides[m.id] || {};
      var day = s.day, page = s.page;
      if (day == null || page == null) {
        // s 정보가 없으면 id(d{day}p{page})에서 역산
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

  // 가져오기 .md 파싱 → [{id, memo}] (존재 여부는 여기서 판단하지 않음)
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
      // 첫 헤딩 이전의 줄(제목/주석 등)은 무시
    });
    if (cur) entries.push(cur);
    return entries.map(function (e) {
      var body = unescapeMemoBody(e.body.join("\n")).replace(/^\n+/, "").replace(/\s+$/, "");
      return { id: e.id, memo: body };
    });
  }

  // 전체 메모를 마크다운으로 내보내 다운로드 (file:// 에서도 Blob 다운로드 동작)
  function exportMemos() {
    var arr = collectMemos();
    if (!arr.length) { alert("내보낼 메모가 없습니다."); return; }
    var md = buildExportMarkdown(arr);
    var blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "내메모_모델경량화세미나.md";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  // 가져오기 결과 표시
  function showImportResult(msg, kind) {
    var box = document.getElementById("importResult");
    if (!box) return;
    box.hidden = false;
    box.className = "import-result" + (kind ? " " + kind : "");
    box.innerHTML = msg;
  }

  // 메모 변경 후 UI 동기화: 목차 배지 전체 갱신 + 현재 열린 textarea + 모아보기
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

  // 가져오기 본체: .md 텍스트 → localStorage 복원
  function importMemos(text) {
    var parsed = parseMemoMarkdown(text);
    if (!parsed.length) {
      showImportResult("가져올 메모를 찾지 못했습니다. '## [D1-p23] …' 형식의 헤딩이 있는지 확인하세요.", "warn");
      return;
    }
    var toWrite = [];       // 실제 기록 대상 {id, memo}
    var conflicts = [];     // 기존과 다른 내용(덮어쓰기 대상)
    var invalidKeys = [];   // 존재하지 않는 슬라이드 키
    var identical = 0;      // 기존과 동일(변경 없음)
    parsed.forEach(function (p) {
      if (!p.memo) return;                     // 빈 본문은 무시
      if (!D.slides[p.id]) { invalidKeys.push(p.id); return; }
      var existing = getMemo(p.id).trim();
      var incoming = p.memo.trim();
      if (!existing) { toWrite.push({ id: p.id, memo: incoming }); }
      else if (existing === incoming) { identical++; }
      else { conflicts.push({ id: p.id, memo: incoming }); }
    });

    // 덮어쓰기 확인: 개별 confirm 금지, 한 번에 확인
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

    // 건너뜀 집계
    var declined = overwrite ? 0 : conflicts.length;
    var skipped = invalidKeys.length + identical + declined;

    refreshMemoUI();

    // 결과 표시
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

  // 파일 선택 → FileReader 로 읽어 가져오기
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

  /* ---------- 뷰어 크기 조절 (드래그 스플리터) ----------
     3단 그리드(목차 | 슬라이드 | 해설)의 좌/우 경계를 드래그로 조절.
     폭은 CSS 변수(--toc-w, --panel-w)로 반영하고 localStorage에 저장한다. */
  var LS_TOC = "layout:tocW", LS_PANEL = "layout:panelW";
  var DEF_TOC = 260, DEF_PANEL = 380;      // 기본 폭(더블클릭 복원값)
  var MIN_TOC = 160, MIN_PANEL = 260, MIN_CENTER = 320; // 최소 폭 보장
  var SPLIT_W = 14;                         // 스플리터 2개 폭 합(대략)
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
    // 드래그 중 이미지 등에서 mousemove가 끊기지 않도록 전면 overlay 사용
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

  /* ---------- 초기화 ---------- */
  function init() {
    document.getElementById("siteTitle").textContent = D.meta.title;
    document.getElementById("siteSub").textContent = D.meta.lecturer;
    var d = D.meta.days;
    document.getElementById("footerMeta").textContent =
      D.meta.title + " · 총 " + D.meta.total_slides + "장 (Day1 " + d[0].pages + " + Day2 " + d[1].pages + ") · 정적 SPA";
    loadLayout();
    wireSplitters();
    buildTOC();
    buildFAQ();
    buildRefs();
    buildHighlights();
    buildFlow();
    document.getElementById("exportMemosBtn").addEventListener("click", exportMemos);
    wireImport();
    // 초기 뷰: 해시가 슬라이드면 그곳으로, 아니면 첫 슬라이드
    var hid = (location.hash || "").replace(/^#/, "");
    showSlide(D.slides[hid] ? hid : order[0], true);
  }
  init();
})();
