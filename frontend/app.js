/* AISquare — interactivity (landing + auth + mypage) */

/* ===== Inline animated SVG logo ===== */
/* <img src="*.svg"> can't run embedded <style>/@keyframes/@import, so we fetch
   the SVG and inject it inline. This makes the AISquare logo animate and lets
   its Google Fonts @import resolve. */
(function inlineAnimatedLogos(){
  function run(){
    document.querySelectorAll('.answer-logo img[src$=".svg"]').forEach(function(img){
      fetch(img.getAttribute('src')).then(function(r){ return r.text(); }).then(function(text){
        var doc = new DOMParser().parseFromString(text, 'image/svg+xml');
        var svg = doc.documentElement;
        if (!svg || svg.tagName.toLowerCase() !== 'svg') return;
        svg.removeAttribute('width');
        svg.removeAttribute('height');
        svg.setAttribute('aria-label', img.getAttribute('alt') || 'AISquare');
        svg.setAttribute('class', 'answer-logo-svg');
        img.replaceWith(svg);
      }).catch(function(){ /* leave fallback img in place */ });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();

(() => {
  const api = window.AISquareAPI;
  // ===== Toast =====
  const toast = document.getElementById("toast");
  let toastTimer = null;
  function showToast(msg) {
    if (!toast || !msg) return;
    toast.textContent = msg;
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2000);
  }

  // ===== Generic [data-toast] click → preventDefault + toast =====
  document.querySelectorAll("[data-toast]").forEach((el) => {
    el.addEventListener("click", (e) => {
      // Don't intercept if href leads somewhere real
      var href = el.getAttribute && el.getAttribute("href");
      if (href && href !== "#" && !href.startsWith("javascript:")) return;
      if (el.tagName === "A") e.preventDefault();
      showToast(el.dataset.toast);
    });
  });

  // ===== Static product cards → navigate to product detail =====
  document.querySelectorAll(".market-card[data-product-id]").forEach((el) => {
    el.style.cursor = "pointer";
    el.addEventListener("click", () => {
      location.href = "./product.html?id=" + encodeURIComponent(el.dataset.productId);
    });
  });

  // ===== Generic [data-href] handler (use-grid cards, etc.) =====
  document.querySelectorAll("[data-href]").forEach((el) => {
    el.style.cursor = "pointer";
    el.addEventListener("click", () => { location.href = el.dataset.href; });
  });

  // ===== Header search button → market.html search =====
  // (existing searchBtn modal still works; but if no overlay, fall back to market navigation)

  // ===== Top tabs — let the link navigate naturally; just mark active for in-page clicks =====
  document.querySelectorAll("#answerTabs a").forEach((t) => {
    t.addEventListener("click", () => {
      // href === "#" means in-page "filter only"; otherwise let browser navigate.
      if ((t.getAttribute("href") || "").trim() === "#") {
        document.querySelectorAll("#answerTabs a").forEach((x) => x.classList.toggle("active", x === t));
      }
    });
  });

  // ===== Header auth state (instant — sets .aisq-loggedin on <html>) =====
  function syncHeaderAuth() {
    const loggedIn = api && api.isLoggedIn();
    document.documentElement.classList.toggle("aisq-loggedin", !!loggedIn);
    // Populate user chip
    const u = loggedIn ? api.getCurrentUser() : null;
    const av = document.getElementById("hdrAvatar");
    const nm = document.getElementById("hdrName");
    if (av && u) {
      const initial = (u.nickname || u.name || u.username || "U").trim().slice(0, 1).toUpperCase();
      av.textContent = initial;
      const tones = ["#1F3AE0", "#0B0D12", "#1F8A5B", "#B8730F", "#4F2BE8", "#C8331F"];
      const seed = (u.username || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
      av.style.background = tones[seed % tones.length];
    }
    if (nm && u) nm.textContent = u.nickname || u.name || u.username || "사용자";
    // 관리자 클래스 토글
    document.documentElement.classList.toggle("aisq-admin", !!(u && u.isAdmin));
  }
  syncHeaderAuth();
  window.addEventListener("aisquare:auth-change", syncHeaderAuth);

  // 관리자 미처리 카운트 폴링 (admin 헤더 뱃지)
  async function refreshAdminBadge() {
    const badge = document.getElementById("hdrAdminBadge");
    if (!badge) return;
    const u = api && api.isLoggedIn() ? api.getCurrentUser() : null;
    if (!u || !u.isAdmin) { badge.classList.add("hidden"); return; }
    try {
      const res = await fetch(api.API_BASE + "/admin/unread-count", {
        headers: { "Authorization": "Bearer " + api.getJwt() },
      });
      if (!res.ok) return;
      const data = await res.json();
      const total = data.total || 0;
      const link = badge.closest(".hdr-admin");
      if (total > 0) {
        // dot 형태 — 숫자는 hover tooltip에만 표시
        badge.classList.remove("hidden");
        if (link) link.title = `관리자 콘솔 · 미처리 신고 ${data.reports}건 · NaverPay 전환 ${data.naverExchanges}건`;
      } else {
        badge.classList.add("hidden");
        if (link) link.title = "관리자 콘솔";
      }
    } catch (e) { /* silent */ }
  }
  refreshAdminBadge();
  setInterval(refreshAdminBadge, 30000);  // 30초마다 폴링

  // Header logout button (on mypage)
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await api.auth.logout();
      showToast("로그아웃되었습니다.");
      window.dispatchEvent(new Event("aisquare:auth-change"));
      setTimeout(() => { location.href = "./index.html"; }, 400);
    });
  }

  // ===== Search button + overlay =====
  const searchBtn = document.getElementById("searchBtn");
  const overlay = document.getElementById("searchOverlay");
  const input = document.getElementById("searchInput");
  if (searchBtn && overlay) {
    function openSearch() {
      overlay.classList.add("is-open");
      setTimeout(() => input && input.focus(), 80);
    }
    function closeSearch() { overlay.classList.remove("is-open"); }
    searchBtn.addEventListener("click", openSearch);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeSearch();
    });
    document.querySelectorAll("[data-search-close]").forEach((el) => {
      el.addEventListener("click", closeSearch);
    });
    document.querySelectorAll("[data-search-suggest]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const term = btn.textContent.trim();
        input.value = term;
        closeSearch();
        showToast(`"${term}" 검색 결과는 곧 준비됩니다`);
      });
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeSearch();
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openSearch();
      }
    });
  }

  // ===== Latest section: arrow rotation =====
  // Move first card to end (next) or last to first (prev).
  const latestGrid = document.getElementById("latestGrid");
  document.querySelectorAll("#latestArrows [data-dir]").forEach((el) => {
    const act = () => {
      if (!latestGrid) return;
      const cards = latestGrid.children;
      if (cards.length < 2) return;
      if (el.dataset.dir === "next") {
        latestGrid.appendChild(cards[0]);
      } else {
        latestGrid.insertBefore(cards[cards.length - 1], cards[0]);
      }
    };
    el.addEventListener("click", act);
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); act(); }
    });
  });

  // ===== Service tabs inside each product block — 실제 카드 필터링 =====
  // 칩 라벨에서 키워드 추출해서 카드 제목과 매칭. 매칭되는 카드만 표시,
  // 매칭 0개면 "더 많은 결과 보기" 안내 + market.html 검색으로 이동 링크.
  const KEYWORD_MAP = {
    "카피라이팅 프롬프트": ["카피", "톤앤매너", "광고 카피"],
    "SEO 자동화":          ["SEO", "키워드", "검색"],
    "콘텐츠 캘린더":       ["캘린더", "리포트", "주간", "월간", "발행 일정"],
    "광고 최적화":         ["광고", "최적화", "퍼포먼스", "SNS 광고"],
    "영상 스크립트":       ["스크립트", "유튜브", "후킹", "시청"],
    "썸네일 생성":         ["썸네일", "Midjourney", "DALL", "이미지"],
    "자막 자동화":         ["자막", "릴스", "쇼츠"],
    "SNS 큐레이션":        ["SNS", "인스타", "큐레이션", "감정"],
  };

  document.querySelectorAll(".product-block").forEach((block) => {
    const tabs = block.querySelectorAll(".service-tab");
    const grid = block.querySelector(".market-grid");
    if (!grid) return;
    const allCards = Array.from(grid.querySelectorAll(".market-card"));
    // 카드별 검색 텍스트 캐싱
    const cardText = allCards.map(c => (c.querySelector("h3")?.textContent || "").toLowerCase());

    function filterByService(serviceLabel) {
      const keywords = (KEYWORD_MAP[serviceLabel] || [serviceLabel]).map(k => k.toLowerCase());
      let matchCount = 0;
      allCards.forEach((card, i) => {
        const hit = keywords.some(k => cardText[i].includes(k));
        card.style.display = hit ? "" : "none";
        if (hit) matchCount++;
      });

      // empty-state 처리
      let empty = grid.querySelector(".service-empty");
      if (matchCount === 0) {
        if (!empty) {
          empty = document.createElement("div");
          empty.className = "service-empty";
          empty.style.cssText = "grid-column: 1 / -1; padding: 40px 20px; background: #fafbfc; border: 1px dashed #d4dae4; border-radius: 14px; text-align: center; color: #677181; font-size: 14px;";
          grid.appendChild(empty);
        }
        empty.innerHTML = `이 카테고리의 상품은 마켓에서 더 확인할 수 있습니다.<br><a href="./market.html?q=${encodeURIComponent(serviceLabel)}" style="display:inline-block;margin-top:14px;padding:10px 22px;background:#050505;color:#fff;border-radius:8px;font-weight:800;font-size:13px;text-decoration:none;">마켓에서 "${serviceLabel}" 검색하기 →</a>`;
        empty.style.display = "";
      } else if (empty) {
        empty.style.display = "none";
      }
    }

    tabs.forEach((tab) => {
      tab.addEventListener("click", (e) => {
        e.preventDefault();
        tabs.forEach((t) => t.classList.toggle("is-active", t === tab));
        filterByService(tab.dataset.service);
      });
    });

    // 첫 로드 시 .is-active 칩 기준으로 필터 적용
    const initial = block.querySelector(".service-tab.is-active");
    if (initial) filterByService(initial.dataset.service);
  });

  // ===== Login form =====
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const submit = loginForm.querySelector("[type=submit]");
      const username = loginForm.username.value.trim();
      const password = loginForm.password.value;
      if (!username || !password) { showToast("아이디·비밀번호를 입력해주세요."); return; }
      submit.disabled = true; submit.textContent = "로그인 중...";
      try {
        await api.auth.login({ username, password });
        window.dispatchEvent(new Event("aisquare:auth-change"));
        showToast("로그인되었습니다.");
        setTimeout(() => { location.href = "./index.html"; }, 500);
      } catch (err) {
        showToast(err.message || "로그인에 실패했습니다.");
        submit.disabled = false; submit.textContent = "로그인";
      }
    });
  }

  // ===== Register form =====
  const registerForm = document.getElementById("registerForm");
  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = registerForm;
      if (f.password.value !== f.passwordConfirm.value) {
        showToast("비밀번호가 일치하지 않습니다."); return;
      }
      if (f.password.value.length < 8) {
        showToast("비밀번호는 8자 이상이어야 합니다."); return;
      }
      const submit = f.querySelector("[type=submit]");
      submit.disabled = true; submit.textContent = "가입 중...";
      try {
        await api.auth.register({
          name: f.name.value.trim(),
          username: f.username.value.trim(),
          nickname: f.nickname.value.trim(),
          email: f.email.value.trim(),
          phone: (f.phone && f.phone.value || '').trim(),
          password: f.password.value,
        });
        await api.auth.login({ username: f.username.value.trim(), password: f.password.value });
        window.dispatchEvent(new Event("aisquare:auth-change"));
        showToast("회원가입이 완료되었습니다.");
        setTimeout(() => { location.href = "./index.html"; }, 500);
      } catch (err) {
        showToast(err.message || "회원가입에 실패했습니다.");
        submit.disabled = false; submit.textContent = "회원가입";
      }
    });
  }

  // ===== My page =====
  if (document.querySelector(".mypage-section")) initMyPage(showToast, api);

  // ===== Market page =====
  if (document.querySelector(".market-section") && document.getElementById("productGrid")) initMarket(showToast, api);

  // ===== Ranking page =====
  if (document.querySelector(".ranking-section")) initRanking(showToast, api);
})();

