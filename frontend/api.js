/* AISquare — frontend API client (axios via CDN, no build step needed)
 *
 * Wires up the backend endpoints defined in
 * github.com/outseok/aisquare/tree/BE/backend (NestJS) — same surface as
 * the YR branch's src/api/index.js.
 *
 * Falls back to a built-in MOCK MODE when no backend is reachable, so the
 * prototype works standalone. Toggle via:
 *   localStorage.setItem('aisquare-api-mode', 'live')   // hits real backend
 *   localStorage.setItem('aisquare-api-mode', 'mock')   // forced mock (default)
 */
(function () {
  // BE: NestJS @ http://localhost:3000 (no /api prefix — controllers mount at root)
  const API_BASE = (window.AISQUARE_API_BASE) || 'http://localhost:3000';
  // Force live mode by default. The old localStorage value
  // ('aisquare-api-mode') from the mock-only era is now ignored unless
  // explicitly set to 'mock-force'.
  const _legacyMode = localStorage.getItem('aisquare-api-mode');
  const MODE = (_legacyMode === 'mock-force') ? 'mock' : 'live';
  console.info('[AISquareAPI] MODE=' + MODE + ' API_BASE=' + API_BASE);

  // (no auto-purge — caused immediate logout when login ran on old cached
  // api.js that didn't set a JWT yet)

  const JWT_KEY = 'aisquare-jwt';
  function getJwt() { return localStorage.getItem(JWT_KEY); }
  function setJwt(t) {
    if (t) localStorage.setItem(JWT_KEY, t);
    else localStorage.removeItem(JWT_KEY);
  }

  // ── Mock data store (persisted to localStorage) ────────────────────
  const STORE_KEY = 'aisquare-mock-store-v2';
  function loadStore() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORE_KEY));
      // Defensive: re-seed if any required collection is missing
      if (!parsed || !parsed.products || !parsed.sellers || !parsed.squareHistory) return seed();
      return parsed;
    } catch { return seed(); }
  }
  function saveStore(s) { localStorage.setItem(STORE_KEY, JSON.stringify(s)); }
  function seed() {
    const s = {
      user: null,
      square: { balance: 12000 },
      point: { balance: 480 },
      squareHistory: [
        { id: 'sq-1', type: 'CHARGE', amount: 10000, description: 'Square 충전',          createdAt: '2026-05-12T09:14:00Z' },
        { id: 'sq-2', type: 'SPEND',  amount: -3500, description: 'GPT-5 마케팅 카피 50선 구매', createdAt: '2026-05-14T15:30:00Z' },
        { id: 'sq-3', type: 'EARN',   amount: 5500,  description: '판매 정산 · 코드 리뷰 프롬프트', createdAt: '2026-05-16T08:02:00Z' },
      ],
      pointHistory: [
        { id: 'p-1', type: 'CHARGE_REWARD', amount: 10,  description: 'Square 충전 적립',    createdAt: '2026-05-12T09:14:00Z' },
        { id: 'p-2', type: 'REVIEW',        amount: 100, description: '리뷰 작성 보상',         createdAt: '2026-05-15T10:00:00Z' },
        { id: 'p-3', type: 'CASHBACK',      amount: 70,  description: '구매 확정 캐시백 (2%)', createdAt: '2026-05-15T11:20:00Z' },
        { id: 'p-4', type: 'SPEND',         amount: -50, description: '결제 사용',             createdAt: '2026-05-16T13:00:00Z' },
      ],
      orders: [
        { id: 'A82F9C', status: 'PENDING',   productTitle: 'AI 영상 편집 - Runway Gen-3 실전 노하우', sellerName: 'studioPK', paymentMethod: 'SQUARE', paymentAmount: 3500, createdAt: '2026-05-16T14:00:00Z', autoConfirmAt: '2026-05-19T14:00:00Z', hasReview: false },
        { id: '7E10AB', status: 'CONFIRMED', productTitle: 'ChatGPT 회의록 워크플로우 8단계',         sellerName: 'kim.work', paymentMethod: 'SQUARE', paymentAmount: 2200, createdAt: '2026-05-10T11:30:00Z', autoConfirmAt: null,                  hasReview: false },
        { id: '4D29B1', status: 'CONFIRMED', productTitle: '카피라이팅 프롬프트 50종',                  sellerName: 'soyeon.k', paymentMethod: 'SQUARE', paymentAmount: 5500, createdAt: '2026-05-04T09:00:00Z', autoConfirmAt: null,                  hasReview: true  },
      ],
      sales: [
        { id: 'B11D02', status: 'CONFIRMED', productTitle: '코드 리뷰 자동화 - Cursor + Claude',      buyerName: 'devmate', paymentMethod: 'SQUARE', paymentAmount: 5500, createdAt: '2026-05-15T18:00:00Z' },
        { id: 'C5520F', status: 'PENDING',   productTitle: 'SEO 자동화 워크시트',                       buyerName: 'mkt.lab',  paymentMethod: 'SQUARE', paymentAmount: 4800, createdAt: '2026-05-17T13:00:00Z' },
      ],
      wishlist: [
        { id: 'p-w1', title: 'AI 썸네일 자동 생성 시트',  priceSquare: 2800, sellerName: 'youtuber.jin' },
        { id: 'p-w2', title: '브랜드 톤앤매너 학습 시트', priceSquare: 1500, sellerName: 'brand.kim' },
      ],
      cart: [
        { id: 'p-c1', title: '키워드 분석 자동화 시트',   priceSquare: 3200, sellerName: 'mkt.lab' },
      ],
      products: [
        { id: 'p001', title: 'GPT-5 SNS 광고 카피 프롬프트 50종 + 톤앤매너 학습 시트', fileType: 'PDF', priceSquare: 5500, rating: 4.9, reviewCount: 270, sellerUsername: 'soyeon.k', sellerName: '소연 카피', cover: 'cover-01.svg', tags: ['prompt','gpt-5','marketing'], badge: 'HOT',  category: 'marketer', createdAt: '2026-05-17' },
        { id: 'p002', title: '주간 마케팅 리포트 자동 생성 GPT-5 프롬프트 패키지',     fileType: 'PDF', priceSquare: 3200, rating: 4.8, reviewCount: 129, sellerUsername: 'mkt.lab',  sellerName: '마케팅랩', cover: 'cover-02.svg', tags: ['report','automation'], badge: null,         category: 'marketer', createdAt: '2026-05-15' },
        { id: 'p003', title: '네이버·구글 키워드 분석 자동화 시트 + Claude 프롬프트',    fileType: 'PDF', priceSquare: 2800, rating: 4.9, reviewCount: 2976, sellerUsername: 'seo.master', sellerName: 'SEO 마스터', cover: 'cover-03.svg', tags: ['seo','claude','keyword'], badge: 'HOT', category: 'marketer', createdAt: '2026-05-14' },
        { id: 'p004', title: '블로그 SEO 자동화 워크시트 · 월 100건 검색 상위 노출',     fileType: 'ZIP', priceSquare: 10000, rating: 4.9, reviewCount: 135, sellerUsername: 'a-plan',   sellerName: 'A플랜', cover: 'cover-04.svg', tags: ['seo','blog'], badge: null, category: 'marketer', createdAt: '2026-05-11' },
        { id: 'p005', title: '유튜브 후킹 스크립트 GPT 프롬프트 · 평균 시청 지속률 +18%', fileType: 'MP4', priceSquare: 1500, rating: 5.0, reviewCount: 133, sellerUsername: 'youtuber.jin', sellerName: '유튜버진', cover: 'cover-05.svg', tags: ['youtube','script'], badge: 'NEW', category: 'creator', createdAt: '2026-05-18' },
        { id: 'p006', title: 'Midjourney v7 + DALL·E 3 썸네일 자동 생성 프롬프트 100선',  fileType: 'PNG', priceSquare: 10000, rating: 4.9, reviewCount: 3255, sellerUsername: 'thumbnail.master', sellerName: '썸네일마스터', cover: 'cover-06.svg', tags: ['midjourney','thumbnail'], badge: 'HOT', category: 'creator', createdAt: '2026-05-16' },
        { id: 'p007', title: '릴스·쇼츠 자막 자동 생성 + 감정 분석 GPT 시트',           fileType: 'MP4', priceSquare: 3400, rating: 4.9, reviewCount: 688, sellerUsername: 'shorts.kim', sellerName: '쇼츠킴', cover: 'cover-07.svg', tags: ['reels','caption'], badge: null, category: 'creator', createdAt: '2026-05-12' },
        { id: 'p008', title: '인스타·X 일주일치 콘텐츠 큐레이션 GPT 자동화',            fileType: 'PDF', priceSquare: 500,  rating: 4.9, reviewCount: 96,  sellerUsername: 'sns.lab',   sellerName: 'SNS랩', cover: 'cover-08.svg', tags: ['sns'], badge: null, category: 'creator', createdAt: '2026-05-09' },
        { id: 'p009', title: 'Cursor + Claude 코드 리뷰 자동화 · 컨벤션 100% 일치',      fileType: 'PDF', priceSquare: 2500, rating: 4.9, reviewCount: 553, sellerUsername: 'devmate', sellerName: '데브메이트', cover: 'cover-09.svg', tags: ['cursor','claude','review'], badge: 'HOT', category: 'dev', createdAt: '2026-05-13' },
        { id: 'p010', title: 'NestJS · FastAPI API 문서 자동 생성 GPT 프롬프트 세트',    fileType: 'PDF', priceSquare: 39900, rating: 5.0, reviewCount: 457, sellerUsername: 'docgen', sellerName: '독젠', cover: 'cover-10.svg', tags: ['api','docs'], badge: null, category: 'dev', createdAt: '2026-05-08' },
        { id: 'p011', title: 'Jest · Vitest 단위 테스트 자동 생성 Claude 프롬프트',       fileType: 'ZIP', priceSquare: 50000, rating: 5.0, reviewCount: 1,   sellerUsername: 'chairteam', sellerName: '체어팀', cover: 'cover-11.svg', tags: ['test','claude'], badge: 'NEW', category: 'dev', createdAt: '2026-05-19' },
        { id: 'p012', title: '에러 로그 분석 → 픽스 제안 GPT 프롬프트 · 디버깅 단축',     fileType: 'PDF', priceSquare: 1600, rating: 4.9, reviewCount: 40,  sellerUsername: 'debug.helper', sellerName: '디버그헬퍼', cover: 'cover-12.svg', tags: ['debug','log'], badge: null, category: 'dev', createdAt: '2026-05-07' },
      ],
      sellers: [
        { username: 'thumbnail.master', name: '썸네일마스터',  sold: 3255, rating: 4.9, tokenPct: 92, reviewCount: 1240, intro: 'Midjourney·DALL·E 썸네일 전문' },
        { username: 'seo.master',       name: 'SEO 마스터',    sold: 2976, rating: 4.9, tokenPct: 88, reviewCount: 980,  intro: '네이버·구글 SEO 자동화' },
        { username: 'shorts.kim',       name: '쇼츠킴',         sold: 688,  rating: 4.9, tokenPct: 81, reviewCount: 412,  intro: '릴스·쇼츠 캡션 자동화' },
        { username: 'devmate',          name: '데브메이트',     sold: 553,  rating: 4.9, tokenPct: 84, reviewCount: 340,  intro: 'Cursor + Claude 워크플로' },
        { username: 'docgen',           name: '독젠',           sold: 457,  rating: 5.0, tokenPct: 79, reviewCount: 220,  intro: 'API 문서 자동 생성' },
        { username: 'soyeon.k',         name: '소연 카피',       sold: 270,  rating: 4.9, tokenPct: 76, reviewCount: 188,  intro: 'GPT-5 카피라이팅' },
        { username: 'mkt.lab',          name: '마케팅랩',        sold: 129,  rating: 4.8, tokenPct: 65, reviewCount: 92,   intro: '주간 리포트 자동화' },
        { username: 'a-plan',           name: 'A플랜',           sold: 135,  rating: 4.9, tokenPct: 71, reviewCount: 88,   intro: '블로그 SEO 워크시트' },
      ],
    };
    saveStore(s);
    return s;
  }
  const store = loadStore();

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
  async function mock(payload) { await sleep(200 + Math.random() * 200); return payload; }

  // ── HTTP helper (live mode) ────────────────────────────────────────
  async function http(method, path, body, opts = {}) {
    const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
    const jwt = getJwt();
    if (jwt) headers['Authorization'] = 'Bearer ' + jwt;
    const init = { method, headers };
    if (body !== undefined) init.body = JSON.stringify(body);
    const res = await fetch(API_BASE + path, init);
    const text = await res.text();
    let data; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!res.ok) {
      const msg = (data && (data.message || (Array.isArray(data.message) ? data.message.join(', ') : ''))) || 'API error';
      throw Object.assign(new Error(Array.isArray(msg) ? msg.join(', ') : msg), { status: res.status, data });
    }
    return data;
  }

  function dispatch(liveFn, mockFn) {
    return (...args) => (MODE === 'live' ? liveFn(...args) : mockFn(...args));
  }

  // ── Auth ──────────────────────────────────────────────────────────
  // After live register/login, BE returns { accessToken, user }. Persist
  // both: JWT goes to localStorage (used by http()'s Authorization header),
  // and user goes to mock store so isLoggedIn()/getCurrentUser() keep working.
  async function persistAuth(resp) {
    if (resp && resp.accessToken) setJwt(resp.accessToken);
    if (resp && resp.user) {
      store.user = { ...resp.user, passVerified: !!resp.user.phoneVerified };
      saveStore(store);
    }
    return resp;
  }

  const auth = {
    register: dispatch(
      async (data) => persistAuth(await http('POST', '/auth/register', data)),
      async (data) => {
        store.user = { id: 'u-' + Date.now(), ...data, passVerified: false };
        delete store.user.password;
        saveStore(store);
        return mock({ user: store.user });
      }
    ),
    login: dispatch(
      async (data) => persistAuth(await http('POST', '/auth/login', data)),
      async ({ username }) => {
        store.user = store.user || { id: 'u-demo', username, name: '데모 유저', nickname: 'demo', email: username + '@aisquare.com', passVerified: false };
        store.user.username = username;
        saveStore(store);
        return mock({ user: store.user });
      }
    ),
    logout: dispatch(
      async () => { setJwt(null); store.user = null; saveStore(store); return { ok: true }; },
      async () => { store.user = null; saveStore(store); return mock({ ok: true }); }
    ),
    // Live BE has no /pass/init — return a dummy sessionId so the existing
    // 2-step UI flow still works. The real work happens in passVerify which
    // POSTs to BE /auth/verify-phone (server-side SKIP_PASS_VERIFICATION
    // flips phoneVerified=true without iamport).
    passInit:   dispatch(async ()           => ({ sessionId: 'dev-' + Date.now() }),
                         async () => mock({ sessionId: 'mock-' + Date.now() })),
    passVerify: dispatch(async (code, sid)  => {
      const updated = await http('POST', '/auth/verify-phone', { impUid: code || sid || 'dev-imp' });
      if (updated) {
        store.user = { ...(store.user || {}), ...updated, passVerified: !!updated.phoneVerified };
        saveStore(store);
      }
      return { ok: true };
    }, async () => {
      if (store.user) { store.user.passVerified = true; store.user.passName = store.user.name || '홍길동'; store.user.passVerifiedAt = new Date().toISOString(); saveStore(store); }
      return mock({ ok: true });
    }),
    impConfig: dispatch(
      () => http('GET', '/auth/imp-config'),
      async () => mock({ impCode: 'imp22275820' }),
    ),
  };

  // ── User ──────────────────────────────────────────────────────────
  // BE has GET /auth/profile (full me) + PATCH /auth/me/bio (bio only).
  // Map updateProfile here to the bio patch when `bio` is provided; for
  // other fields we keep the mock localStorage write so the UI behaves.
  const user = {
    getMe: dispatch(
      async () => {
        const me = await http('GET', '/auth/profile');
        if (me) {
          store.user = { ...(store.user || {}), ...me, passVerified: !!me.phoneVerified };
          saveStore(store);
        }
        return store.user;
      },
      async () => mock(store.user),
    ),
    updateProfile: dispatch(
      async (data) => {
        if (data && typeof data.bio !== 'undefined') {
          const updated = await http('PATCH', '/auth/me/bio', { bio: data.bio });
          store.user = { ...(store.user || {}), ...updated };
          saveStore(store);
        } else if (store.user) {
          // BE has no general profile patch — apply locally
          Object.assign(store.user, data); saveStore(store);
        }
        return store.user;
      },
      async (data) => {
        if (store.user) { Object.assign(store.user, data); saveStore(store); }
        return mock(store.user);
      },
    ),
  };

  // ── Wallets ───────────────────────────────────────────────────────
  // BE doesn't expose a square balance endpoint, but it has `/wallet/charges`
  // (list of square top-ups). Sum up CONFIRMED ones to derive balance.
  // Point: BE has `/points/balance` and `/points/history` directly.
  async function safeLive(fn, fallback) {
    try { return await fn(); } catch (e) { console.warn('[AISquareAPI] live fallback:', e.message); return fallback; }
  }

  const square = {
    getBalance: dispatch(
      async () => {
        const charges = await safeLive(() => http('GET', '/wallet/charges'), []);
        const total = (Array.isArray(charges) ? charges : []).filter(c => c.status === 'CONFIRMED').reduce((s, c) => s + (c.squareAmount || 0), 0);
        return { balance: total };
      },
      async () => mock({ balance: store.square.balance }),
    ),
    getHistory: dispatch(
      async () => {
        const charges = await safeLive(() => http('GET', '/wallet/charges'), []);
        return { items: (Array.isArray(charges) ? charges : []).map(c => ({ id: c.id, type: 'CHARGE', amount: c.squareAmount, description: 'Square 충전', createdAt: c.createdAt })) };
      },
      async () => mock({ items: store.squareHistory }),
    ),
    charge: dispatch(
      (amount) => http('POST', '/wallet/charge', { squareAmount: amount }),
      async (amount) => {
        store.square.balance += amount;
        store.squareHistory.unshift({ id: 'sq-' + Date.now(), type: 'CHARGE', amount, description: 'Square 충전', createdAt: new Date().toISOString() });
        const pt = Math.floor(amount * 0.001);
        if (pt > 0) {
          store.point.balance += pt;
          store.pointHistory.unshift({ id: 'p-' + Date.now(), type: 'CHARGE_REWARD', amount: pt, description: 'Square 충전 적립 (0.1%)', createdAt: new Date().toISOString() });
        }
        saveStore(store);
        return mock({ balance: store.square.balance });
      }
    ),
  };
  const point = {
    getBalance: dispatch(
      () => safeLive(() => http('GET', '/points/balance'), { balance: 0 }),
      async () => mock({ balance: store.point.balance }),
    ),
    getHistory: dispatch(
      async (params) => {
        const list = await safeLive(() => http('GET', '/points/history' + qs(params)), []);
        return { items: Array.isArray(list) ? list : [] };
      },
      async () => mock({ items: store.pointHistory }),
    ),
  };

  // ── Orders ────────────────────────────────────────────────────────
  // BE: /orders/my/purchases returns Order[] with .product nested. The mypage
  // UI expects flat objects with productTitle/sellerName/etc → adapt shape.
  function adaptOrders(rows) {
    return (rows || []).map(o => ({
      id: o.id,
      status: o.status === 'PENDING_CONFIRMATION' ? 'PENDING' : (o.status || 'PENDING'),
      productTitle: o.product?.title || o.productTitle || '',
      productId: o.productId,
      sellerName: o.product?.seller?.name || o.product?.seller?.username || o.sellerName || '',
      paymentMethod: o.paymentMethod,
      paymentAmount: o.paymentAmount,
      createdAt: o.createdAt,
      autoConfirmAt: o.autoConfirmAt,
      hasReview: !!o.review,
    }));
  }
  const orders = {
    getList:     dispatch(async ()         => adaptOrders(await http('GET',   '/orders/my/purchases')),
                          async () => mock(store.orders)),
    getSales:    dispatch(async ()         => adaptOrders(await http('GET',   '/orders/my/sales')),
                          async () => mock(store.sales || [])),
    create:      dispatch((pid, m)         => http('POST', '/orders', { productId: pid, paymentMethod: m }), async () => mock({ id: 'O' + Date.now() })),
    confirm:     dispatch((id)             => http('PATCH', `/orders/${id}/confirm`),
                          async (id) => { const o = store.orders.find(x => x.id === id); if (o) o.status = 'CONFIRMED'; saveStore(store); return mock({ ok: true }); }),
    getDownloadUrl: dispatch((id)          => http('GET',   `/orders/${id}/download`),
                             async () => mock({ url: '#mock-download' })),
  };

  // ── Admin ──────────────────────────────────────────────────────────
  const admin = {
    getReports:       dispatch((status)        => http('GET',  '/admin/reports' + qs(status ? { status } : null)),  async () => mock([])),
    getReport:        dispatch((id)            => http('GET',  `/admin/reports/${id}`),                              async () => mock(null)),
    processReport:    dispatch((id, action)    => http('PATCH', `/admin/reports/${id}/process`, { action }),         async () => mock({ ok: true })),
    toggleVisibility: dispatch((id, isVisible) => http('PATCH', `/admin/products/${id}/visibility`, { isVisible }),  async () => mock({ ok: true })),
    settlementStats:  dispatch(()              => http('GET',  '/admin/settlement/stats'),                            async () => mock({})),
    getAllProducts:   dispatch((params)        => http('GET',  '/admin/products' + qs(params)),                       async () => mock({ items: [], total: 0 })),
    getLogs:          dispatch((params)        => http('GET',  '/admin/logs' + qs(params)),                           async () => mock({ items: [], total: 0 })),
    // 사용자 관리
    getUsers:         dispatch((params)        => http('GET',  '/admin/users' + qs(params)),                          async () => mock({ items: [], total: 0 })),
    updateUserStatus: dispatch((id, status)    => http('PATCH', `/admin/users/${id}/status`, { status }),              async () => mock({ ok: true })),
    adjustTrustToken: dispatch((id, value, reason) => http('PATCH', `/admin/users/${id}/trust-token`, { value, reason }), async () => mock({ ok: true })),
    // NaverPay 전환 처리
    getNaverExchanges: dispatch((status)       => http('GET',  '/admin/naver-exchanges' + qs(status ? { status } : null)), async () => mock([])),
    processNaverExchange: dispatch((id, body)  => http('PATCH', `/admin/naver-exchanges/${id}/process`, body),         async () => mock({ ok: true })),
    // 강제 환불
    forceRefund:      dispatch((id, reason)    => http('PATCH', `/admin/orders/${id}/force-refund`, { reason }),       async () => mock({ ok: true })),
  };

  // ── Reviews ────────────────────────────────────────────────────────
  const reviews = {
    forProduct: dispatch((pid)              => http('GET',  `/reviews/product/${pid}`),
                         async () => mock([])),
    create:     dispatch((orderId, payload) => http('POST', `/reviews/order/${orderId}`, payload),
                         async () => mock({ ok: true })),
    update:     dispatch((id, payload)      => http('PATCH', `/reviews/${id}`, payload), async () => mock({ ok: true })),
    remove:     dispatch((id)               => http('DELETE',`/reviews/${id}`),         async () => mock({ ok: true })),
  };

  // ── Wishlist / Cart ───────────────────────────────────────────────
  // BE returns Wishlist/CartItem records with nested .product. Flatten to a
  // product-shaped array so the existing mypage UI ({title, priceSquare,...})
  // keeps rendering without changes.
  function flattenJoined(rows) {
    return (rows || []).map(r => {
      var p = r.product || r;
      return {
        id: p.id,
        title: p.title,
        cover: (p.imageKey || '').replace(/^assets\//, '') || p.cover || 'cover-01.svg',
        priceSquare: p.priceSquare ?? p.price ?? 0,
        sellerName: p.sellerName || (p.seller && p.seller.name) || (p.seller && p.seller.username) || '',
        rating: p.rating || 0,
        reviewCount: p.reviewCount || 0,
        fileType: p.fileType || 'PDF',
      };
    });
  }

  const wishlist = {
    getList: dispatch(async ()    => flattenJoined(await http('GET',    '/wishlist')),                     async () => mock(store.wishlist)),
    add:     dispatch((pid)       => http('POST',   `/wishlist/${pid}`),                                   async (pid) => {
      store.wishlist = store.wishlist || [];
      var prod = store.products.find(p => p.id === pid);
      if (prod && !store.wishlist.some(p => p.id === pid)) store.wishlist.unshift(prod);
      saveStore(store);
      return mock({ ok: true });
    }),
    remove:  dispatch((pid)       => http('DELETE', `/wishlist/${pid}`),                                   async (pid) => { store.wishlist = (store.wishlist || []).filter(p => p.id !== pid); saveStore(store); return mock({ ok: true }); }),
  };
  const cart = {
    getList: dispatch(async ()    => flattenJoined(await http('GET',    '/cart')),                         async () => mock(store.cart)),
    add:     dispatch((pid)       => http('POST',   `/cart/${pid}`),                                       async (pid) => {
      store.cart = store.cart || [];
      var prod = store.products.find(p => p.id === pid);
      if (prod && !store.cart.some(p => p.id === pid)) store.cart.unshift(prod);
      saveStore(store);
      return mock({ ok: true });
    }),
    remove:  dispatch((pid)       => http('DELETE', `/cart/${pid}`),                                       async (pid) => { store.cart = (store.cart || []).filter(p => p.id !== pid); saveStore(store); return mock({ ok: true }); }),
  };

  function qs(params) {
    if (!params) return '';
    const u = new URLSearchParams(params).toString();
    return u ? '?' + u : '';
  }

  // ── Products / Sellers (catalog) ───────────────────────────────────
  // BE returns { id, title, price, imageKey, fileType, tags(string), seller:{username,name}, avgRating, reviewCount, ... }
  // Frontend (product.html, market cards, etc.) expects { cover, priceSquare, sellerName, sellerUsername, rating, tags(array), category, badge }.
  // Normalize so any caller can read either shape.
  function adaptProduct(p) {
    if (!p) return p;
    let tags = p.tags;
    if (typeof tags === 'string') { try { tags = JSON.parse(tags); } catch { tags = tags.split(','); } }
    return {
      ...p,
      cover: p.cover || (p.imageKey || '').replace(/^assets\//, '') || 'cover-01.svg',
      priceSquare: p.priceSquare ?? p.price ?? 0,
      rating: p.rating ?? p.avgRating ?? 0,
      reviewCount: p.reviewCount ?? 0,
      sellerName: p.sellerName || (p.seller && (p.seller.name || p.seller.username)) || '',
      sellerUsername: p.sellerUsername || (p.seller && p.seller.username) || '',
      tags: Array.isArray(tags) ? tags : [],
      category: p.category || (Array.isArray(tags) ? tags[0] : '') || '',
      badge: p.badge || (p.status === 'SOLD' ? 'SOLD' : null),
    };
  }

  const products = {
    list: dispatch(
      async (params) => {
        const res = await http('GET', '/products' + qs(params));
        const items = (res && res.items) ? res.items : (Array.isArray(res) ? res : []);
        return { items: items.map(adaptProduct), total: res?.total ?? items.length };
      },
      async (params) => {
        let list = [...store.products];
        if (params?.fileType && params.fileType !== 'ALL') list = list.filter(p => p.fileType === params.fileType);
        if (params?.q) {
          const q = params.q.toLowerCase();
          list = list.filter(p =>
            p.title.toLowerCase().includes(q) ||
            (p.tags || []).some(t => t.toLowerCase().includes(q)) ||
            p.sellerName.toLowerCase().includes(q)
          );
        }
        const sort = params?.sort || 'latest';
        if (sort === 'rating')  list.sort((a, b) => b.rating - a.rating);
        if (sort === 'reviews') list.sort((a, b) => b.reviewCount - a.reviewCount);
        if (sort === 'price-asc')  list.sort((a, b) => a.priceSquare - b.priceSquare);
        if (sort === 'price-desc') list.sort((a, b) => b.priceSquare - a.priceSquare);
        if (sort === 'latest')  list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        return mock({ items: list, total: list.length });
      }
    ),
    get: dispatch(
      async (id) => adaptProduct(await http('GET', `/products/${id}`)),
      async (id) => mock(store.products.find(p => p.id === id)),
    ),
    // POST /products with multipart/form-data. The `formData` arg is a FormData
    // instance built by sell.html (title/description/price/tags + file + image).
    create: dispatch(
      async (formData) => {
        const headers = {};
        const jwt = getJwt(); if (jwt) headers['Authorization'] = 'Bearer ' + jwt;
        const res = await fetch(API_BASE + '/products', { method: 'POST', headers, body: formData });
        const text = await res.text();
        let data; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
        if (!res.ok) throw Object.assign(new Error(data?.message || 'API error'), { status: res.status, data });
        return data;
      },
      async () => mock({ id: 'P' + Date.now() }),
    ),
    sellerStats: dispatch(
      (username) => http('GET', `/products/seller/${username}/stats`),
      async () => mock({ username: 'mock', name: 'mock', totalSold: 0, avgRating: 0, reviewCount: 0 }),
    ),
  };
  const sellers = {
    list:    dispatch((params) => http('GET', '/sellers' + qs(params)), async () => mock({ items: store.sellers })),
    get:     dispatch((un)     => http('GET', `/sellers/${un}`),         async (un) => mock(store.sellers.find(s => s.username === un))),
  };

  // ── Toss Payments ─────────────────────────────────────────────────
  // BE → /payments/toss/*
  const payments = {
    tossConfig:           dispatch(()                 => http('GET',  '/payments/toss/config'),
                                   async () => mock({ clientKey: 'mock_test_client_key' })),
    requestProductPay:    dispatch((productId)        => http('POST', '/payments/toss/product/request', { productId }),
                                   async (productId) => mock({ tossOrderId: 'mock-order-' + Date.now(), amountKrw: 5500, orderName: 'mock 결제' })),
    confirmProductPay:    dispatch((paymentKey, orderId, amount) => http('POST', '/payments/toss/product/confirm', { paymentKey, orderId, amount }),
                                   async () => mock({ ok: true })),
    requestRpCharge:      dispatch((amount)           => http('POST', '/payments/toss/charge/request', { amount }),
                                   async (amount) => mock({ tossOrderId: 'mock-rp-' + Date.now(), amountKrw: amount * 11, rpAmount: amount, orderName: `RP 충전 ${amount}` })),
    confirmRpCharge:      dispatch((paymentKey, orderId, amount) => http('POST', '/payments/toss/charge/confirm', { paymentKey, orderId, amount }),
                                   async () => mock({ ok: true })),
  };

  // ── Public API ────────────────────────────────────────────────────
  window.AISquareAPI = {
    MODE, API_BASE,
    auth, user, square, point, orders, wishlist, cart, products, sellers, payments, reviews, admin,
    // Persisted session helpers
    getCurrentUser() { return store.user; },
    setCurrentUser(u) { store.user = u; saveStore(store); },
    isLoggedIn() { return !!store.user; },
    getJwt, setJwt,
  };
})();
