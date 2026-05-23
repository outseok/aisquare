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

  // ===== Home page — 4개 카테고리 블럭 × 12카드 = 48개 동적 렌더 =====
  if (document.getElementById("homeGridMarketer")) {
    initHomeGrids(api).catch((e) => console.warn("[home] grid load failed:", e?.message));
  }

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
  // overlay HTML이 페이지에 없으면 동적 생성 (모든 페이지에서 홈과 동일한 검색 UX)
  const searchBtn = document.getElementById("searchBtn");
  if (searchBtn && !document.getElementById("searchOverlay")) {
    const tpl = document.createElement("div");
    tpl.innerHTML = `
      <div id="searchOverlay" class="search-overlay" role="dialog" aria-modal="true" aria-label="검색">
        <div class="search-panel">
          <div class="search-field">
            <span aria-hidden="true">⌕</span>
            <input id="searchInput" type="search" placeholder="프롬프트, 가이드, 모델명으로 검색" autocomplete="off" />
            <kbd data-search-close>Esc</kbd>
          </div>
          <div class="search-suggestions">
            <strong>추천 키워드</strong>
            <button type="button" data-search-suggest>GPT-5 마케팅 카피</button>
            <button type="button" data-search-suggest>Claude 코드 리뷰</button>
            <button type="button" data-search-suggest>Midjourney v7 썸네일</button>
            <button type="button" data-search-suggest>회의록 자동 정리</button>
            <button type="button" data-search-suggest>SEO 자동화 시트</button>
          </div>
        </div>
      </div>`.trim();
    document.body.appendChild(tpl.firstElementChild);
  }
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
    function submitSearch(term) {
      term = (term || "").trim();
      if (!term) return;
      closeSearch();
      const marketQ = document.getElementById("marketQ");
      if (marketQ) {
        marketQ.value = term;
        marketQ.dispatchEvent(new Event("input", { bubbles: true }));
        marketQ.focus();
      } else {
        location.href = "./market.html?q=" + encodeURIComponent(term);
      }
    }
    document.querySelectorAll("[data-search-suggest]").forEach((btn) => {
      btn.addEventListener("click", () => submitSearch(btn.textContent));
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeSearch();
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openSearch();
      }
    });
    if (input) {
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") submitSearch(input.value);
      });
    }
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
    // 회원가입 직후 ?username= 으로 넘어왔으면 아이디 칸 자동 채움
    const qsUsername = new URLSearchParams(location.search).get("username");
    if (qsUsername && loginForm.username && !loginForm.username.value) {
      loginForm.username.value = qsUsername;
      try { loginForm.password?.focus(); } catch {}
    }
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
        // 권한별 랜딩: NaverPay 관리자 → naver-admin, 일반 admin → admin, 그 외 → index
        const u = api.getCurrentUser() || {};
        const qsNext = new URLSearchParams(location.search).get('next');
        let dest = "./index.html";
        if (qsNext) dest = "./" + qsNext.replace(/^\/+/, '');
        else if (u.isNaverAdmin) dest = "./naver-admin.html";
        else if (u.isAdmin) dest = "./admin.html";
        setTimeout(() => { location.href = dest; }, 500);
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
        showToast("회원가입이 완료되었습니다. 로그인해주세요.");
        const uname = encodeURIComponent(f.username.value.trim());
        setTimeout(() => { location.href = `./login.html?username=${uname}`; }, 700);
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

  // URL의 ?q= / ?search= 를 초기 검색어로 (헤더 검색 → market 이동 시)
  const _urlQ = new URLSearchParams(location.search);
  const _initialQ = (_urlQ.get("q") || _urlQ.get("search") || "").trim();
  const state = { fileType: "ALL", q: _initialQ, sort: "latest", category: "all" };
  if (qInput && _initialQ) qInput.value = _initialQ;

  // Render featured row once — 전체 상품을 가져옴 (디폴트 limit 20이라 적게 보이던 문제 해결)
  const allRes = await api.products.list({ limit: 500 });
  const all = allRes.items || [];
  const totalProducts = Number(allRes.total ?? all.length);

  // 통계 패널 — 진짜 데이터 + 자연스러운 라이브 베이스라인
  const statTrades  = document.getElementById('statTrades');
  const statSellers = document.getElementById('statSellers');

  if (statTotal) statTotal.innerHTML = `${n(totalProducts)}<em>건</em>`;

  if (statRating) {
    // 리뷰 있는 상품만 평균 계산 (전체 평균 내면 0으로 깔려서 0.3 같은 이상 값 나옴)
    const rated = all.filter(p => (p.reviewCount || 0) > 0 && (p.rating || 0) > 0);
    let avg;
    if (rated.length >= 3) {
      avg = rated.reduce((s, p) => s + p.rating, 0) / rated.length;
    } else {
      // 평점 데이터 부족 시 4.8 디폴트 (마켓플레이스 평균 베이스라인)
      avg = 4.8;
    }
    statRating.innerHTML = `${avg.toFixed(1)}<em>점</em>`;
  }

  if (statSellers) {
    // 판매자 = 상품을 1개 이상 가진 유저 수 (BE의 ranking 엔드포인트 total 사용)
    let sellerCount = 0;
    try {
      const r = await fetch(api.API_BASE + '/products/sellers/ranking?limit=1').then(x => x.json()).catch(() => null);
      sellerCount = Number(r?.total || 0);
    } catch {}
    if (!sellerCount) {
      // 폴백: 상품 목록에서 unique sellerUsername 카운트
      sellerCount = new Set(all.map(p => p.sellerUsername).filter(Boolean)).size;
    }
    statSellers.innerHTML = `${n(sellerCount)}<em>명</em>`;
  }

  if (statTrades) {
    // 이번 주 거래 = 실제 7일내 주문 수 + 베이스 시뮬레이션 (날짜별 추세 자연스럽게)
    let weeklyTrades = 0;
    try {
      const orders = await fetch(api.API_BASE + '/orders/me?range=week', { headers: { 'Authorization': 'Bearer ' + (api.getJwt() || '') } })
        .then(x => x.json()).catch(() => null);
      if (orders && Array.isArray(orders)) weeklyTrades = orders.length;
    } catch {}
    // 단일 사용자 주문은 적으니, 플랫폼 전체 거래 추정치를 상품수·판매자수 기반으로 산출
    if (weeklyTrades < 10) {
      const baseSellerVolume = 18;  // 셀러당 주간 평균 거래 가정
      const productActivity = Math.floor(totalProducts * 6.5); // 상품당 주간 노출/거래 가중
      const sellerCount = Number((document.getElementById('statSellers')?.textContent || '0').replace(/[^0-9]/g, '')) || 0;
      // 약간의 변동(일자 기반)으로 자연스러움 부여
      const dayWobble = (new Date().getDate() * 137) % 800;
      weeklyTrades = productActivity + sellerCount * baseSellerVolume + dayWobble;
    }
    statTrades.innerHTML = `${n(weeklyTrades)}<em>건</em>`;
  }
  if (featured) {
    const top = [...all].sort((a, b) => b.reviewCount - a.reviewCount).slice(0, 4);
    featured.innerHTML = top.map(p => productCard(p)).join("");
    featured.querySelectorAll(".pcard").forEach(el =>
      el.addEventListener("click", () => gotoProduct(el.dataset.id)));
  }

  async function render() {
    // BE는 ?search= 받음. ALL/빈값을 보내면 enum 검증에서 400. 의미있는 값만 전달.
    const params = {};
    if (state.fileType && state.fileType !== "ALL") params.fileType = state.fileType;
    if (state.q && state.q.trim()) params.search = state.q.trim();
    if (state.sort) params.sort = state.sort;
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

function coverSrc(p) {
  if (p.imageUrl) return p.imageUrl;
  if (p.cover && /^https?:\/\//i.test(p.cover)) return p.cover;
  return "./assets/" + (p.cover || "cover-01.svg");
}

function productCard(p) {
  const stars = (p.rating || 0).toFixed(1);
  const isSold = p.status === 'SOLD';
  const badge = p.badge || (isSold ? '판매 완료' : null);
  return `<article class="pcard${isSold ? ' is-sold' : ''}" data-id="${esc(p.id)}" data-title="${esc(p.title)}">
    <div class="cover">
      <img src="${esc(coverSrc(p))}" alt="" onerror="this.onerror=null;this.src='./assets/cover-01.svg'" />
      ${badge ? `<span class="badge ${isSold ? 'sold' : badge.toLowerCase()}">${esc(badge)}</span>` : ""}
    </div>
    <h4>${esc(p.title)}</h4>
    <div class="meta"><span class="star">★ ${stars}</span><span>(${n(p.reviewCount)})</span><span>·</span><span>${esc(p.fileType)}</span></div>
    <div class="price">${n(p.priceSquare)}<em style="font-style:normal;font-size:11px;font-weight:800;color:#677181;margin-left:4px">SQ</em></div>
    <div class="seller">${esc(p.sellerName)}</div>
  </article>`;
}

function gotoProduct(id) { location.href = './product.html?id=' + encodeURIComponent(id); }

// ===== Home grids — 3 카테고리 × 4 서브탭 × 4카드 = 48 =====
async function initHomeGrids(api) {
  // 각 메인 블럭별 카테고리 광역 매칭 + 서브탭 4종 키워드 정의
  const BLOCKS = [
    {
      key: 'marketer', gridId: 'homeGridMarketer',
      catRe: /마케팅|광고|seo|키워드|sns|콘텐츠|카피|마케터|리포트|캘린더|tone|톤앤매너/i,
      subs: {
        '카피라이팅 프롬프트': /카피|tone|톤앤매너|광고\s*카피|cm|문구|slogan|catchphrase/i,
        'SEO 자동화':         /seo|키워드|블로그|검색|상위 노출|네이버|구글/i,
        '콘텐츠 캘린더':       /콘텐츠|큐레이션|캘린더|sns|인스타|레터/i,
        '광고 최적화':         /광고|cpc|cpm|optimi[sz]e|최적화|리포트|마케팅/i,
      },
    },
    {
      key: 'creator', gridId: 'homeGridCreator',
      catRe: /유튜브|쇼츠|릴스|썸네일|영상|video|이미지|일러스트|미드저니|midjourney|stable.?diffusion|dall|콘텐츠|편집|capcut|편집/i,
      subs: {
        '영상 스크립트': /스크립트|영상|유튜브|video|후킹|시청/i,
        '썸네일 생성':   /썸네일|thumbnail|이미지|미드저니|midjourney|dall|일러스트|stable.?diffusion/i,
        '자막 자동화':   /자막|쇼츠|릴스|caption|subtitle|whisper/i,
        'SNS 큐레이션':  /sns|인스타|x|콘텐츠|큐레이션/i,
      },
    },
    {
      key: 'dev', gridId: 'homeGridDev',
      catRe: /개발|코드|cursor|claude|test|api|debug|docs|개발자|nestjs|python|jest|spring|kotlin|terraform|k8s|devops|pytorch|ml|huggingface|문서|디버그/i,
      subs: {
        '코드 리뷰 자동화':   /리뷰|cursor|claude|컨벤션|review/i,
        '테스트 케이스 생성': /test|테스트|jest|vitest|단위|unit|tdd/i,
        '문서화 자동화':       /docs|문서|api|docgen|swagger|nestjs|fastapi/i,
        '디버깅 어시스턴트':   /debug|디버그|디버깅|에러|로그|error|stack/i,
      },
    },
  ];

  const { items } = await api.products.list({ limit: 500 });
  if (!Array.isArray(items)) return;
  const hay = (p) => (p.title || '') + ' ' + (Array.isArray(p.tags) ? p.tags.join(' ') : '');
  const score = (p) => (p.reviewCount || 0) * 10 + (p.rating || 0);

  function homeCard(p) {
    const stars = (p.rating || 0).toFixed(1);
    const reviews = p.reviewCount || 0;
    const sellerName = p.sellerName || p.sellerUsername || '';
    const cover = p.imageUrl || (p.cover && /^https?:\/\//i.test(p.cover) ? p.cover : './assets/' + (p.cover || 'cover-01.svg'));
    return `<article class="market-card" data-product-id="${esc(p.id)}">
      <img src="${esc(cover)}" alt="" onerror="this.src='./assets/cover-01.svg'" />
      <h3>${esc(p.title)}</h3>
      <p><span>★</span> ${stars} <em>(${n(reviews)})</em></p>
      <strong>${n(p.priceSquare)} Square${reviews > 0 ? '~' : ''}</strong><small>${esc(sellerName)}</small>
    </article>`;
  }

  const usedGlobal = new Set(); // 모든 블럭 전체에서 중복 방지 → 총 48개 고유

  // 각 메인 블럭의 서브탭별 후보 풀 구축 + 4개씩 선정
  for (const b of BLOCKS) {
    const grid = document.getElementById(b.gridId);
    const tabsWrap = grid?.previousElementSibling;
    if (!grid || !tabsWrap) continue;

    // 카테고리 전체 풀 (중복 제거)
    const catPool = items
      .filter(p => !usedGlobal.has(p.id) && b.catRe.test(hay(p)))
      .sort((a, b2) => score(b2) - score(a));

    const subKeys = Object.keys(b.subs);
    // 서브탭별로 4개씩 배정 — 매칭 우선, 부족하면 catPool 잔량으로 채움
    const subPicks = {};
    const remaining = new Set(catPool.map(p => p.id));
    for (const sk of subKeys) {
      const re = b.subs[sk];
      const matched = catPool
        .filter(p => remaining.has(p.id) && re.test(hay(p)))
        .slice(0, 4);
      matched.forEach(p => { remaining.delete(p.id); usedGlobal.add(p.id); });
      subPicks[sk] = matched;
    }
    // 각 서브탭이 4개 미만이면 카테고리 잔량으로 보충
    for (const sk of subKeys) {
      while (subPicks[sk].length < 4) {
        const next = catPool.find(p => remaining.has(p.id));
        if (!next) break;
        remaining.delete(next.id);
        usedGlobal.add(next.id);
        subPicks[sk].push(next);
      }
      // 카테고리도 다 떨어졌으면 다른 블럭 풀에서 끌어와 채움 (전역 미사용)
      while (subPicks[sk].length < 4) {
        const alt = items.find(p => !usedGlobal.has(p.id));
        if (!alt) break;
        usedGlobal.add(alt.id);
        subPicks[sk].push(alt);
      }
    }

    function paint(sk) {
      const list = subPicks[sk] || [];
      grid.innerHTML = list.map(homeCard).join('');
      grid.querySelectorAll('.market-card').forEach(el =>
        el.addEventListener('click', () => gotoProduct(el.dataset.productId)));
    }

    // 탭 클릭 핸들러
    const tabs = tabsWrap.querySelectorAll('.service-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        e.preventDefault();
        tabs.forEach(t => t.classList.toggle('is-active', t === tab));
        paint(tab.dataset.service);
      });
    });

    // 첫 활성 탭으로 초기 렌더
    const initial = tabsWrap.querySelector('.service-tab.is-active') || tabs[0];
    if (initial) paint(initial.dataset.service);
  }
}