// ===== Lucide icon set (matching YR branch usage) =====
const ICON = {
  wallet:     `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>`,
  coins:      `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/></svg>`,
  plus:       `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`,
  refresh:    `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg>`,
  arrowIn:    `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 7 7 17"/><path d="M17 17H7V7"/></svg>`,
  arrowOut:   `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7"/><path d="M7 7h10v10"/></svg>`,
  download:   `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>`,
  check:      `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>`,
  alert:      `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`,
  edit:       `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4Z"/></svg>`,
  pen:        `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4Z"/></svg>`,
  shield:     `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>`,
};

// ===== Market =====
async function initMarket(showToast, api) {
  const grid = document.getElementById("productGrid");
  const featured = document.getElementById("featuredGrid");
  const filterRow = document.getElementById("filterRow");
  const countEl = document.getElementById("marketCount");
  const statTotal = document.getElementById("statTotal");
  const statRating = document.getElementById("statRating");
  const qInput = document.getElementById("marketQ");
  const sortBtn = document.getElementById("sortBtn");
  const sortLabel = document.getElementById("sortLabel");
  const catNav = document.getElementById("categoryNav");

  const SORT_OPTIONS = [
    ["latest",     "최신순"],
    ["rating",     "평점 높은순"],
    ["reviews",    "리뷰 많은순"],
    ["price-asc",  "가격 낮은순"],
    ["price-desc", "가격 높은순"],
  ];

  const state = { fileType: "ALL", q: "", sort: "latest", category: "all" };

  // Render featured row once
  const all = (await api.products.list({})).items;
  if (statTotal) statTotal.innerHTML = `${all.length}<em>건</em>`;
  if (statRating) {
    const avg = all.reduce((s, p) => s + p.rating, 0) / Math.max(1, all.length);
    statRating.innerHTML = `${avg.toFixed(1)}<em>점</em>`;
  }
  if (featured) {
    const top = [...all].sort((a, b) => b.reviewCount - a.reviewCount).slice(0, 4);
    featured.innerHTML = top.map(p => productCard(p)).join("");
    featured.querySelectorAll(".pcard").forEach(el =>
      el.addEventListener("click", () => gotoProduct(el.dataset.id)));
  }

  async function render() {
    // BE는 ?search= 받음. q 라는 옛 이름으로 보내고 있어서 항상 무시되던 버그 fix.
    const params = { fileType: state.fileType, search: state.q, sort: state.sort };
    let { items } = await api.products.list(params);
    if (state.category && state.category !== "all") {
      items = items.filter(p =>
        p.category === state.category ||
        (p.tags || []).some(t => t.toLowerCase() === state.category.toLowerCase())
      );
    }
    countEl.textContent = items.length;
    await renderFilters();
    grid.innerHTML = items.length === 0
      ? `<div class="market-empty" style="grid-column:1/-1"><strong>조건에 맞는 노하우가 없습니다</strong><span>다른 카테고리·필터를 시도해보세요.</span></div>`
      : items.map(p => productCard(p)).join("");
    grid.querySelectorAll(".pcard").forEach(el => {
      el.addEventListener("click", () => gotoProduct(el.dataset.id));
    });
  }

  async function renderFilters() {
    const counts = { ALL: all.length };
    for (const p of all) counts[p.fileType] = (counts[p.fileType] || 0) + 1;
    const types = ["ALL", "PDF", "MP4", "PNG", "JPG", "ZIP"];
    filterRow.innerHTML = types
      .filter(t => t === "ALL" || counts[t])
      .map(t => `<button class="filter-pill ${state.fileType === t ? "is-active" : ""}" data-ft="${t}">${t === "ALL" ? "전체" : t}<span class="count">${counts[t] || 0}</span></button>`)
      .join("");
    filterRow.querySelectorAll(".filter-pill").forEach(b => {
      b.addEventListener("click", () => { state.fileType = b.dataset.ft; render(); });
    });
  }

  catNav.querySelectorAll(".category-chip").forEach(b => {
    b.addEventListener("click", () => {
      catNav.querySelectorAll(".category-chip").forEach(x => x.classList.toggle("is-active", x === b));
      state.category = b.dataset.cat;
      render();
    });
  });

  qInput.addEventListener("input", debounce(() => { state.q = qInput.value.trim(); render(); }, 200));
  sortBtn.addEventListener("click", () => {
    const i = SORT_OPTIONS.findIndex(([k]) => k === state.sort);
    const next = SORT_OPTIONS[(i + 1) % SORT_OPTIONS.length];
    state.sort = next[0]; sortLabel.textContent = next[1];
    render();
  });

  render();
}

function productCard(p) {
  const stars = (p.rating || 0).toFixed(1);
  return `<article class="pcard" data-id="${esc(p.id)}" data-title="${esc(p.title)}">
    <div class="cover">
      <img src="./assets/${esc(p.cover)}" alt="" />
      ${p.badge ? `<span class="badge ${p.badge.toLowerCase()}">${p.badge}</span>` : ""}
    </div>
    <h4>${esc(p.title)}</h4>
    <div class="meta"><span class="star">★ ${stars}</span><span>(${n(p.reviewCount)})</span><span>·</span><span>${esc(p.fileType)}</span></div>
    <div class="price">${n(p.priceSquare)}<em style="font-style:normal;font-size:11px;font-weight:800;color:#677181;margin-left:4px">SQ</em></div>
    <div class="seller">${esc(p.sellerName)}</div>
  </article>`;
}

function gotoProduct(id) { location.href = './product.html?id=' + encodeURIComponent(id); }

function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

// ===== Ranking =====
async function initRanking(showToast, api) {
  const podiumEl = document.getElementById("podium");
  const topProductsEl = document.getElementById("topProducts");
  const topSellersEl = document.getElementById("topSellers");
  const hotEl = document.getElementById("hotGrid");

  const [{ items: byReviews }, { items: byLatest }, { items: sellers }] = await Promise.all([
    api.products.list({ sort: "reviews" }),
    api.products.list({ sort: "latest" }),
    api.sellers.list(),
  ]);

  // Podium — top 3 products
  const top3 = byReviews.slice(0, 3);
  const MEDAL = ["🥇 1ST", "🥈 2ND", "🥉 3RD"];
  podiumEl.innerHTML = top3.map((p, i) => `
    <article class="podium-card r${i+1}" data-id="${esc(p.id)}" data-title="${esc(p.title)}">
      <span class="rank">${MEDAL[i]}</span>
      <div class="cover"><img src="./assets/${esc(p.cover)}" alt="" /></div>
      <div class="title">${esc(p.title)}</div>
      <div class="seller">${esc(p.sellerName)} · ${esc(p.fileType)}</div>
      <div class="foot">
        <span class="star">★ ${p.rating.toFixed(1)} <span style="color:#9b9b9b;font-weight:700">(${n(p.reviewCount)})</span></span>
        <span class="price">${n(p.priceSquare)}<em>SQ</em></span>
      </div>
    </article>`).join("");
  podiumEl.querySelectorAll(".podium-card").forEach(el =>
    el.addEventListener("click", () => gotoProduct(el.dataset.id)));

  topProductsEl.innerHTML = byReviews.slice(0, 10).map((p, i) => {
    const rank = i + 1;
    const cls = rank <= 3 ? `top-${rank}` : "";
    return `<div class="rk-row ${cls}" data-id="${esc(p.id)}" data-title="${esc(p.title)}">
      <div class="rk-rank">${String(rank).padStart(2, "0")}</div>
      <div class="rk-info">
        <div class="title">${esc(p.title)}</div>
        <div class="sub">${esc(p.sellerName)} · <b>★ ${p.rating.toFixed(1)}</b> · 리뷰 ${n(p.reviewCount)}</div>
      </div>
      <div class="rk-price">${n(p.priceSquare)}<em>SQ</em></div>
    </div>`;
  }).join("");
  topProductsEl.querySelectorAll(".rk-row").forEach(el =>
    el.addEventListener("click", () => gotoProduct(el.dataset.id)));

  const tones = ["#1F3AE0", "#0B0D12", "#1F8A5B", "#B8730F", "#4F2BE8", "#C8331F"];
  topSellersEl.innerHTML = sellers.slice(0, 8).map((s, i) => {
    const seed = (s.username || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    const bg = tones[seed % tones.length];
    const init = (s.name || s.username).slice(0, 1).toUpperCase();
    return `<div class="seller-row" data-name="${esc(s.name)}">
      <div class="rk-rank">${String(i + 1).padStart(2, "0")}</div>
      <span class="rk-avatar" style="background:${bg}">${esc(init)}</span>
      <div>
        <div class="name">${esc(s.name)}</div>
        <div class="uid">@${esc(s.username)}</div>
      </div>
      <div class="stats">
        <b>${n(s.sold)}</b>건 · ★ ${s.rating.toFixed(1)}
        <div class="tokenbar"><i style="width:${s.tokenPct}%"></i></div>
      </div>
    </div>`;
  }).join("");
  topSellersEl.querySelectorAll(".seller-row").forEach(el =>
    el.addEventListener("click", () => showToast(`${el.dataset.name} 판매자 페이지 (준비 중)`)));

  hotEl.innerHTML = byLatest.slice(0, 8).map(p => productCard(p)).join("");
  hotEl.querySelectorAll(".pcard").forEach(el =>
    el.addEventListener("click", () => gotoProduct(el.dataset.id)));

  document.querySelectorAll("#rankingTabs button").forEach(b => {
    b.addEventListener("click", () => {
      document.querySelectorAll("#rankingTabs button").forEach(x => x.classList.toggle("is-active", x === b));
      showToast(`${b.textContent} 랭킹 (데이터는 mock)`);
    });
  });
}

// ===== My Page module (separated for readability) =====
async function initMyPage(showToast, api) {
  // Gate: must be logged in
  if (!api.isLoggedIn()) {
    showToast("로그인이 필요합니다.");
    setTimeout(() => { location.href = "./login.html"; }, 400);
    return;
  }

  // Populate sidebar user card
  try {
    let u;
    try { u = await api.user.getMe(); }
    catch (e) { console.warn('[mypage] getMe failed, falling back to local user:', e.message); u = api.getCurrentUser(); }
    const av = document.getElementById("mpAv");
    if (av) {
      const init = (u?.nickname || u?.name || u?.username || "U").trim().slice(0, 1).toUpperCase();
      av.textContent = init;
      const tones = ["#1F3AE0", "#0B0D12", "#1F8A5B", "#B8730F", "#4F2BE8", "#C8331F"];
      const seed = (u?.username || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
      av.style.background = tones[seed % tones.length];
    }
    const nm = document.getElementById("mpName"); if (nm) nm.textContent = u?.nickname || u?.name || u?.username || "";
    const ui = document.getElementById("mpUid");  if (ui) ui.textContent = "@" + (u?.username || "user");
    const ps = document.getElementById("mpPass");
    if (ps) {
      ps.className = "pass " + (u?.passVerified ? "on" : "off");
      ps.textContent = u?.passVerified ? "● PASS 인증 완료" : "○ PASS 미인증";
    }
  } catch (e) { /* ignore */ }

  const main = document.querySelector(".mypage-main");
  const tabs = document.querySelectorAll(".mypage-tab");

  function go(id) {
    tabs.forEach(t => t.classList.toggle("is-active", t.dataset.tab === id));
    location.hash = id;
    render(id);
  }

  tabs.forEach(t => t.addEventListener("click", () => go(t.dataset.tab)));
  // Accept both ?tab=wishlist (header heart/cart links) and #wishlist
  const qs = new URLSearchParams(location.search);
  const initial = qs.get("tab") || (location.hash || "").slice(1) || "account";
  go(["account","wallet","purchases","sales","wishlist","cart"].includes(initial) ? initial : "account");

  async function render(id) {
    main.innerHTML = `<div class="empty-state" style="padding:48px"><span>불러오는 중...</span></div>`;
    if (id === "account")   return renderAccount(main, api, showToast);
    if (id === "wallet")    return renderWallet(main, api, showToast);
    if (id === "purchases") return renderOrders(main, api, showToast, "purchase");
    if (id === "sales")     return renderOrders(main, api, showToast, "sales");
    if (id === "wishlist")  return renderWishlist(main, api, showToast);
    if (id === "cart")      return renderCart(main, api, showToast);
  }
}

function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function fmtDate(d) { return new Date(d).toLocaleDateString("ko-KR", { year:"numeric", month:"2-digit", day:"2-digit" }); }
function n(v) { return Number(v ?? 0).toLocaleString("ko-KR"); }

async function renderAccount(root, api, showToast) {
  const user = await api.user.getMe();
  const passVerified = user?.passVerified;
  root.innerHTML = `
    <h2>계정 정보</h2>
    <p class="sub">AISquare 마켓에서 사용하는 회원 정보입니다.</p>
    <div class="kv-row">
      <span class="k">아이디</span>
      <span class="v mono">${esc(user?.username || "-")}</span>
      <span></span>
    </div>
    <div class="kv-row" data-field="nickname">
      <span class="k">닉네임</span>
      <span class="v">${esc(user?.nickname || "-")}</span>
      <button class="edit" type="button">${ICON.edit} 수정</button>
    </div>
    <div class="kv-row" data-field="email">
      <span class="k">이메일</span>
      <span class="v">${esc(user?.email || "-")}</span>
      <button class="edit" type="button">${ICON.edit} 수정</button>
    </div>
    <div class="kv-row">
      <span class="k">이름</span>
      <span class="v">${esc(user?.name || "-")}</span>
      <span></span>
    </div>

    <h2 style="margin-top:36px">PASS 본인인증</h2>
    <p class="sub">구매·판매·리뷰 시 KT · SKT · LG U+ 본인인증이 필요합니다.</p>
    <div class="kv-row">
      <span class="k">인증 상태</span>
      <span class="v">
        ${passVerified
          ? `<span class="pill-badge green">● 인증 완료</span>`
          : `<span class="pill-badge gray">● 미인증</span>`}
      </span>
      <button class="${passVerified ? 'btn-danger' : 'btn-ink'}" id="passBtn" type="button">
        ${ICON.shield} ${passVerified ? "인증 해제" : "PASS 인증"}
      </button>
    </div>
    ${passVerified ? `
      <div class="kv-row">
        <span class="k">인증 이름</span>
        <span class="v">${esc(user?.passName || user?.name || "-")}</span><span></span>
      </div>
      <div class="kv-row">
        <span class="k">전화번호</span>
        <span class="v mono">${user?.phone ? esc(String(user.phone).replace(/\D/g, "").replace(/^(\d{3})(\d{3,4})(\d{4})$/, "$1-$2-$3")) : "-"}</span><span></span>
      </div>
      <div class="kv-row">
        <span class="k">인증 일시</span>
        <span class="v muted">${user?.passVerifiedAt ? fmtDate(user.passVerifiedAt) : "-"}</span><span></span>
      </div>
    ` : ``}
  `;

  // Inline editing for nickname / email
  root.querySelectorAll(".kv-row[data-field]").forEach(row => {
    const btn = row.querySelector(".edit");
    btn.addEventListener("click", async () => {
      const field = row.dataset.field;
      const current = row.querySelector(".v").textContent.trim();
      const next = prompt(field === "email" ? "새 이메일을 입력하세요" : "새 닉네임을 입력하세요", current === "-" ? "" : current);
      if (next == null || next.trim() === "") return;
      try {
        await api.user.updateProfile({ [field]: next.trim() });
        const u = api.getCurrentUser();
        if (u) { u[field] = next.trim(); api.setCurrentUser(u); }
        showToast("저장되었습니다.");
        renderAccount(root, api, showToast);
      } catch (e) { showToast(e.message || "저장에 실패했습니다."); }
    });
  });

  document.getElementById("passBtn").addEventListener("click", async () => {
    if (passVerified) {
      if (!confirm("PASS 본인인증을 해제하시겠습니까?\n해제 후에는 구매·판매·리뷰가 제한됩니다.")) return;
      const btn = document.getElementById("passBtn");
      btn.disabled = true;
      try {
        await api.auth.revokePass();
        showToast("PASS 인증이 해제되었습니다.");
        try { await api.user.getMe(); } catch {}
        renderAccount(root, api, showToast);
      } catch (e) {
        btn.disabled = false;
        showToast(e.message || 'PASS 해제 실패');
      }
      return;
    }
    // Direct PortOne PASS flow — no custom modal wrapper
    startPassVerification(user, api, showToast, async () => {
      try { await api.user.getMe(); } catch {}
      renderAccount(root, api, showToast);
      const ps = document.getElementById("mpPass");
      const u2 = api.getCurrentUser();
      if (ps && u2) {
        ps.className = "pass " + (u2.passVerified ? "on" : "off");
        ps.textContent = u2.passVerified ? "● PASS 인증 완료" : "○ PASS 미인증";
      }
    });
  });

  // 회원 탈퇴 섹션
  const dangerSection = document.createElement('div');
  dangerSection.innerHTML = `
    <h2 style="margin-top:48px;color:#c0392b;">회원 탈퇴</h2>
    <p class="sub">탈퇴 시 계정과 등록한 상품·리뷰·찜·장바구니·포인트 내역이 모두 영구 삭제되며 복구할 수 없습니다. 탈퇴 후에는 동일한 이메일·아이디로 즉시 재가입할 수 있습니다.</p>
    <div style="display:flex;align-items:center;justify-content:space-between;gap:20px;padding:16px 20px;margin-top:8px;border:1px solid #f3d7d3;background:#fef6f5;border-radius:12px;">
      <div>
        <div style="font-size:14px;font-weight:800;color:#c0392b;">계정 삭제</div>
        <div style="font-size:12.5px;color:#9b9b9b;font-weight:600;margin-top:3px;">이 작업은 되돌릴 수 없습니다.</div>
      </div>
      <button class="btn-danger" id="deleteAccountBtn" type="button">${ICON.trash || '🗑'} 회원 탈퇴</button>
    </div>
  `;
  root.appendChild(dangerSection);
  document.getElementById("deleteAccountBtn").addEventListener("click", async () => {
    const uname = user?.username || '';
    const input = prompt('정말로 탈퇴하시겠습니까?\n계정과 모든 데이터가 영구 삭제됩니다.\n\n확인을 위해 본인 아이디(' + uname + ')를 입력해 주세요:');
    if (input === null) return;
    if (input.trim() !== uname) { showToast("아이디가 일치하지 않습니다."); return; }
    const btn = document.getElementById("deleteAccountBtn");
    btn.disabled = true; btn.textContent = "탈퇴 처리 중...";
    try {
      await api.auth.deleteAccount();
      showToast("탈퇴가 완료되었습니다. 이용해 주셔서 감사합니다.");
      setTimeout(() => { location.href = "./index.html"; }, 1200);
    } catch (e) {
      btn.disabled = false; btn.textContent = "회원 탈퇴";
      showToast(e.message || "탈퇴에 실패했습니다.");
    }
  });
}

// ===== PASS phone-verification (REAL PortOne SDK — no custom wrapper) =====
// Loads https://cdn.iamport.kr/v1/iamport.js, fetches merchant code from BE,
// then opens the real iamport certification popup (carrier PASS / NICE / inicis).
// The BE verifies the imp_uid via the iamport REST API.
function startPassVerification(user, api, showToast, onDone) {
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if ([...document.scripts].some(s => s.src === src)) return resolve();
      const s = document.createElement('script');
      s.src = src; s.onload = resolve; s.onerror = () => reject(new Error('SDK 로드 실패: ' + src));
      document.head.appendChild(s);
    });
  }

  (async () => {
    showToast('본인인증 창을 여는 중...');
    try {
      await loadScript('https://cdn.iamport.kr/v1/iamport.js');
      const cfg = await api.auth.impConfig();
      if (!cfg.impCode) throw new Error('IMP_CODE 미설정 — BE .env 확인');
      IMP.init(cfg.impCode);
      const merchantUid = 'mid_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      IMP.certification({
        merchant_uid: merchantUid,
        name: user?.name || undefined,
        phone: (user?.phone || '').replace(/\D/g, '') || undefined,
        popup: true,
        min_age: 14,
      }, async (rsp) => {
        if (!rsp.success) {
          showToast('본인인증 실패: ' + (rsp.error_msg || rsp.error_code || '취소됨'));
          return;
        }
        try {
          await api.auth.passVerify(rsp.imp_uid, merchantUid);
          showToast('PASS 본인인증이 완료되었습니다.');
          onDone && onDone();
        } catch (e) {
          showToast(e.message || 'BE 검증 실패');
        }
      });
    } catch (e) {
      console.error('PASS start failed:', e);
      showToast(e.message || '본인인증을 시작할 수 없습니다.');
    }
  })();
}