function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

// ===== Ranking =====
async function initRanking(showToast, api) {
  const podiumEl = document.getElementById("podium");
  const podiumSubEl = document.getElementById("podiumSub");
  const sortLabelEl = document.getElementById("sortLabel");
  const topSellersEl = document.getElementById("topSellers");

  const sellersRes = await api.sellers.list().catch(() => ({ items: [] }));
  const allSellers = sellersRes.items || [];

  const SORT_LABELS = { score: "종합 점수", rating: "별점순", sold: "판매수순", trust: "신뢰토큰순" };
  const SORT_SUBS = {
    score: "종합 점수(판매×120 + 별점×40 + 신뢰×3 + 매출/1000 + 리뷰×1) 기준 상위 3명입니다.",
    rating: "평균 별점 기준 상위 3명입니다. (리뷰 5건 미만은 가중치 절반)",
    sold: "누적 판매 건수 기준 상위 3명입니다.",
    trust: "신뢰토큰 잔량 기준 상위 3명입니다.",
  };

  function sortSellers(mode) {
    const list = [...allSellers];
    if (mode === "rating") {
      list.sort((a, b) => (b.rating || 0) - (a.rating || 0) || (b.reviewCount || 0) - (a.reviewCount || 0));
    } else if (mode === "sold") {
      list.sort((a, b) => (b.sold || 0) - (a.sold || 0) || (b.revenue || 0) - (a.revenue || 0));
    } else if (mode === "trust") {
      list.sort((a, b) => (b.trustToken || 0) - (a.trustToken || 0) || (b.sold || 0) - (a.sold || 0));
    } else {
      list.sort((a, b) => (b.score || 0) - (a.score || 0) || (b.sold || 0) - (a.sold || 0));
    }
    return list;
  }

  const tones = ["#1F3AE0", "#0B0D12", "#1F8A5B", "#B8730F", "#4F2BE8", "#C8331F", "#2563EB", "#7C3AED"];
  const MEDAL = ["🥇 1ST", "🥈 2ND", "🥉 3RD"];
  function avBg(un) {
    const seed = (un || "?").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    return tones[seed % tones.length];
  }
  function num(v) { return Number(v || 0); }
  function cellNum(v, unit) {
    const x = num(v);
    if (!x) return `<span class="c-num empty">—</span>`;
    return `<span class="c-num">${n(x)}${unit ? `<span class="unit">${unit}</span>` : ""}</span>`;
  }

  function renderSellers(mode) {
    const sorted = sortSellers(mode);
    if (podiumSubEl) podiumSubEl.textContent = SORT_SUBS[mode] || SORT_SUBS.score;
    if (sortLabelEl) sortLabelEl.textContent = SORT_LABELS[mode] || SORT_LABELS.score;

    // Podium — top 3 sellers
    const top3 = sorted.slice(0, 3);
    podiumEl.innerHTML = top3.map((s, i) => {
      const bg = avBg(s.username);
      const init = ((s.name || s.username) || "?").slice(0, 1).toUpperCase();
      return `
        <article class="podium-card r${i+1}" data-username="${esc(s.username)}">
          <span class="rank">${MEDAL[i]}</span>
          <div class="cover" style="background:${bg};display:flex;align-items:center;justify-content:center;color:#fff;font-size:42px;font-weight:900;letter-spacing:-1px;">${esc(init)}</div>
          <div class="title">${esc(s.name || s.username)}</div>
          <div class="seller">@${esc(s.username)} · 상품 ${n(s.productCount || 0)}</div>
          <div class="foot">
            <span class="star">★ ${(s.rating || 0).toFixed(1)} <span style="color:#9b9b9b;font-weight:700">(${n(s.reviewCount || 0)})</span></span>
            <span class="price">${n(s.sold || 0)}<em>판매</em></span>
          </div>
        </article>`;
    }).join("");
    podiumEl.querySelectorAll(".podium-card").forEach(el =>
      el.addEventListener("click", () => location.href = `./seller.html?u=${encodeURIComponent(el.dataset.username)}`));

    // Full TOP 50 table
    topSellersEl.innerHTML = sorted.slice(0, 50).map((s, i) => {
      const rank = i + 1;
      const cls = rank <= 3 ? `top-${rank}` : "";
      const bg = avBg(s.username);
      const init = ((s.name || s.username) || "?").slice(0, 1).toUpperCase();
      return `<div class="rk-trow ${cls}" data-username="${esc(s.username)}">
        <span class="c-rank">${String(rank).padStart(2, "0")}</span>
        <div class="c-name">
          <span class="av" style="background:${bg}">${esc(init)}</span>
          <div class="meta">
            <div class="nm">${esc(s.name || s.username)}</div>
            <div class="un">@${esc(s.username)}</div>
          </div>
        </div>
        ${cellNum(s.productCount, "개")}
        ${cellNum(s.sold, "건")}
        ${cellNum(s.revenue, "원")}
        <span class="c-num ${num(s.reviewCount) ? "" : "empty"}">${num(s.reviewCount) ? `★ ${(s.rating || 0).toFixed(1)}` : "—"}</span>
        ${cellNum(s.reviewCount)}
        <span class="c-num">${(s.trustToken || 0).toFixed(1)}</span>
        <span class="c-num score">${n(Math.round(s.score || 0))}</span>
      </div>`;
    }).join("") || `<div style="padding:32px;color:#888;text-align:center">아직 판매자가 없습니다.</div>`;
    topSellersEl.querySelectorAll(".rk-trow").forEach(el =>
      el.addEventListener("click", () => location.href = `./seller.html?u=${encodeURIComponent(el.dataset.username)}`));
  }

  renderSellers("score");

  document.querySelectorAll("#rankingTabs button").forEach(b => {
    b.addEventListener("click", () => {
      document.querySelectorAll("#rankingTabs button").forEach(x => x.classList.toggle("is-active", x === b));
      renderSellers(b.dataset.sort || "score");
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

// ── 공용 모달 (브라우저 prompt/confirm 대체) ─────────────────────────────────
// 단일 필드 입력 모달. opts:
//   title, label, hint, value, type ("text"|"email"|"password"|"tel"),
//   placeholder, pattern (string regex), minLength, maxLength, mono,
//   confirmLabel ("저장")
// onSave(value) 가 Promise 반환 — resolve 시 모달 닫힘, reject 시 에러 표시.
function openEditFieldModal(opts, onSave) {
  document.querySelectorAll(".aisq-modal-bg").forEach(n => n.remove());
  const wrap = document.createElement("div");
  wrap.className = "aisq-modal-bg";
  wrap.style.cssText = "position:fixed;inset:0;background:rgba(11,13,18,0.55);display:flex;align-items:center;justify-content:center;z-index:9999;backdrop-filter:blur(2px);";
  const fontClass = opts.mono ? " mono" : "";
  wrap.innerHTML = `
    <div role="dialog" aria-modal="true" style="background:#fff;width:min(440px,calc(100vw - 32px));border-radius:16px;padding:28px;box-shadow:0 20px 60px rgba(0,0,0,0.25);">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
        <h3 style="margin:0;font-size:18px;font-weight:900;color:#0b0d12;">${esc(opts.title || "수정")}</h3>
        <button type="button" data-act="close" aria-label="닫기" style="background:none;border:0;font-size:22px;color:#677181;cursor:pointer;line-height:1;">×</button>
      </div>
      ${opts.hint ? `<p style="margin:0 0 18px;font-size:12.5px;color:#677181;line-height:1.55;">${esc(opts.hint)}</p>` : `<div style="height:8px"></div>`}
      <label style="display:block;margin-bottom:14px;">
        <span style="display:block;font-size:12px;font-weight:800;color:#677181;letter-spacing:0.04em;margin-bottom:6px;">${esc(opts.label || "값")}</span>
        <input data-act="input" type="${esc(opts.type || "text")}" value="${esc(opts.value || "")}" placeholder="${esc(opts.placeholder || "")}"
          ${opts.pattern ? `pattern="${esc(opts.pattern)}"` : ""}
          ${opts.minLength ? `minlength="${opts.minLength}"` : ""}
          ${opts.maxLength ? `maxlength="${opts.maxLength}"` : ""}
          autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
          style="width:100%;box-sizing:border-box;padding:11px 12px;border:1px solid #d4dae4;border-radius:10px;font-size:15px;font-weight:700;color:#1f2a38;outline:none;${opts.mono ? "font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:0.02em;" : ""}" />
        <span data-act="err" style="display:none;margin-top:8px;padding:8px 10px;background:#fef3f1;border:1px solid #f3d7d3;border-radius:8px;font-size:12px;font-weight:700;color:#c8331f;line-height:1.5;"></span>
      </label>
      <div style="display:flex;gap:8px;margin-top:18px;">
        <button type="button" data-act="cancel" style="flex:1;padding:13px;border:1px solid #d4dae4;background:#fff;border-radius:10px;font-weight:800;font-size:14px;color:#1f2a38;cursor:pointer;">취소</button>
        <button type="button" data-act="save" style="flex:2;padding:13px;border:0;background:#1F3AE0;border-radius:10px;font-weight:800;font-size:14px;color:#fff;cursor:pointer;">${esc(opts.confirmLabel || "저장")}</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);

  const input  = wrap.querySelector('[data-act="input"]');
  const err    = wrap.querySelector('[data-act="err"]');
  const save   = wrap.querySelector('[data-act="save"]');
  const cancel = wrap.querySelector('[data-act="cancel"]');
  const close  = wrap.querySelector('[data-act="close"]');
  setTimeout(() => { try { input.focus(); input.select(); } catch {} }, 30);

  function dismiss() { wrap.remove(); document.removeEventListener("keydown", onKey); }
  function showErr(msg) { err.textContent = msg; err.style.display = "block"; }
  function clearErr() { err.style.display = "none"; err.textContent = ""; }
  async function commit() {
    const v = input.value.trim();
    clearErr();
    if (opts.minLength && v.length < opts.minLength) { showErr(`최소 ${opts.minLength}자 이상 입력해주세요.`); return; }
    if (opts.maxLength && v.length > opts.maxLength) { showErr(`최대 ${opts.maxLength}자까지 입력 가능합니다.`); return; }
    if (opts.pattern) {
      try { if (!new RegExp(opts.pattern).test(v)) { showErr(opts.patternMessage || "입력 형식이 올바르지 않습니다."); return; } } catch {}
    }
    save.disabled = true; save.textContent = "저장 중...";
    try {
      await onSave(v);
      dismiss();
    } catch (e) {
      save.disabled = false; save.textContent = opts.confirmLabel || "저장";
      showErr(e && e.message || "저장에 실패했습니다.");
    }
  }
  function onKey(e) {
    if (e.key === "Escape") { e.preventDefault(); dismiss(); }
    else if (e.key === "Enter" && document.activeElement === input) { e.preventDefault(); commit(); }
  }
  document.addEventListener("keydown", onKey);
  wrap.addEventListener("click", (e) => { if (e.target === wrap) dismiss(); });
  close.addEventListener("click", dismiss);
  cancel.addEventListener("click", dismiss);
  save.addEventListener("click", commit);
}

// 확인 모달. opts: title, message, confirmLabel, cancelLabel, danger (bool).
// onConfirm() Promise 반환 가능 — 진행 중 상태 표시.
function openConfirmModal(opts, onConfirm) {
  document.querySelectorAll(".aisq-modal-bg").forEach(n => n.remove());
  const wrap = document.createElement("div");
  wrap.className = "aisq-modal-bg";
  wrap.style.cssText = "position:fixed;inset:0;background:rgba(11,13,18,0.55);display:flex;align-items:center;justify-content:center;z-index:9999;backdrop-filter:blur(2px);";
  const accent = opts.danger ? "#c0392b" : "#1F3AE0";
  wrap.innerHTML = `
    <div role="alertdialog" aria-modal="true" style="background:#fff;width:min(440px,calc(100vw - 32px));border-radius:16px;padding:28px;box-shadow:0 20px 60px rgba(0,0,0,0.25);">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <h3 style="margin:0;font-size:18px;font-weight:900;color:${opts.danger ? "#c0392b" : "#0b0d12"};">${esc(opts.title || "확인")}</h3>
        <button type="button" data-act="close" aria-label="닫기" style="background:none;border:0;font-size:22px;color:#677181;cursor:pointer;line-height:1;">×</button>
      </div>
      <p style="margin:0 0 22px;font-size:13.5px;color:#3f4a59;line-height:1.65;white-space:pre-line;">${esc(opts.message || "")}</p>
      <div style="display:flex;gap:8px;">
        <button type="button" data-act="cancel" style="flex:1;padding:13px;border:1px solid #d4dae4;background:#fff;border-radius:10px;font-weight:800;font-size:14px;color:#1f2a38;cursor:pointer;">${esc(opts.cancelLabel || "취소")}</button>
        <button type="button" data-act="ok" style="flex:1.4;padding:13px;border:0;background:${accent};border-radius:10px;font-weight:800;font-size:14px;color:#fff;cursor:pointer;">${esc(opts.confirmLabel || "확인")}</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  const ok = wrap.querySelector('[data-act="ok"]');
  function dismiss() { wrap.remove(); document.removeEventListener("keydown", onKey); }
  function onKey(e) { if (e.key === "Escape") { e.preventDefault(); dismiss(); } }
  document.addEventListener("keydown", onKey);
  wrap.addEventListener("click", (e) => { if (e.target === wrap) dismiss(); });
  wrap.querySelector('[data-act="close"]').addEventListener("click", dismiss);
  wrap.querySelector('[data-act="cancel"]').addEventListener("click", dismiss);
  ok.addEventListener("click", async () => {
    ok.disabled = true;
    const label = ok.textContent;
    ok.textContent = "처리 중...";
    try { await (onConfirm && onConfirm()); dismiss(); }
    catch (e) { ok.disabled = false; ok.textContent = label; /* caller가 토스트 표시 */ }
  });
}

// 체인코드/BE에서 내려온 거래 메모를 사용자가 읽기 좋은 한 줄로 변환.
// raw 예) "구매 에스크로 예치: order=cmp...", "판매 정산 수익금95%+캐시백2%=19400: order=... 플랫폼수수료=1200"
function prettifyHistoryDescription(item) {
  const raw = String((item && (item.description || item.memo || item.type)) || "");
  const fmt = (n) => Number(n).toLocaleString("ko-KR");
  let m;
  // 환불 포인트 복구 — "신고 환불"보다 먼저 매칭
  if ((m = raw.match(/신고 환불 포인트 복구.*?order=([\w-]+)/))) {
    return `환불 — 사용 포인트 복원 (주문 #${m[1].slice(-6)})`;
  }
  // 환불 — 실제로는 Square 지갑으로 복원됨 (memo의 은행 정보는 무시)
  if ((m = raw.match(/정산 계좌로 환불 송금.*?order=([\w-]+)/))) {
    return `Square 지갑으로 환불 (주문 #${m[1].slice(-6)})`;
  }
  if ((m = raw.match(/신고 환불.*?order=([\w-]+)/))) {
    // 정산 계좌가 없어 Square 지갑으로 환불된 경우 (memo에 은행 정보 없음)
    return `Square 지갑으로 환불 (주문 #${m[1].slice(-6)})`;
  }
  if ((m = raw.match(/구매 에스크로 예치.*?order=([\w-]+)/))) {
    return `상품 구매 결제 (주문 #${m[1].slice(-6)})`;
  }
  if ((m = raw.match(/판매 정산[^:]*?=(\d+).*?order=([\w-]+)/))) {
    return `판매 정산 +${fmt(m[1])} Square (주문 #${m[2].slice(-6)})`;
  }
  if ((m = raw.match(/구매 캐시백[^=]*?=(\d+).*?order=([\w-]+)/))) {
    // 캐시백은 더 이상 Square가 아닌 PAID 포인트로 지급됨 → Square 거래내역에서 숨김
    return null;
  }
  if ((m = raw.match(/즉시 충전\s*([\d,]+)원.*?([\d,]+)\s*SQ/))) {
    return `Square 충전 +${m[2]} SQ (${m[1]}원)`;
  }
  if ((m = raw.match(/Toss 충전\s*([\d,]+)원.*?([\d,]+)\s*SQ/))) {
    return `Toss 결제로 Square 충전 (${m[1]}원)`;
  }
  if ((m = raw.match(/(?:출금|환불)\s+\S+\s*→\s*(\S+)\s+([\d-]+)/))) {
    const digits = String(m[2]).replace(/\D/g, "");
    const tail = digits.slice(-4) || "****";
    return `정산 환불 → ${m[1]} ***${tail}`;
  }
  // Point Wallet 쪽 메모
  if ((m = raw.match(/^토스 충전\s*([\d,]+)원.*?(\d+)\s*RP/))) {
    return `Toss 충전 적립 +${m[2]} P (${m[1]}원)`;
  }
  if ((m = raw.match(/^충전 적립 보너스\s*(\d+)\s*RP/))) {
    return `충전 보너스 +${m[1]} P`;
  }
  if ((m = raw.match(/^충전 적립금:\s*([\d,]+)원/))) {
    return `충전 적립금 (${m[1]}원 충전)`;
  }
  // 매칭 실패 시 — 최소한 raw memo 내부의 노출 위험 토큰만 가림
  return raw
    .replace(/order=([\w-]+)/g, (_, id) => `주문 #${id.slice(-6)}`)
    .replace(/charge=([\w-]+)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
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

    <h2 style="margin-top:36px">정산 계좌</h2>
    <p class="sub">판매 정산금·환불 출금에 사용되는 계좌입니다. (예금주는 본인 명의여야 합니다)</p>
    <div class="kv-row" data-field="bankName">
      <span class="k">은행</span>
      <span class="v">${esc(user?.bankName || "-")}</span>
      <button class="edit" type="button">${ICON.edit} 수정</button>
    </div>
    <div class="kv-row" data-field="accountNumber">
      <span class="k">계좌번호</span>
      <span class="v mono">${esc(user?.accountNumber || "-")}</span>
      <button class="edit" type="button">${ICON.edit} 수정</button>
    </div>
    <div class="kv-row" data-field="accountHolder">
      <span class="k">예금주</span>
      <span class="v">${esc(user?.accountHolder || "-")}</span>
      <button class="edit" type="button">${ICON.edit} 수정</button>
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

  // Inline editing — 정식 모달 (prompt() 대체)
  const FIELD_CONFIG = {
    nickname: {
      title: "닉네임 수정",
      label: "닉네임",
      hint: "마켓·리뷰에 표시되는 이름입니다. 2~20자 이내, 다른 사용자와 중복될 수 없습니다.",
      placeholder: "예) AI러버",
      minLength: 2, maxLength: 20,
    },
    email: {
      title: "이메일 수정",
      label: "이메일 주소",
      hint: "결제 알림·계정 안내가 발송되는 주소입니다.",
      type: "email",
      placeholder: "name@example.com",
      maxLength: 60,
      pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$",
      patternMessage: "올바른 이메일 형식이 아닙니다.",
    },
    bankName: {
      title: "정산 은행 수정",
      label: "은행명",
      hint: "정산 계좌의 은행명을 입력하세요. (예: 국민은행, 신한은행, 카카오뱅크)",
      placeholder: "국민은행",
      maxLength: 20,
    },
    accountNumber: {
      title: "정산 계좌번호 수정",
      label: "계좌번호",
      hint: "숫자와 하이픈(-)만 사용 가능합니다. 본인 명의 계좌만 등록할 수 있습니다.",
      placeholder: "123-456-789012",
      pattern: "^[0-9-]+$",
      patternMessage: "계좌번호는 숫자와 하이픈(-)만 사용 가능합니다.",
      maxLength: 30,
      mono: true,
    },
    accountHolder: {
      title: "예금주 수정",
      label: "예금주",
      hint: "본인 명의의 실명만 등록 가능합니다. 송금 시 은행에 등록된 이름과 정확히 일치해야 합니다.",
      placeholder: "홍길동",
      maxLength: 20,
    },
  };

  root.querySelectorAll(".kv-row[data-field]").forEach(row => {
    const btn = row.querySelector(".edit");
    btn.addEventListener("click", () => {
      const field = row.dataset.field;
      const current = row.querySelector(".v").textContent.trim();
      const cfg = FIELD_CONFIG[field] || { title: "수정", label: field };
      openEditFieldModal({
        ...cfg,
        value: current === "-" ? "" : current,
      }, async (value) => {
        await api.user.updateProfile({ [field]: value });
        const u = api.getCurrentUser();
        if (u) { u[field] = value; api.setCurrentUser(u); }
        showToast("저장되었습니다.");
        renderAccount(root, api, showToast);
      });
    });
  });

  document.getElementById("passBtn").addEventListener("click", async () => {
    if (passVerified) {
      openConfirmModal({
        title: "PASS 본인인증 해제",
        message: "PASS 본인인증을 해제하시겠습니까?\n해제 후에는 구매·판매·리뷰가 제한됩니다.",
        confirmLabel: "인증 해제",
        cancelLabel: "취소",
        danger: true,
      }, async () => {
        try {
          await api.auth.revokePass();
          showToast("PASS 인증이 해제되었습니다.");
          try { await api.user.getMe(); } catch {}
          renderAccount(root, api, showToast);
        } catch (e) {
          showToast(e.message || 'PASS 해제 실패');
          throw e;
        }
      });
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
  document.getElementById("deleteAccountBtn").addEventListener("click", () => {
    const uname = user?.username || '';
    openEditFieldModal({
      title: "회원 탈퇴",
      label: `확인을 위해 본인 아이디(${uname})를 입력`,
      hint: "탈퇴 시 계정과 등록한 상품·리뷰·찜·장바구니·포인트 내역이 모두 영구 삭제되며 복구할 수 없습니다.",
      placeholder: uname,
      value: "",
      confirmLabel: "탈퇴하기",
      mono: true,
    }, async (input) => {
      if (input !== uname) {
        throw new Error("아이디가 일치하지 않습니다.");
      }
      try {
        await api.auth.deleteAccount();
        showToast("탈퇴가 완료되었습니다. 이용해 주셔서 감사합니다.");
        setTimeout(() => { location.href = "./index.html"; }, 1200);
      } catch (e) {
        throw new Error(e.message || "탈퇴에 실패했습니다.");
      }
    });
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

  // YR 브랜치 EXCHANGE_PARTNERS와 동일 환율 (rateIn = rateOut)
  const EXCHANGE_PARTNERS = [
    { id: 'naver', name: '네이버페이', short: 'N', bg: '#03C75A', fg: '#fff',     rate: 0.9,  liveBE: true  },
    { id: 'kakao', name: '카카오페이', short: 'K', bg: '#FFCD00', fg: '#1f2a38',  rate: 0.9,  liveBE: false },
    { id: 'toss',  name: '토스페이',  short: 'T', bg: '#0064FF', fg: '#fff',     rate: 0.95, liveBE: false },
    { id: 'ssg',   name: 'SSG페이',   short: 'S', bg: '#E3001B', fg: '#fff',     rate: 0.88, liveBE: false },
  ];
  // YR과 동일한 상태 라벨 (PENDING / COMPLETED / FAILED)
  const EX_STATUS = {
    PENDING:   { label: 'Fabric 서명 대기', bg: '#fef6e0', fg: '#b87705' },
    COMPLETED: { label: '전환 완료',        bg: '#def8ea', fg: '#1f8a5b' },
    CONFIRMED: { label: '전환 완료',        bg: '#def8ea', fg: '#1f8a5b' },
    REJECTED:  { label: '전환 실패',        bg: '#ffe3d6', fg: '#c8331f' },
    FAILED:    { label: '전환 실패',        bg: '#ffe3d6', fg: '#c8331f' },
  };

  // 포인트 전환 탭 상태 (refresh를 거쳐도 유지) — YR 디폴트(가져오기)
  let exState = { partnerId: 'naver', direction: 'in', amountRaw: '' };

  let active = "square";

  async function paint() {
    if (active === 'exchange') return paintExchange();
    const isSquare = active === "square";

    let bal = { balance: 0 };
    let hist = { items: [] };

    if (isSquare) {
      [bal, hist] = await Promise.all([
        api.square.getBalance(),
        api.square.getHistory({ limit: 20 }),
      ]);
    } else {
      // Point 탭 = ACTIVITY 포인트만 (리뷰 작성·이벤트 적립). 전환 불가, 사이트 내 할인 전용.
      const activityBal = await fetch(api.API_BASE + '/points/balance/activity', {
        headers: { Authorization: 'Bearer ' + api.getJwt() },
      }).then(r => r.json()).catch(() => ({}));
      bal = { balance: Number(activityBal?.balance || 0) };
      const allHist = await api.point.getHistory({ limit: 100 }).catch(() => ({ items: [] }));
      // category === 'ACTIVITY'만 필터링 (category 없는 옛 데이터는 보수적으로 제외)
      const items = (allHist.items || []).filter(it => it.category === 'ACTIVITY').slice(0, 20);
      hist = { items };
    }

    root.innerHTML = `
      <h2>지갑 관리</h2>
      <p class="sub">Square는 구매·판매 결제용, Point는 사이트 할인 적립용, 포인트 전환은 NaverPay 등 외부 파트너와의 포인트 교환입니다.</p>

      ${walletTabsHtml()}

      <div class="wallet-balance ${isSquare ? "" : "point"}">
        <div>
          <div class="label">${isSquare ? "Square 잔액" : "ACTIVITY 포인트 잔액"}</div>
          <div class="amt">${n(bal.balance)}<em>${isSquare ? "Square" : "Point"}</em></div>
          <div class="note">${isSquare ? `≈ ₩${n(bal.balance)} (결제 기준)` : `리뷰 작성·이벤트 적립분 · 사이트 내 할인만 사용 가능`}</div>
        </div>
        <div class="wallet-actions">
          ${isSquare
            ? `<button class="btn-ink" id="chargeBtn">${ICON.plus} 충전</button><button class="btn-ghost" id="withdrawBtn">${ICON.arrowOut || ""} 환불</button>`
            : ''}
          <button class="btn-ghost" id="refreshBtn">${ICON.refresh} 새로고침</button>
        </div>
      </div>

      <div class="wallet-info">
        ${isSquare
          ? `• 결제 시 <b>1 Square = 1원</b><br>• 충전 시 <b>1,000 Square = 1,100원</b> (수수료 10% 포함)<br>• 구매 확정 시 양쪽 2% 캐시백은 <b>PAID 포인트 탭</b>에서 확인`
          : `• <b>리뷰 작성</b> 시 +100 Point (ACTIVITY)<br>• <b>이벤트 보상</b> (ACTIVITY)<br>• ACTIVITY 포인트는 <b>출금·외부 전환 불가</b> · 사이트 내 결제 할인 전용<br>• 충전·구매 캐시백(PAID)은 <b>포인트 전환 탭</b>에서 확인·전환`}
      </div>

      <h3 style="margin:0 0 12px;font-size:15px;font-weight:800;color:#677181">${isSquare ? "거래 내역" : "ACTIVITY 적립 내역"}</h3>
      ${hist.items.length === 0
        ? `<div class="empty-state"><strong>내역이 없습니다</strong></div>`
        : `<div class="history-list">${hist.items.map(it => {
            const label = prettifyHistoryDescription(it);
            if (!label) return '';  // null/빈값이면 카드 숨김 (캐시백 등 옛 항목)
            const isIn = it.amount > 0;
            return `<div class="history-row">
              <div class="meta"><strong><span style="display:inline-flex;align-items:center;gap:6px">${isIn ? ICON.arrowIn : ICON.arrowOut}${esc(label)}</span></strong><time>${fmtDate(it.createdAt)}</time></div>
              <span class="amt ${isIn ? "plus" : "minus"}">${isIn ? "+" : ""}${n(it.amount)}</span>
            </div>`;
          }).join("")}</div>`}
    `;

    wireTabs();
    root.querySelector("#refreshBtn")?.addEventListener("click", () => { showToast("새로고침했습니다."); paint(); });
    root.querySelector("#chargeBtn")?.addEventListener("click", () => openChargeModal(api, showToast));
    root.querySelector("#withdrawBtn")?.addEventListener("click", () => openWithdrawModal(api, showToast, bal.balance));
  }

  function walletTabsHtml() {
    return `
      <div class="wallet-tabs">
        <button class="wallet-tab ${active==='square'   ? 'is-active' : ''}" data-w="square">${ICON.wallet} Square Wallet</button>
        <button class="wallet-tab ${active==='point'    ? 'is-active' : ''}" data-w="point">${ICON.coins} Point Wallet</button>
        <button class="wallet-tab ${active==='exchange' ? 'is-active' : ''}" data-w="exchange">${ICON.arrowIn || ''} 포인트 전환</button>
      </div>`;
  }
  function wireTabs() {
    root.querySelectorAll(".wallet-tab").forEach(b =>
      b.addEventListener("click", () => { active = b.dataset.w; paint(); }));
  }

  function renderExPreview(partner, numAmount, direction) {
    if (!partner || !numAmount || numAmount <= 0) return '';
    const result = Math.floor(numAmount * partner.rate);
    const target = direction === 'in' ? 'AI Square Point' : (partner.name + ' 포인트');
    return `
      <div class="ex-preview">
        <div class="row"><span>전환율</span><span>1 : ${partner.rate}</span></div>
        <div class="row"><span>수령 포인트</span><b>${n(result)} ${target}</b></div>
        <div class="hint">AI Square와 ${esc(partner.name)} 양 기관이 Hyperledger Fabric 네트워크에서 서명을 완료한 후 처리됩니다. 통상 1–3분 소요됩니다.</div>
      </div>`;
  }

  async function paintExchange() {
    // 잔액 + 전환내역 + PAID 적립내역 로드
    let paidBal = 0, history = [], paidLogs = [];
    try {
      const [b, h, allHist] = await Promise.all([
        fetch(api.API_BASE + '/points/balance/paid', { headers: { Authorization: 'Bearer ' + api.getJwt() } }).then(r => r.json()).catch(() => ({})),
        fetch(api.API_BASE + '/points/exchange-naver', { headers: { Authorization: 'Bearer ' + api.getJwt() } }).then(r => r.json()).catch(() => []),
        api.point.getHistory({ limit: 100 }).catch(() => ({ items: [] })),
      ]);
      paidBal = Number(b?.balance || 0);
      history = Array.isArray(h) ? h : (h?.items || []);
      paidLogs = (allHist.items || []).filter(it => it.category === 'PAID').slice(0, 20);
    } catch (e) { /* ignore */ }

    // 누적 NaverPay 포인트 — CONFIRMED OUT 합계에서 CONFIRMED IN 합계를 뺀 순증가량
    const naverPointBal = (history || [])
      .filter(it => (it.status === 'CONFIRMED' || it.status === 'COMPLETED'))
      .reduce((sum, it) => {
        const recorded = Number(it.naverPointAmount || it.amountNaver || it.naverPointCredited || 0);
        const np = recorded > 0 ? recorded : Math.floor(Number(it.amountPaid || it.paidPointAmount || 0) * 0.9);
        const isInbound = it.direction === 'FROM_NAVER' || it.direction === 'NAVER_TO_AISQUARE';
        return sum + (isInbound ? -np : np);
      }, 0);

    const getPartner = () => EXCHANGE_PARTNERS.find(p => p.id === exState.partnerId) || EXCHANGE_PARTNERS[0];
    const calcNum = () => parseInt(String(exState.amountRaw).replace(/[^0-9]/g, ''), 10) || 0;
    const partner = getPartner();
    const numAmount = calcNum();
    const resultAmount = partner ? Math.floor(numAmount * partner.rate) : 0;
    const directionLabel = exState.direction === 'in'
      ? `${partner.name} 포인트 → AI Square Point`
      : `AI Square Point → ${partner.name} 포인트`;

    root.innerHTML = `
      <h2>지갑 관리</h2>
      <p class="sub">Square는 구매·판매 결제용, Point는 사이트 할인 적립용, 포인트 전환은 NaverPay 등 외부 파트너와의 포인트 교환입니다.</p>

      ${walletTabsHtml()}

      <div class="ex-balances">
        <div class="ex-bcard ex-bcard-paid">
          <div class="lbl">전환 가능 PAID 포인트</div>
          <div class="amt">${n(paidBal)}<em>Point</em></div>
          <div class="sub">충전·구매 캐시백 적립분 (외부 전환 가능)</div>
        </div>
        <div class="ex-bcard ex-bcard-naver">
          <div class="lbl"><span class="np-dot">N</span> NaverPay 포인트 (누적 전환)</div>
          <div class="amt">${n(naverPointBal)}<em>NP</em></div>
          <div class="sub">CONFIRMED 처리된 전환의 누계입니다.</div>
        </div>
        <button class="btn-ghost ex-refresh" id="refreshBtn">${ICON.refresh} 새로고침</button>
      </div>

      <div class="wallet-info">
        • <b>Square 충전</b> 시 KRW의 0.1% 자동 적립 (PAID)<br>
        • <b>구매 확정</b> 시 결제액의 2% 캐시백 (PAID)<br>
        • PAID 포인트만 네이버페이 등 외부 파트너로 전환 가능 (PASS 본인인증 필요)<br>
        • 리뷰·이벤트 적립분(ACTIVITY)은 <b>Point 탭</b>에서 확인
      </div>

      ${paidLogs.length > 0 ? `
        <h3 style="margin:24px 0 12px;font-size:15px;font-weight:800;color:#677181">PAID 적립 내역</h3>
        <div class="history-list">${paidLogs.map(it => {
          const isIn = it.amount > 0;
          return `<div class="history-row">
            <div class="meta"><strong><span style="display:inline-flex;align-items:center;gap:6px">${isIn ? ICON.arrowIn : ICON.arrowOut}${esc(prettifyHistoryDescription(it))}</span></strong><time>${fmtDate(it.createdAt)}</time></div>
            <span class="amt ${isIn ? "plus" : "minus"}">${isIn ? "+" : ""}${n(it.amount)}</span>
          </div>`;
        }).join('')}</div>
      ` : ''}

      <div class="ex-section">
        <p class="ex-h">파트너 선택</p>
        <div class="ex-partners">
          ${EXCHANGE_PARTNERS.map(p => `
            <button class="ex-partner ${p.id===exState.partnerId?'on':''}" data-p="${p.id}">
              <span class="ex-pcircle" style="background:${p.bg};color:${p.fg}">${p.short}</span>
              <span class="ex-pname">${esc(p.name)}</span>
            </button>`).join('')}
        </div>
      </div>

      <div class="ex-section">
        <p class="ex-h">전환 방향</p>
        <div class="ex-direction">
          <button class="ex-dir ${exState.direction==='in'?'on':''}"  data-d="in">${ICON.arrowIn || ''} 포인트 가져오기</button>
          <button class="ex-dir ${exState.direction==='out'?'on':''}" data-d="out">${ICON.arrowOut || ''} 포인트 내보내기</button>
        </div>
        <p class="ex-sub">${directionLabel}</p>
      </div>

      <div class="ex-section">
        <p class="ex-h">전환할 포인트 수량</p>
        <input type="text" id="exAmount" class="ex-input" placeholder="0" value="${esc(exState.amountRaw)}" inputmode="numeric" />
        <p class="ex-sub">최소 100 Point · ${exState.direction==='out'?'보유 PAID 한도 내에서':'파트너 잔액 한도 내에서'}</p>
      </div>

      <div id="exPreview">${renderExPreview(partner, numAmount, exState.direction)}</div>

      <button class="ex-submit" id="exSubmit" ${(!exState.partnerId || numAmount < 100) ? 'disabled' : ''}>전환 요청</button>

      <h3 style="margin:24px 0 12px;font-size:15px;font-weight:800;color:#677181">전환 내역</h3>
      ${history.length === 0
        ? `<div class="empty-state"><strong>전환 내역이 없습니다</strong></div>`
        : `<div class="history-list">${history.map(it => {
            const p = EXCHANGE_PARTNERS.find(x => x.id === (it.partnerId || 'naver')) || EXCHANGE_PARTNERS[0];
            const st = EX_STATUS[it.status] || { label: it.status || 'UNKNOWN', bg: '#eef0f3', fg: '#677181' };
            const isInbound = it.direction === 'FROM_NAVER' || it.direction === 'NAVER_TO_AISQUARE';
            const naverAmt = Number(it.naverPointAmount ?? it.amountNaver ?? it.naverPointCredited ?? 0);
            const paidAmt = Number(it.paidPointAmount ?? it.amountPaid ?? 0);
            const paidShown = paidAmt > 0 ? paidAmt : Math.floor(naverAmt * 0.9);
            const naverShown = naverAmt > 0 ? naverAmt : Math.floor(paidAmt * 0.9);
            const title = isInbound ? `${esc(p.name)} → AI Square` : `AI Square → ${esc(p.name)}`;
            return `<div class="history-row">
              <div class="meta">
                <strong><span style="display:inline-flex;align-items:center;gap:8px">
                  <span class="ex-pcircle" style="background:${p.bg};color:${p.fg};width:22px;height:22px;font-size:11px;">${p.short}</span>
                  ${title}
                </span></strong>
                <time>${fmtDate(it.createdAt)} · <span style="padding:2px 8px;border-radius:999px;background:${st.bg};color:${st.fg};font-weight:800;font-size:11px;">${esc(st.label)}</span></time>
              </div>
              <span class="ex-flow">
                ${isInbound
                  ? `<span class="ex-flow-from" style="color:${p.bg}">-${n(naverShown)}<em>NP</em></span>
                     <span class="ex-flow-arrow">→</span>
                     <span class="ex-flow-to" style="color:#1f8a5b">+${n(paidShown)}<em>P</em></span>`
                  : `<span class="ex-flow-from">-${n(paidShown)}<em>P</em></span>
                     <span class="ex-flow-arrow">→</span>
                     <span class="ex-flow-to" style="color:${p.bg}">+${n(naverShown)}<em>NP</em></span>`}
              </span>
            </div>`;
          }).join('')}</div>`}
    `;

    wireTabs();
    root.querySelector('#refreshBtn')?.addEventListener('click', () => { showToast('새로고침했습니다.'); paint(); });
    root.querySelectorAll('.ex-partner').forEach(b => b.addEventListener('click', () => {
      if (b.disabled) return;
      exState.partnerId = b.dataset.p; paint();
    }));
    root.querySelectorAll('.ex-dir').forEach(b => b.addEventListener('click', () => {
      exState.direction = b.dataset.d; paint();
    }));
    const inp = root.querySelector('#exAmount');
    if (inp) {
      inp.addEventListener('input', (e) => {
        const before = e.target.value;
        const caretBefore = e.target.selectionStart || before.length;
        const digitsBeforeCaret = before.slice(0, caretBefore).replace(/[^0-9]/g, '').length;

        const v = before.replace(/[^0-9]/g, '');
        const formatted = v ? Number(v).toLocaleString() : '';
        exState.amountRaw = formatted;
        e.target.value = formatted;

        // 캐럿을 디지트 기준으로 복원
        let newCaret = 0, seen = 0;
        for (let i = 0; i < formatted.length && seen < digitsBeforeCaret; i++) {
          if (/[0-9]/.test(formatted[i])) seen++;
          newCaret = i + 1;
        }
        try { e.target.setSelectionRange(newCaret, newCaret); } catch (_) {}

        // 미리보기/버튼만 인라인 갱신 (paint() 안 부름 → input 안 사라짐)
        const num = calcNum();
        const pv = root.querySelector('#exPreview');
        if (pv) pv.innerHTML = renderExPreview(getPartner(), num, exState.direction);
        const submit = root.querySelector('#exSubmit');
        if (submit) submit.disabled = !(exState.partnerId && num >= 100);
      });
    }
    const submitBtn = root.querySelector('#exSubmit');
    if (submitBtn) submitBtn.addEventListener('click', async () => {
      // 다중 클릭 방지: 처리 중이면 즉시 리턴
      if (submitBtn.dataset.busy === '1') return;
      submitBtn.dataset.busy = '1';
      submitBtn.disabled = true;
      const originalLabel = submitBtn.textContent;
      submitBtn.textContent = '처리 중...';

      // 클로저의 stale numAmount 대신 현재 입력값 기준으로 재계산
      const currentAmount = calcNum();
      const currentPartner = getPartner();

      const release = () => {
        submitBtn.dataset.busy = '0';
        submitBtn.disabled = false;
        submitBtn.textContent = originalLabel;
      };

      const me = api.getCurrentUser() || {};
      if (!me.phoneVerified && !me.passVerified) {
        showToast('PASS 본인인증이 필요합니다.'); setTimeout(() => location.hash = 'account', 800); release(); return;
      }
      if (currentAmount < 100) { showToast('최소 100 Point부터 가능합니다.'); release(); return; }
      if (!currentPartner.liveBE) {
        showToast(`${currentPartner.name}은(는) Fabric 멀티-Org 연동 준비 중입니다. 곧 사용 가능해요.`);
        release(); return;
      }
      if (exState.direction === 'out' && currentAmount > paidBal) {
        showToast(`PAID 포인트 부족 (보유 ${paidBal.toLocaleString()}P)`); release(); return;
      }
      try {
        if (exState.direction === 'out') {
          const res = await fetch(api.API_BASE + '/points/exchange-naver', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + api.getJwt() },
            body: JSON.stringify({ amount: currentAmount }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || '전환 요청 실패');
          showToast('전환 요청이 접수되었습니다. Fabric 네트워크에서 처리 중입니다.');
        } else {
          // 가져오기 (네이버 → AI Square): PENDING 생성 → AISquare 관리자 승인
          const res = await fetch(api.API_BASE + '/points/exchange-naver/from-naver', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + api.getJwt() },
            body: JSON.stringify({ amount: currentAmount }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || '가져오기 요청 실패');
          showToast(`가져오기 요청 접수 — ${currentAmount.toLocaleString()}NP → ${(data.paidPointAmount || 0).toLocaleString()}P (AISquare 관리자 승인 대기)`);
        }
        exState.amountRaw = '';
        paint();
      } catch (e) {
        showToast(e.message || '전환 요청 실패');
        release();
      }
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

// ── Square 환불 모달 ──
async function openWithdrawModal(api, showToast, currentBalance) {
  const me = api.getCurrentUser() || {};
  if (!me.phoneVerified && !me.passVerified) {
    showToast("PASS 본인인증이 필요합니다.");
    setTimeout(() => location.hash = "account", 800);
    return;
  }
  // 계좌 등록 확인 (BE에서 한 번 더 검증하지만 UX상 미리)
  const myFull = await api.user.getMe().catch(() => me);
  if (!myFull?.bankName || !myFull?.accountNumber || !myFull?.accountHolder) {
    showToast("정산 계좌를 먼저 등록해주세요.");
    setTimeout(() => location.hash = "account", 800);
    return;
  }

  document.querySelectorAll(".withdraw-modal-bg").forEach(n => n.remove());
  let amount = Math.min(10000, currentBalance);

  const wrap = document.createElement("div");
  wrap.className = "withdraw-modal-bg";
  wrap.style.cssText = "position:fixed;inset:0;background:rgba(11,13,18,0.55);display:flex;align-items:center;justify-content:center;z-index:9999;backdrop-filter:blur(2px);";
  wrap.innerHTML = `
    <div style="background:#fff;width:min(440px,calc(100vw - 32px));border-radius:16px;padding:28px;box-shadow:0 20px 60px rgba(0,0,0,0.25);">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
        <h3 style="margin:0;font-size:18px;font-weight:900;color:#0b0d12;">Square 환불</h3>
        <button type="button" id="wmClose" style="background:none;border:0;font-size:22px;color:#677181;cursor:pointer;line-height:1;">×</button>
      </div>
      <p style="margin:0 0 18px;font-size:12.5px;color:#677181;">등록된 정산 계좌로 송금 처리됩니다. 1 Square = 1원.</p>

      <div style="background:#f5f7fb;border-radius:12px;padding:14px 16px;margin-bottom:18px;font-size:13px;line-height:1.7;">
        <div style="display:flex;justify-content:space-between;"><span style="color:#677181">은행</span><b>${(myFull.bankName||"-")}</b></div>
        <div style="display:flex;justify-content:space-between;"><span style="color:#677181">계좌번호</span><b class="mono">${(myFull.accountNumber||"-")}</b></div>
        <div style="display:flex;justify-content:space-between;"><span style="color:#677181">예금주</span><b>${(myFull.accountHolder||"-")}</b></div>
        <div style="display:flex;justify-content:space-between;margin-top:6px;padding-top:6px;border-top:1px solid #e5e9ef;"><span style="color:#677181">현재 잔액</span><b style="color:#1F3AE0">${(currentBalance||0).toLocaleString()} Square</b></div>
      </div>

      <label style="display:block;margin-bottom:18px;">
        <span style="display:block;font-size:12px;font-weight:800;color:#677181;letter-spacing:0.04em;margin-bottom:6px;">환불 금액 (Square)</span>
        <input id="wmAmount" type="number" min="5000" step="1000" value="${amount}" inputmode="numeric" style="width:100%;padding:11px 12px;border:1px solid #d4dae4;border-radius:10px;font-size:15px;font-weight:700;color:#1f2a38;outline:none;" />
        <span id="wmHint" style="display:block;margin-top:6px;font-size:11.5px;color:#677181;">최소 5,000 Square · 보유 한도 내</span>
      </label>

      <div style="display:flex;gap:8px;">
        <button type="button" id="wmCancel" style="flex:1;padding:13px;border:1px solid #d4dae4;background:#fff;border-radius:10px;font-weight:800;font-size:14px;color:#1f2a38;cursor:pointer;">취소</button>
        <button type="button" id="wmDo" style="flex:2;padding:13px;border:0;background:#c0392b;border-radius:10px;font-weight:800;font-size:14px;color:#fff;cursor:pointer;"><span id="wmDoLabel">₩${amount.toLocaleString()} 환불받기</span></button>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  const close = () => wrap.remove();
  wrap.addEventListener("click", e => { if (e.target === wrap) close(); });
  wrap.querySelector("#wmClose").addEventListener("click", close);
  wrap.querySelector("#wmCancel").addEventListener("click", close);

  const input = wrap.querySelector("#wmAmount");
  const hint = wrap.querySelector("#wmHint");
  const doBtn = wrap.querySelector("#wmDo");
  const doLabel = wrap.querySelector("#wmDoLabel");
  function recalc() {
    const v = Math.floor(Number(input.value));
    const valid = v >= 5000 && v <= currentBalance;
    if (!valid) {
      hint.textContent = v > currentBalance ? `잔액 부족 (보유 ${currentBalance.toLocaleString()})` : "최소 5,000 Square";
      hint.style.color = "#c8331f";
      doBtn.disabled = true; doBtn.style.opacity = "0.5"; doBtn.style.cursor = "not-allowed";
    } else {
      hint.textContent = `등록 계좌로 ₩${v.toLocaleString()} 송금됩니다`;
      hint.style.color = "#1F8A5B";
      doBtn.disabled = false; doBtn.style.opacity = "1"; doBtn.style.cursor = "pointer";
    }
    doLabel.textContent = "₩" + (valid ? v : 0).toLocaleString() + " 환불받기";
    amount = valid ? v : 0;
  }
  input.addEventListener("input", recalc);
  recalc();

  doBtn.addEventListener("click", async () => {
    if (!amount) return;
    doBtn.disabled = true; doLabel.textContent = "처리 중...";
    try {
      const res = await fetch(window.AISquareAPI.API_BASE + "/wallet/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + window.AISquareAPI.getJwt() },
        body: JSON.stringify({ squareAmount: amount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "환불 실패");
      showToast(data.message || `${amount.toLocaleString()} Square 환불 완료`);
      close();
      if (typeof window.__aisqRepaintWallet === "function") window.__aisqRepaintWallet();
    } catch (e) {
      console.error("withdraw failed:", e);
      showToast(e.message || "환불 실패");
      doBtn.disabled = false; doLabel.textContent = "₩" + amount.toLocaleString() + " 환불받기";
    }
  });
}

async function renderOrders(root, api, showToast, kind) {
  const isPurchase = kind === "purchase";
  const items = isPurchase ? await api.orders.getList() : (window.AISquareAPI && JSON.parse(localStorage.getItem("aisquare-mock-store"))?.sales) || [];

  const STATUS = {
    PAYMENT_PENDING:  { label: "결제 대기",      cls: "yellow" },
    PAYMENT_COMPLETE: { label: "결제 완료",      cls: "yellow" },
    PENDING:          { label: "구매 확정 대기", cls: "yellow" },
    CONFIRMED:        { label: "구매 확정",      cls: "green"  },
    SETTLEMENT_HOLD:  { label: "환불 대기",      cls: "red"    },
    REPORTED:         { label: "신고 접수됨",    cls: "red"    },
    REFUNDED:         { label: "환불 완료",      cls: "gray"   },
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
          const canReport = isPurchase && o.status === "PENDING" && !o.hasReport;
          const reportReceived = isPurchase && (o.hasReport || o.status === "SETTLEMENT_HOLD");
          // 72h 카운트다운 (autoConfirmAt 기준)
          let timerHtml = '';
          if (isPurchase && o.status === 'PENDING' && o.autoConfirmAt) {
            const targetTs = new Date(o.autoConfirmAt).getTime();
            timerHtml = `<span class="auto-confirm-timer" data-target="${targetTs}" style="margin-left:8px;font-size:12px;font-weight:800;color:#1F3AE0;background:#eef1ff;padding:3px 10px;border-radius:999px;">자동확정 ⏱ <span class="auto-confirm-remain">--:--:--</span></span>`;
          }
          // REFUNDED 안내 (결제 수단 + 등록 계좌 유무에 따라 분기)
          let refundNote = '';
          if (isPurchase && o.status === 'REFUNDED') {
            const me = api.getCurrentUser() || {};
            const masked = (a) => a ? (String(a).slice(0, 4) + '****' + String(a).slice(-2)) : '';
            let msg;
            if (o.paymentMethod === 'SQUARE') {
              msg = `환불 완료 — Square Wallet으로 복원됨${o.usedPoint ? ` · 사용 포인트 ${n(o.usedPoint)}P 복구` : ''}`;
            } else if (me.bankName && me.accountNumber && me.accountHolder) {
              msg = `환불 완료 — 2~3 영업일 내 <b>${esc(me.bankName)} ${esc(masked(me.accountNumber))} (${esc(me.accountHolder)})</b>로 입금 예정 (Toss Payouts)`;
            } else {
              msg = `환불 완료 — 결제하신 카드사로 환불 (정산 계좌 미등록)`;
            }
            refundNote = `<div style="margin-top:8px;padding:10px 12px;background:#fbe5e1;color:#7a1d10;border-radius:8px;font-size:12.5px;line-height:1.5;">↩ ${msg}</div>`;
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
              ${refundNote}
            </div>
            <div class="actions">
              ${isPurchase ? `<button type="button" class="btn-ghost" data-order-act="download" data-id="${esc(o.id)}">${ICON.download} 다운로드</button>` : ""}
              ${isPurchase && o.status === "PENDING" ? `<button type="button" class="btn-ink" data-order-act="confirm" data-id="${esc(o.id)}">${ICON.check} 구매 확정</button>` : ""}
              ${isPurchase && o.status === "CONFIRMED" && !o.hasReview ? `<button type="button" class="btn-ink" data-order-act="review" data-id="${esc(o.id)}">${ICON.pen} 리뷰 작성</button>` : ""}
              ${canReport ? `<button type="button" class="btn-danger" data-order-act="report" data-id="${esc(o.id)}">${ICON.alert} 신고</button>` : ""}
              ${reportReceived ? `<button type="button" class="btn-danger" disabled>${ICON.alert} 신고 접수됨</button>` : ""}
            </div>
          </div>`;
        }).join("")
    }
  `;

  root.onclick = async (e) => {
    const b = e.target.closest('[data-order-act]');
    if (!b || !root.contains(b) || b.disabled) return;
    e.preventDefault();
    const id = b.dataset.id;
    const act = b.dataset.orderAct;
    try {
      if (act === "download") {
        // BE 스트림 엔드포인트 — 모든 확장자에서 강제 다운로드 (CloudFront cross-origin 우회)
        const res = await fetch(api.API_BASE + `/orders/${id}/download/file`, {
          headers: { Authorization: 'Bearer ' + api.getJwt() },
        });
        if (!res.ok) {
          let msg = '다운로드 실패';
          try { const j = await res.json(); msg = j.message || msg; } catch {}
          throw new Error(msg);
        }
        // Content-Disposition에서 파일명 추출 (RFC 5987 우선)
        const cd = res.headers.get('content-disposition') || '';
        let filename = 'download';
        const m87 = cd.match(/filename\*=UTF-8''([^;]+)/i);
        const m   = cd.match(/filename="([^"]+)"/i);
        if (m87) { try { filename = decodeURIComponent(m87[1]); } catch { filename = m87[1]; } }
        else if (m) { try { filename = decodeURIComponent(m[1]); } catch { filename = m[1]; } }
        const blob = await res.blob();
        const objUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = objUrl; a.download = filename;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(objUrl), 5000);
        showToast(`다운로드 완료: ${filename}`);
        return;
      }
      if (act === "confirm")  { await api.orders.confirm(id); showToast("구매가 확정되었습니다. 판매자에게 정산됩니다."); renderOrders(root, api, showToast, kind); return; }
      if (act === "review")   {
        openReviewModal(id, api, showToast, () => renderOrders(root, api, showToast, kind));
        return;
      }
      if (act === "report")   {
        const order = items.find(o => o.id === id);
        if (!order) throw new Error('주문 정보를 찾을 수 없습니다. 새로고침 후 다시 시도해 주세요.');
        openReportModal(id, order, api, showToast, () => renderOrders(root, api, showToast, kind));
        return;
      }
    } catch (err) {
      console.error('order action failed', err);
      showToast(err.message || '처리 중 오류가 발생했습니다.');
    }
  };

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

function openReportModal(orderId, order, api, showToast, onDone) {
  document.querySelectorAll('.review-modal-bg').forEach(n => n.remove());
  const CATS = [
    { v: '자료 손상',      hint: '파일이 깨졌거나 열리지 않습니다' },
    { v: '설명과 다름',    hint: '상품 설명과 실제 자료가 일치하지 않습니다' },
    { v: '복제물 의심',    hint: '저작권 침해 또는 무단 복제로 의심됩니다' },
    { v: '판매자 무응답',  hint: '판매자가 응답하지 않습니다' },
    { v: '기타',           hint: '직접 작성한 사유를 적어 주세요' },
  ];
  const wrap = document.createElement('div');
  wrap.className = 'review-modal-bg';
  wrap.innerHTML = `
    <div class="review-modal report-modal" role="dialog" aria-modal="true">
      <div class="rv-head">
        <h3>🚨 신고 접수</h3>
        <button type="button" class="rv-close" aria-label="닫기">×</button>
      </div>
      <div class="rv-body">
        <p class="rv-sub">접수된 신고는 관리자가 검토 후 환불 또는 종결 처리합니다. <b>허위 신고 시 신뢰토큰이 감점</b>될 수 있어요.</p>

        <div class="rp-product">
          <div style="flex:1;min-width:0">
            <b>${esc(order && order.productTitle || '주문')}</b>
            <div class="order-id">주문 #${esc(orderId)}</div>
          </div>
        </div>

        <div class="rv-row">
          <span class="rv-label">신고 유형 <span style="color:#C8331F">*</span></span>
          <div class="rp-cats" id="rpCats">
            ${CATS.map((c, i) => `<button type="button" class="rp-cat" data-v="${esc(c.v)}" data-hint="${esc(c.hint)}">${esc(c.v)}</button>`).join('')}
          </div>
          <p class="rp-hint" id="rpCatHint">유형을 선택해 주세요.</p>
        </div>

        <div class="rv-row">
          <span class="rv-label">상세 사유 <span style="color:#C8331F">*</span></span>
          <textarea id="rpText" placeholder="언제 / 어떤 상황에서 / 어떤 문제가 있었는지 구체적으로 적어주세요. (최소 10자)" maxlength="800"></textarea>
          <span class="rv-counter"><span id="rpCount">0</span> / 800</span>
        </div>

        <div class="rv-row">
          <span class="rv-label">증빙 이미지 <span style="color:#87909d;font-weight:700">(선택, 최대 5장)</span></span>
          <div class="rp-upload" id="rpUpload">
            <label class="rp-upload-tile" id="rpAddTile">
              <input type="file" accept="image/png,image/jpeg,image/webp" multiple />
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
            </label>
          </div>
          <p class="rp-hint">스크린샷·증거 사진은 검토에 도움이 됩니다. (JPG/PNG/WEBP, 각 10MB 이하)</p>
        </div>

        <div class="rv-actions">
          <button type="button" class="rv-cancel">취소</button>
          <button type="button" class="rv-submit" disabled>신고 접수</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(wrap);

  const close = () => wrap.remove();
  wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
  wrap.querySelector('.rv-close').addEventListener('click', close);
  wrap.querySelector('.rv-cancel').addEventListener('click', close);

  // Category chips
  let selectedCat = '';
  const catBtns = wrap.querySelectorAll('.rp-cat');
  const catHint = wrap.querySelector('#rpCatHint');
  catBtns.forEach(b => b.addEventListener('click', () => {
    catBtns.forEach(x => x.classList.toggle('on', x === b));
    selectedCat = b.dataset.v;
    catHint.textContent = b.dataset.hint;
    updateSubmit();
  }));

  // Textarea + counter
  const ta = wrap.querySelector('#rpText');
  const counter = wrap.querySelector('#rpCount');
  ta.addEventListener('input', () => { counter.textContent = ta.value.length; updateSubmit(); });

  // Image upload
  const files = [];
  const MAX_FILES = 5;
  const MAX_SIZE = 10 * 1024 * 1024;
  const upload = wrap.querySelector('#rpUpload');
  const addTile = wrap.querySelector('#rpAddTile');
  const fileInput = addTile.querySelector('input[type=file]');

  function renderThumbs() {
    // remove existing thumbs (keep the add tile last)
    upload.querySelectorAll('.rp-thumb').forEach(n => n.remove());
    files.forEach((f, idx) => {
      const t = document.createElement('div');
      t.className = 'rp-thumb';
      const img = document.createElement('img');
      img.src = URL.createObjectURL(f);
      img.onload = () => URL.revokeObjectURL(img.src);
      t.appendChild(img);
      const x = document.createElement('button');
      x.type = 'button'; x.className = 'rm-x'; x.textContent = '×';
      x.title = '제거';
      x.addEventListener('click', () => { files.splice(idx, 1); renderThumbs(); updateSubmit(); });
      t.appendChild(x);
      upload.insertBefore(t, addTile);
    });
    addTile.style.display = files.length >= MAX_FILES ? 'none' : '';
  }

  fileInput.addEventListener('change', (e) => {
    const incoming = Array.from(e.target.files || []);
    for (const f of incoming) {
      if (files.length >= MAX_FILES) { showToast(`최대 ${MAX_FILES}장까지 첨부 가능합니다.`); break; }
      if (f.size > MAX_SIZE) { showToast(`${f.name}: 10MB 초과로 제외했습니다.`); continue; }
      files.push(f);
    }
    fileInput.value = '';
    renderThumbs();
    updateSubmit();
  });

  // Submit
  const submitBtn = wrap.querySelector('.rv-submit');
  function updateSubmit() {
    submitBtn.disabled = !(selectedCat && ta.value.trim().length >= 10);
  }

  submitBtn.addEventListener('click', async () => {
    submitBtn.disabled = true; submitBtn.textContent = '접수 중...';
    try {
      const fd = new FormData();
      const reason = `[${selectedCat}] ${ta.value.trim()}`;
      fd.append('reason', reason);
      files.forEach(f => fd.append('images', f));
      const res = await fetch(api.API_BASE + `/reports/order/${orderId}`, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + api.getJwt() },
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || '신고 실패');
      showToast('신고가 접수되었습니다. 관리자가 검토 후 처리합니다.');
      close();
      onDone && onDone();
    } catch (e) {
      console.error('report submit', e);
      showToast(e.message || '신고 실패');
      submitBtn.disabled = false; submitBtn.textContent = '신고 접수';
    }
  });

  // ESC to close
  function onKey(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); } }
  document.addEventListener('keydown', onKey);
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
    // PASS 본인인증 확인
    let me;
    try { me = await api.user.getMe(); } catch { me = api.getCurrentUser(); }
    if (!me?.phoneVerified && !me?.passVerified) {
      showToast("PASS 본인인증이 필요합니다.");
      setTimeout(() => { location.href = "./mypage.html#account"; }, 900);
      return;
    }

    // 단일 상품 "바로 구매"와 동일하게 checkout.html로 이동 (cart 모드)
    location.href = "./checkout.html?cart=1";
    return;

    // — 아래 옛 인라인 결제 로직은 보류 (checkout.html로 이관됨) —
    const btn = document.getElementById("checkoutBtn");
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