async function renderWallet(root, api, showToast) {
  window.__aisqRepaintWallet = () => { try { paint(); } catch {} };
  // ── Toss 충전 return 처리 (successUrl/failUrl로 돌아온 경우 한 번 실행) ──
  const _qs = new URLSearchParams(location.search);
  const _chargeFlag = _qs.get("charge");
  if (_chargeFlag === "success") {
    const chargeId = _qs.get("id");
    const paymentKey = _qs.get("paymentKey");
    const orderId = _qs.get("orderId");
    const amount = parseInt(_qs.get("amount"), 10);
    history.replaceState({}, "", "./mypage.html?tab=wallet");
    if (chargeId && paymentKey && orderId && amount) {
      try {
        const API_BASE = window.AISquareAPI.API_BASE;
        const jwt = window.AISquareAPI.getJwt();
        const res = await fetch(API_BASE + `/wallet/charge/${encodeURIComponent(chargeId)}/confirm`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + jwt },
          body: JSON.stringify({ paymentKey, amount }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "결제 확정 실패");
        showToast("Square 충전이 완료되었습니다.");
      } catch (e) {
        console.error("charge confirm failed:", e);
        showToast(e.message || "결제 확정 실패");
      }
    }
  } else if (_chargeFlag === "fail") {
    history.replaceState({}, "", "./mypage.html?tab=wallet");
    showToast("결제가 취소되었습니다.");
  }

  let active = "square";
  async function paint() {
    const isSquare = active === "square";
    const [bal, hist] = await Promise.all([
      isSquare ? api.square.getBalance() : api.point.getBalance(),
      isSquare ? api.square.getHistory({ limit: 20 }) : api.point.getHistory({ limit: 20 }),
    ]);
    root.innerHTML = `
      <h2>지갑 관리</h2>
      <p class="sub">Square 지갑은 구매·판매 결제용, Point 지갑은 할인 적립용입니다.</p>

      <div class="wallet-tabs">
        <button class="wallet-tab ${isSquare ? "is-active" : ""}" data-w="square">${ICON.wallet} Square Wallet</button>
        <button class="wallet-tab ${!isSquare ? "is-active" : ""}" data-w="point">${ICON.coins} Point Wallet</button>
      </div>

      <div class="wallet-balance ${isSquare ? "" : "point"}">
        <div>
          <div class="label">${isSquare ? "Square 잔액" : "Point 잔액 (총)"}</div>
          <div class="amt">${n(bal.balance)}<em>${isSquare ? "Square" : "Point"}</em></div>
          <div class="note">${isSquare ? `≈ ₩${n(bal.balance)} (결제 기준)` : `≈ ₩${n(bal.balance)} 결제 할인 가능`}</div>
        </div>
        <div class="wallet-actions">
          ${isSquare ? `<button class="btn-ink" id="chargeBtn">${ICON.plus} 충전</button>` : `<button class="btn-ink" id="naverExBtn">${ICON.arrowIn} 네이버페이 전환</button>`}
          <button class="btn-ghost" id="refreshBtn">${ICON.refresh} 새로고침</button>
        </div>
      </div>

      <div class="wallet-info">
        ${isSquare
          ? `• 결제 시 <b>1 Square = 1원</b><br>• 충전 시 <b>1,000 Square = 1,100원</b> (수수료 10% 포함)<br>• 거래 시 판매자 5% / 구매자 5% 부담 (양쪽 <b>2% Square 캐시백</b> 적립)`
          : `• 충전·구매 캐시백(NaverPay 전환용) → <b>PAID 포인트</b><br>• 리뷰 작성·이벤트 → <b>ACTIVITY 포인트</b> (사이트 내 결제 할인만)<br>• Point는 출금 불가 · 1 Point = 1원 할인<br>• 거래 캐시백은 Square로 적립됩니다`}
      </div>

      <h3 style="margin:0 0 12px;font-size:15px;font-weight:800;color:#677181">${isSquare ? "거래 내역" : "적립 내역"}</h3>
      ${hist.items.length === 0
        ? `<div class="empty-state"><strong>내역이 없습니다</strong></div>`
        : `<div class="history-list">${hist.items.map(it => {
            const isIn = it.amount > 0;
            return `<div class="history-row">
              <div class="meta"><strong><span style="display:inline-flex;align-items:center;gap:6px">${isIn ? ICON.arrowIn : ICON.arrowOut}${esc(it.description || it.type)}</span></strong><time>${fmtDate(it.createdAt)}</time></div>
              <span class="amt ${isIn ? "plus" : "minus"}">${isIn ? "+" : ""}${n(it.amount)}</span>
            </div>`;
          }).join("")}</div>`}
    `;

    root.querySelectorAll(".wallet-tab").forEach(b => b.addEventListener("click", () => { active = b.dataset.w; paint(); }));
    root.querySelector("#refreshBtn")?.addEventListener("click", () => { showToast("새로고침했습니다."); paint(); });
    root.querySelector("#chargeBtn")?.addEventListener("click", () => openChargeModal(api, showToast));
    root.querySelector("#naverExBtn")?.addEventListener("click", async () => {
      const me = api.getCurrentUser() || {};
      if (!me.phoneVerified && !me.passVerified) {
        showToast("PASS 본인인증이 필요합니다."); setTimeout(() => location.hash = "account", 800); return;
      }
      const raw = prompt("네이버페이로 전환할 PAID 포인트 금액을 입력하세요\n(보유 PAID 포인트 한도 내, 1 Point = 1 NaverPoint)", "500");
      if (!raw) return;
      const v = Math.floor(Number(raw));
      if (!v || v <= 0) { showToast("올바른 금액을 입력해주세요."); return; }
      try {
        const res = await fetch(window.AISquareAPI.API_BASE + '/points/exchange-naver', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + window.AISquareAPI.getJwt() },
          body: JSON.stringify({ amount: v }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || '전환 실패');
        showToast(`전환 요청 접수됨 (PENDING). 네이버 측 확정 시 NaverPoint 적립됩니다.`);
        paint();
      } catch (e) { showToast(e.message || '전환 실패'); }
    });
  }
  paint();
}

// ── Square 충전 모달 (Toss SDK 흐름) ──
async function openChargeModal(api, showToast) {
  const me = api.getCurrentUser() || {};
  if (!me.phoneVerified && !me.passVerified) {
    showToast("PASS 본인인증이 필요합니다.");
    setTimeout(() => location.hash = "account", 800);
    return;
  }
  document.querySelectorAll(".charge-modal-bg").forEach(n => n.remove());

  const PRESETS = [5000, 10000, 30000, 50000, 100000, 300000];
  let amount = 10000;

  const wrap = document.createElement("div");
  wrap.className = "charge-modal-bg";
  wrap.style.cssText = "position:fixed;inset:0;background:rgba(11,13,18,0.55);display:flex;align-items:center;justify-content:center;z-index:9999;backdrop-filter:blur(2px);";
  wrap.innerHTML = `
    <div class="charge-modal" style="background:#fff;width:min(440px,calc(100vw - 32px));border-radius:16px;padding:28px 28px 22px;box-shadow:0 20px 60px rgba(0,0,0,0.25);">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
        <h3 style="margin:0;font-size:18px;font-weight:900;color:#0b0d12;">Square 충전</h3>
        <button type="button" id="cmClose" aria-label="닫기" style="background:none;border:0;font-size:22px;color:#677181;cursor:pointer;line-height:1;">×</button>
      </div>
      <p style="margin:0 0 18px;font-size:12.5px;color:#677181;">1,100원당 1,000 Square (수수료 10%) · 충전 금액의 0.1%가 Point로 적립됩니다.</p>

      <div style="font-size:12px;font-weight:800;color:#677181;letter-spacing:0.04em;margin-bottom:8px;">충전 금액 (Square)</div>
      <div id="cmPresets" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px;">
        ${PRESETS.map(p => `<button type="button" class="cm-preset" data-v="${p}" style="padding:10px 6px;border:1px solid #d4dae4;background:#fff;border-radius:10px;font-weight:700;font-size:13px;color:#1f2a38;cursor:pointer;">${p.toLocaleString()}</button>`).join("")}
      </div>

      <label style="display:block;margin-bottom:18px;">
        <span style="display:block;font-size:12px;font-weight:800;color:#677181;letter-spacing:0.04em;margin-bottom:6px;">직접 입력</span>
        <input id="cmAmount" type="number" min="5000" step="1000" value="${amount}" inputmode="numeric" style="width:100%;padding:11px 12px;border:1px solid #d4dae4;border-radius:10px;font-size:15px;font-weight:700;color:#1f2a38;outline:none;" />
        <span id="cmHint" style="display:block;margin-top:6px;font-size:11.5px;color:#677181;">최소 5,000 · 1,000 단위</span>
      </label>

      <div style="background:#f5f7fb;border-radius:12px;padding:14px 16px;margin-bottom:18px;">
        <div style="display:flex;justify-content:space-between;font-size:13px;color:#677181;margin-bottom:4px;"><span>받는 Square</span><b id="cmSq" style="color:#0b0d12;font-weight:800;">10,000</b></div>
        <div style="display:flex;justify-content:space-between;font-size:13px;color:#677181;margin-bottom:4px;"><span>적립 Point (0.1%)</span><b id="cmBonus" style="color:#1F3AE0;font-weight:800;">+11</b></div>
        <div style="display:flex;justify-content:space-between;font-size:15px;color:#0b0d12;margin-top:8px;padding-top:8px;border-top:1px solid #e5e9ef;"><span style="font-weight:700;">결제 금액</span><b id="cmKrw" style="font-weight:900;">₩11,000</b></div>
      </div>

      <div style="display:flex;gap:8px;">
        <button type="button" id="cmCancel" style="flex:1;padding:13px;border:1px solid #d4dae4;background:#fff;border-radius:10px;font-weight:800;font-size:14px;color:#1f2a38;cursor:pointer;">취소</button>
        <button type="button" id="cmPay" style="flex:2;padding:13px;border:0;background:#0b0d12;border-radius:10px;font-weight:800;font-size:14px;color:#fff;cursor:pointer;">₩<span id="cmPayKrw">11,000</span> 결제하기</button>
      </div>
    </div>
  `;
  document.body.appendChild(wrap);

  const close = () => wrap.remove();
  wrap.addEventListener("click", e => { if (e.target === wrap) close(); });
  wrap.querySelector("#cmClose").addEventListener("click", close);
  wrap.querySelector("#cmCancel").addEventListener("click", close);

  const input = wrap.querySelector("#cmAmount");
  const hint = wrap.querySelector("#cmHint");
  const sq = wrap.querySelector("#cmSq");
  const bonus = wrap.querySelector("#cmBonus");
  const krw = wrap.querySelector("#cmKrw");
  const payKrw = wrap.querySelector("#cmPayKrw");
  const payBtn = wrap.querySelector("#cmPay");

  function recalc() {
    const v = Math.floor(Number(input.value));
    const valid = v >= 5000 && v % 1000 === 0;
    const k = Math.round(v * 1.1);
    sq.textContent = (valid ? v : 0).toLocaleString();
    krw.textContent = "₩" + (valid ? k : 0).toLocaleString();
    payKrw.textContent = (valid ? k : 0).toLocaleString();
    bonus.textContent = "+" + (valid ? Math.floor(k * 0.001) : 0).toLocaleString();
    hint.textContent = valid ? `≈ ₩${k.toLocaleString()} 결제` : "최소 5,000 · 1,000 단위";
    hint.style.color = valid ? "#1F8A5B" : "#c8331f";
    payBtn.disabled = !valid;
    payBtn.style.opacity = valid ? "1" : "0.5";
    payBtn.style.cursor = valid ? "pointer" : "not-allowed";
    amount = valid ? v : 0;
    wrap.querySelectorAll(".cm-preset").forEach(b => {
      const on = Number(b.dataset.v) === v;
      b.style.background = on ? "#0b0d12" : "#fff";
      b.style.color = on ? "#fff" : "#1f2a38";
      b.style.borderColor = on ? "#0b0d12" : "#d4dae4";
    });
  }
  wrap.querySelectorAll(".cm-preset").forEach(b => {
    b.addEventListener("click", () => { input.value = b.dataset.v; recalc(); });
  });
  input.addEventListener("input", recalc);
  recalc();

  payBtn.addEventListener("click", async () => {
    if (!amount) return;
    const amountKrw = Math.round(amount * 1.1);
    const API_BASE = window.AISquareAPI.API_BASE;
    const jwt = window.AISquareAPI.getJwt();
    payBtn.disabled = true; payBtn.textContent = "처리 중...";
    try {
      // 1) prepareCharge — BE에 PENDING walletCharge 레코드 생성
      const prepRes = await fetch(API_BASE + "/wallet/charge", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + jwt },
        body: JSON.stringify({ amountKrw }),
      });
      const prep = await prepRes.json();
      if (!prepRes.ok) throw new Error(prep.message || "충전 준비 실패");

      // 2) Toss 설정
      const cfg = await api.payments.tossConfig();

      // 3) devBypass — 결제창 우회 (개발용)
      if (cfg.devBypass) {
        const confRes = await fetch(API_BASE + `/wallet/charge/${prep.chargeId}/confirm`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + jwt },
          body: JSON.stringify({ paymentKey: "dev-fake-key", amount: prep.amountKrw }),
        });
        const conf = await confRes.json();
        if (!confRes.ok) throw new Error(conf.message || "결제 확정 실패");
        showToast(`${Number(prep.squareAmount).toLocaleString()} Square 충전 완료 (dev)`);
        close();
        if (typeof window.__aisqRepaintWallet === "function") window.__aisqRepaintWallet();
        return;
      }

      // 4) Toss SDK 로드 + 결제창 호출 (성공 시 successUrl로 redirect)
      if (!window.TossPayments) {
        await new Promise((resolve, reject) => {
          const s = document.createElement("script");
          s.src = "https://js.tosspayments.com/v1/payment";
          s.onload = resolve; s.onerror = reject;
          document.head.appendChild(s);
        });
      }
      const tossPayments = TossPayments(cfg.clientKey);
      tossPayments.requestPayment("카드", {
        amount: prep.amountKrw,
        orderId: prep.tossOrderId,
        orderName: `Square ${prep.squareAmount.toLocaleString()} 충전`,
        customerName: me.nickname || me.name || "구매자",
        successUrl: location.origin + "/mypage.html?tab=wallet&charge=success&id=" + encodeURIComponent(prep.chargeId),
        failUrl:    location.origin + "/mypage.html?tab=wallet&charge=fail",
      });
    } catch (e) {
      console.error("Square charge failed:", e);
      showToast(e.message || "충전 실패");
      payBtn.disabled = false;
      payBtn.textContent = "₩" + payKrw.textContent + " 결제하기";
    }
  });
}

async function renderOrders(root, api, showToast, kind) {
  const isPurchase = kind === "purchase";
  const items = isPurchase ? await api.orders.getList() : (window.AISquareAPI && JSON.parse(localStorage.getItem("aisquare-mock-store"))?.sales) || [];

  const STATUS = {
    PENDING:   { label: "구매 확정 대기", cls: "yellow" },
    CONFIRMED: { label: "구매 확정",      cls: "green"  },
    REPORTED:  { label: "신고 접수됨",    cls: "red"    },
    REFUNDED:  { label: "환불 완료",      cls: "gray"   },
  };

  root.innerHTML = `
    <h2>${isPurchase ? "구매 내역" : "판매 내역"}</h2>
    <p class="sub">${isPurchase
      ? "구매 후 72시간이 지나면 자동으로 확정됩니다."
      : "Square로 결제된 판매 건과 정산 상태를 확인할 수 있습니다."}</p>

    ${items.length === 0
      ? `<div class="empty-state"><strong>${isPurchase ? "구매 내역이 없습니다" : "판매 내역이 없습니다"}</strong><span>${isPurchase ? "마켓에서 원하는 노하우를 찾아보세요." : "판매 등록 후 첫 거래를 기다려보세요."}</span></div>`
      : items.map(o => {
          const st = STATUS[o.status] || { label: o.status, cls: "gray" };
          // 72h 카운트다운 (autoConfirmAt 기준)
          let timerHtml = '';
          if (isPurchase && o.status === 'PENDING' && o.autoConfirmAt) {
            const targetTs = new Date(o.autoConfirmAt).getTime();
            timerHtml = `<span class="auto-confirm-timer" data-target="${targetTs}" style="margin-left:8px;font-size:12px;font-weight:800;color:#1F3AE0;background:#eef1ff;padding:3px 10px;border-radius:999px;">자동확정 ⏱ <span class="auto-confirm-remain">--:--:--</span></span>`;
          }
          return `
          <div class="order-card">
            <div>
              <div class="meta">
                <span class="pill-badge ${st.cls}">${st.label}</span>
                <span>주문 #${esc(o.id)}</span>
                <span>·</span>
                <span>${fmtDate(o.createdAt)}</span>
                ${timerHtml}
              </div>
              <h4>${esc(o.productTitle)}</h4>
              <p class="pay">
                <b>${o.paymentMethod === "SQUARE" ? `${n(o.paymentAmount)} Square` : `₩${n(o.paymentAmount)}`}</b>
                <span style="margin:0 8px">·</span>
                ${isPurchase ? `판매자: ${esc(o.sellerName)}` : `구매자: ${esc(o.buyerName)}`}
              </p>
            </div>
            <div class="actions">
              ${isPurchase ? `<button class="btn-ghost" data-act="download" data-id="${esc(o.id)}">${ICON.download} 다운로드</button>` : ""}
              ${isPurchase && o.status === "PENDING" ? `<button class="btn-ink" data-act="confirm" data-id="${esc(o.id)}">${ICON.check} 구매 확정</button>` : ""}
              ${isPurchase && o.status === "CONFIRMED" && !o.hasReview ? `<button class="btn-ink" data-act="review" data-id="${esc(o.id)}">${ICON.pen} 리뷰 작성</button>` : ""}
              ${isPurchase && o.status === "PENDING" ? `<button class="btn-danger" data-act="report" data-id="${esc(o.id)}">${ICON.alert} 신고</button>` : ""}
            </div>
          </div>`;
        }).join("")
    }
  `;

  root.querySelectorAll("[data-act]").forEach(b => {
    b.addEventListener("click", async () => {
      const id = b.dataset.id;
      const act = b.dataset.act;
      if (act === "download") {
        try {
          const r = await api.orders.getDownloadUrl(id);
          const url = r.url || r.downloadUrl || r;
          if (url && url !== '#mock-download') {
            window.open(url, '_blank');
            showToast('다운로드를 시작합니다 (CloudFront Presigned URL).');
          } else { showToast('다운로드 링크 발급 실패'); }
        } catch (e) { showToast(e.message || '다운로드 실패'); }
        return;
      }
      if (act === "confirm")  { await api.orders.confirm(id); showToast("구매가 확정되었습니다. 판매자에게 정산됩니다."); renderOrders(root, api, showToast, kind); return; }
      if (act === "review")   {
        openReviewModal(id, api, showToast, () => renderOrders(root, api, showToast, kind));
        return;
      }
      if (act === "report")   {
        const reason = prompt('신고 사유를 자세히 입력해 주세요 (예: 자료 손상, 설명과 다름, 복제물 의심)', '');
        if (!reason || reason.trim().length < 5) { showToast('신고 사유는 5자 이상 입력해 주세요.'); return; }
        try {
          const res = await fetch(api.API_BASE + `/reports/order/${id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + api.getJwt() },
            body: JSON.stringify({ reason, imageKeys: [] }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || '신고 실패');
          showToast('신고가 접수되었습니다. 관리자가 검토 후 처리합니다.');
          renderOrders(root, api, showToast, kind);
        } catch (e) { showToast(e.message || '신고 실패'); }
        return;
      }
    });
  });

  // 72h 카운트다운 매초 갱신
  const timers = root.querySelectorAll('.auto-confirm-timer');
  if (timers.length) {
    const tick = () => {
      timers.forEach(t => {
        const target = parseInt(t.dataset.target, 10);
        const remain = target - Date.now();
        const el = t.querySelector('.auto-confirm-remain');
        if (!el) return;
        if (remain <= 0) { el.textContent = '00:00:00 (확정 처리 중)'; return; }
        const h = Math.floor(remain / 3600000);
        const m = Math.floor((remain % 3600000) / 60000);
        const s = Math.floor((remain % 60000) / 1000);
        el.textContent = String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
      });
    };
    tick();
    const iv = setInterval(tick, 1000);
    // 패널 떠날 때 정리
    const observer = new MutationObserver(() => {
      if (!document.contains(root) || !root.querySelector('.auto-confirm-timer')) {
        clearInterval(iv); observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
}

// ===== Review modal (별점 + 텍스트, 실제 BE 호출) =====
function openReviewModal(orderId, api, showToast, onDone) {
  document.querySelectorAll('.review-modal-bg').forEach(n => n.remove());
  const wrap = document.createElement('div');
  wrap.className = 'review-modal-bg';
  wrap.innerHTML = `
    <div class="review-modal">
      <div class="rv-head">
        <h3>리뷰 작성</h3>
        <button type="button" class="rv-close" aria-label="닫기">×</button>
      </div>
      <div class="rv-body">
        <p class="rv-sub">구매하신 상품에 대한 솔직한 후기를 남겨주세요. 리뷰 작성 시 <b>+100 Point</b>가 적립됩니다.</p>
        <div class="rv-row">
          <span class="rv-label">별점</span>
          <div class="rv-stars" id="rvStars" data-value="0">
            ${[1,2,3,4,5].map(i => `<span class="rv-star" data-v="${i}">★</span>`).join('')}
            <span class="rv-rating-text" id="rvRatingText">선택하기</span>
          </div>
        </div>
        <div class="rv-row">
          <span class="rv-label">내용</span>
          <textarea id="rvText" placeholder="구매한 자료가 어땠는지 알려주세요. (최소 10자)" maxlength="500"></textarea>
          <span class="rv-counter"><span id="rvCount">0</span> / 500</span>
        </div>
        <div class="rv-actions">
          <button type="button" class="rv-cancel">취소</button>
          <button type="button" class="rv-submit" disabled>리뷰 등록</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(wrap);

  const close = () => wrap.remove();
  wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
  wrap.querySelector('.rv-close').addEventListener('click', close);
  wrap.querySelector('.rv-cancel').addEventListener('click', close);

  // Star rating
  const starsRoot = wrap.querySelector('#rvStars');
  const stars = starsRoot.querySelectorAll('.rv-star');
  const ratingText = wrap.querySelector('#rvRatingText');
  const labels = ['', '별로예요', '아쉬워요', '괜찮아요', '좋아요', '최고예요'];
  function setRating(v) {
    starsRoot.dataset.value = String(v);
    stars.forEach((s, i) => s.classList.toggle('on', i < v));
    ratingText.textContent = v > 0 ? labels[v] + ` (${v}점)` : '선택하기';
    updateSubmit();
  }
  stars.forEach((s, i) => {
    s.addEventListener('mouseenter', () => stars.forEach((x, j) => x.classList.toggle('hover', j <= i)));
    s.addEventListener('click', () => setRating(i + 1));
  });
  starsRoot.addEventListener('mouseleave', () => stars.forEach(x => x.classList.remove('hover')));

  // Text + counter
  const ta = wrap.querySelector('#rvText');
  const counter = wrap.querySelector('#rvCount');
  ta.addEventListener('input', () => { counter.textContent = ta.value.length; updateSubmit(); });

  // Submit
  const submitBtn = wrap.querySelector('.rv-submit');
  function updateSubmit() {
    const r = parseInt(starsRoot.dataset.value, 10);
    submitBtn.disabled = !(r >= 1 && r <= 5 && ta.value.trim().length >= 10);
  }
  submitBtn.addEventListener('click', async () => {
    submitBtn.disabled = true; submitBtn.textContent = '등록 중...';
    try {
      const rating = parseInt(starsRoot.dataset.value, 10);
      const content = ta.value.trim();
      await api.reviews.create(orderId, { rating, content });
      showToast('리뷰가 등록되었습니다. +100 Point 적립!');
      close();
      onDone && onDone();
    } catch (e) {
      console.error('review submit', e);
      showToast(e.message || '리뷰 등록에 실패했습니다.');
      submitBtn.disabled = false; submitBtn.textContent = '리뷰 등록';
    }
  });
}

async function renderWishlist(root, api, showToast) {
  const items = await api.wishlist.getList();
  root.innerHTML = `
    <h2>찜 목록</h2>
    <p class="sub">관심 있는 노하우를 모아두고 비교해보세요.</p>
    ${items.length === 0
      ? `<div class="empty-state"><strong>찜한 노하우가 없습니다</strong></div>`
      : items.map(p => `
        <div class="order-card">
          <div>
            <h4>${esc(p.title)}</h4>
            <p class="pay"><b>${n(p.priceSquare)} Square</b><span style="margin:0 8px">·</span>판매자: ${esc(p.sellerName)}</p>
          </div>
          <div class="actions">
            <button class="btn-ghost" data-act="cart" data-id="${esc(p.id)}">장바구니</button>
            <button class="btn-danger" data-act="remove" data-id="${esc(p.id)}">찜 해제</button>
          </div>
        </div>`).join("")}
  `;
  root.querySelectorAll("[data-act]").forEach(b => b.addEventListener("click", async () => {
    if (b.dataset.act === "remove") { await api.wishlist.remove(b.dataset.id); showToast("찜에서 제거했습니다."); renderWishlist(root, api, showToast); }
    else { showToast("장바구니에 담았습니다."); }
  }));
}

async function renderCart(root, api, showToast) {
  const items = await api.cart.getList();
  const total = items.reduce((s, p) => s + (p.priceSquare || 0), 0);
  root.innerHTML = `
    <h2>장바구니</h2>
    <p class="sub">결제 전 노하우를 모아두는 공간입니다.</p>
    ${items.length === 0
      ? `<div class="empty-state"><strong>장바구니가 비어있습니다</strong></div>`
      : items.map(p => `
        <div class="order-card">
          <div>
            <h4>${esc(p.title)}</h4>
            <p class="pay"><b>${n(p.priceSquare)} Square</b><span style="margin:0 8px">·</span>판매자: ${esc(p.sellerName)}</p>
          </div>
          <div class="actions">
            <button class="btn-danger" data-act="remove" data-id="${esc(p.id)}">삭제</button>
          </div>
        </div>`).join("") + `
        <div style="margin-top:18px;padding:18px 20px;background:#f8f9fb;border-radius:6px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
          <div><span style="color:#677181;font-weight:800">합계</span> <b style="font-size:18px;margin-left:8px">${n(total)} Square</b></div>
          <button class="btn-ink" id="checkoutBtn">Square로 결제</button>
        </div>
      `}
  `;
  root.querySelectorAll("[data-act=remove]").forEach(b => b.addEventListener("click", async () => {
    await api.cart.remove(b.dataset.id); showToast("삭제했습니다."); renderCart(root, api, showToast);
  }));
  document.getElementById("checkoutBtn")?.addEventListener("click", async () => {
    const btn = document.getElementById("checkoutBtn");

    // PASS 본인인증 확인
    let me;
    try { me = await api.user.getMe(); } catch { me = api.getCurrentUser(); }
    if (!me?.phoneVerified && !me?.passVerified) {
      showToast("PASS 본인인증이 필요합니다.");
      setTimeout(() => { location.href = "./mypage.html#account"; }, 900);
      return;
    }

    // Square 잔액 확인
    let squareBal = 0;
    try { squareBal = (await api.square.getBalance())?.balance || 0; } catch {}

    if (squareBal < total) {
      const shortBy = total - squareBal;
      const go = confirm("Square 잔액이 " + n(shortBy) + " Square 부족합니다.\n충전 페이지로 이동하시겠어요?");
      if (go) {
        location.href = "./mypage.html?tab=wallet&need=" + encodeURIComponent(shortBy);
      }
      return;
    }

    if (!confirm(items.length + "개 상품을 합계 " + n(total) + " Square로 구매하시겠어요?")) return;

    btn.disabled = true;
    const origLabel = btn.textContent;
    btn.textContent = "결제 처리 중...";

    const failed = [];
    let bought = 0;
    for (const p of items) {
      try {
        const order = await api.orders.create(p.id, "SQUARE", 0);
        const txHash = "sq-client-" + Date.now() + "-" + Math.random().toString(36).slice(2, 10);
        const res = await fetch(api.API_BASE + "/orders/" + order.id + "/pay/square", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + api.getJwt() },
          body: JSON.stringify({ txHash }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || ("결제 실패: " + p.title));
        }
        bought++;
        try { await api.cart.remove(p.id); } catch {}
      } catch (e) {
        failed.push({ title: p.title, msg: e.message });
      }
    }

    if (failed.length === 0) {
      showToast(bought + "개 상품 결제 완료!");
      setTimeout(() => { location.href = "./mypage.html?tab=purchases"; }, 1000);
    } else if (bought > 0) {
      showToast(bought + "개 성공 · " + failed.length + "개 실패");
      setTimeout(() => { renderCart(root, api, showToast); }, 1500);
    } else {
      btn.disabled = false;
      btn.textContent = origLabel;
      showToast(failed[0]?.msg || "결제에 실패했습니다.");
    }
  });
}
