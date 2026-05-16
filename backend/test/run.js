/**
 * AI Square - 전체 API 테스트
 * 실행: node test/run.js
 *
 * 상품/주문은 Prisma로 직접 DB 삽입 → 나머지 비즈니스 로직은 HTTP로 검증
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:3000';

// 토큰/ID 저장
let adminToken, sellerToken, buyerToken;
let sellerId, buyerId;
let product1Id, product2Id, product3Id;
let order1Id, order2Id, order3Id;
let review1Id;
let reportId;

// ── 출력 헬퍼 ─────────────────────────────────────────
const green  = (s) => `\x1b[32m${s}\x1b[0m`;
const red    = (s) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const cyan   = (s) => `\x1b[36m${s}\x1b[0m`;
const bold   = (s) => `\x1b[1m${s}\x1b[0m`;

let passed = 0, failed = 0;

function section(name) {
  console.log(`\n${bold(cyan('━'.repeat(52)))}`);
  console.log(bold(cyan(`  ${name}`)));
  console.log(bold(cyan('━'.repeat(52))));
}

function check(label, condition, detail = '') {
  if (condition) {
    console.log(`  ${green('✓')} ${label}`);
    passed++;
  } else {
    console.log(`  ${red('✗')} ${label}${detail ? `  (${red(String(detail))})` : ''}`);
    failed++;
  }
}

async function api(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data;
  try { data = await res.json(); } catch { data = {}; }
  return { status: res.status, data };
}

// ── 0. 테스트 데이터 초기화 ─────────────────────────
async function cleanup() {
  section('초기화 (이전 테스트 데이터 삭제)');
  const usernames = ['admin_t', 'seller_t', 'buyer_t'];
  const users = await prisma.user.findMany({ where: { username: { in: usernames } } });
  const ids = users.map(u => u.id);

  if (ids.length > 0) {
    await prisma.tokenLog.deleteMany({ where: { userId: { in: ids } } });
    await prisma.pointLog.deleteMany({ where: { userId: { in: ids } } });
    await prisma.verificationLog.deleteMany({ where: { userId: { in: ids } } });
    await prisma.wishlist.deleteMany({ where: { userId: { in: ids } } });
    await prisma.cartItem.deleteMany({ where: { userId: { in: ids } } });

    const orders = await prisma.order.findMany({ where: { buyerId: { in: ids } } });
    const orderIds = orders.map(o => o.id);
    if (orderIds.length > 0) {
      await prisma.report.deleteMany({ where: { orderId: { in: orderIds } } });
      await prisma.review.deleteMany({ where: { orderId: { in: orderIds } } });
      await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    }

    const products = await prisma.product.findMany({ where: { sellerId: { in: ids } } });
    const productIds = products.map(p => p.id);
    if (productIds.length > 0) {
      await prisma.wishlist.deleteMany({ where: { productId: { in: productIds } } });
      await prisma.cartItem.deleteMany({ where: { productId: { in: productIds } } });
      await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    }

    await prisma.adminLog.deleteMany({ where: { adminId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
  check('이전 테스트 데이터 삭제', true);
}

// ── 1. 인증 ────────────────────────────────────────────
async function testAuth() {
  section('AUTH - 회원가입 / 로그인');

  let r = await api('POST', '/auth/register', {
    username: 'admin_t', password: 'Admin1234!', name: '관리자',
    nickname: '어드민T', email: 'admin_t@test.com', phone: '01000000001',
  });
  check('관리자 회원가입', !!r.data.accessToken, r.data.message);
  adminToken = r.data.accessToken;

  r = await api('POST', '/auth/register', {
    username: 'seller_t', password: 'Seller1234!', name: '판매자',
    nickname: '판매왕T', email: 'seller_t@test.com', phone: '01011111112',
  });
  check('판매자 회원가입', !!r.data.accessToken, r.data.message);
  sellerToken = r.data.accessToken;
  sellerId = r.data.user?.id;

  r = await api('POST', '/auth/register', {
    username: 'buyer_t', password: 'Buyer1234!', name: '구매자',
    nickname: '구매왕T', email: 'buyer_t@test.com', phone: '01022222223',
  });
  check('구매자 회원가입', !!r.data.accessToken, r.data.message);
  buyerToken = r.data.accessToken;
  buyerId = r.data.user?.id;

  // ID 보정 + 관리자 강제 설정 (ADMIN_USERNAMES 환경변수 우회)
  const admin  = await prisma.user.findUnique({ where: { username: 'admin_t' } });
  const seller = await prisma.user.findUnique({ where: { username: 'seller_t' } });
  const buyer  = await prisma.user.findUnique({ where: { username: 'buyer_t'  } });
  await prisma.user.update({ where: { id: admin.id }, data: { isAdmin: true } });
  sellerId = seller.id;
  buyerId  = buyer.id;

  // 닉네임 중복
  r = await api('POST', '/auth/register', {
    username: 'dup_t', password: 'Dup12345!', name: '중복',
    nickname: '판매왕T', email: 'dup_t@test.com', phone: '01099999999',
  });
  check('닉네임 중복 거부 (409)', r.status === 409, r.data.message);

  // 로그인
  r = await api('POST', '/auth/login', { username: 'seller_t', password: 'Seller1234!' });
  check('로그인 성공', !!r.data.accessToken);
  sellerToken = r.data.accessToken;

  r = await api('POST', '/auth/login', { username: 'buyer_t', password: 'Buyer1234!' });
  buyerToken = r.data.accessToken;

  r = await api('POST', '/auth/login', { username: 'admin_t', password: 'Admin1234!' });
  adminToken = r.data.accessToken;

  // 잘못된 비밀번호
  r = await api('POST', '/auth/login', { username: 'seller_t', password: 'wrong' });
  check('잘못된 비밀번호 (401)', r.status === 401);

  // 프로필
  r = await api('GET', '/auth/profile', null, sellerToken);
  check('프로필 조회', r.data.username === 'seller_t');

  // 핸드폰 인증
  r = await api('POST', '/auth/verify-phone', null, sellerToken);
  check('판매자 핸드폰 인증', r.data.phoneVerified === true);

  r = await api('POST', '/auth/verify-phone', null, buyerToken);
  check('구매자 핸드폰 인증', r.data.phoneVerified === true);
}

// ── 2. 상품/주문 DB 직접 삽입 ──────────────────────────
async function seedProductsAndOrders() {
  section('DB SEED - 상품 3개 / 주문 3개 직접 삽입');

  const autoConfirmAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

  // 상품 3개
  const p1 = await prisma.product.create({
    data: {
      sellerId, title: '테스트 상품 1 (5점 리뷰용)',
      description: '설명1', fileKey: 'test/dummy1.pdf',
      fileType: 'PDF', priceEth: 0.001, tags: ['AI', '테스트'],
    },
  });
  product1Id = p1.id;

  const p2 = await prisma.product.create({
    data: {
      sellerId, title: '테스트 상품 2 (저평점 리뷰용)',
      description: '설명2', fileKey: 'test/dummy2.pdf',
      fileType: 'PDF', priceEth: 0.002, tags: ['AI'],
    },
  });
  product2Id = p2.id;

  const p3 = await prisma.product.create({
    data: {
      sellerId, title: '테스트 상품 3 (신고용)',
      description: '설명3', fileKey: 'test/dummy3.pdf',
      fileType: 'PDF', priceEth: 0.003, tags: ['테스트'],
    },
  });
  product3Id = p3.id;

  check('상품 3개 생성', !!product1Id && !!product2Id && !!product3Id);

  // 주문 3개 (상품 상태 SOLD로 변경)
  const o1 = await prisma.order.create({
    data: {
      buyerId, productId: product1Id,
      paymentMethod: 'ETH', amountEth: 0.001,
      status: 'PENDING_CONFIRMATION', autoConfirmAt,
    },
  });
  order1Id = o1.id;
  await prisma.product.update({ where: { id: product1Id }, data: { status: 'SOLD' } });

  const o2 = await prisma.order.create({
    data: {
      buyerId, productId: product2Id,
      paymentMethod: 'ETH', amountEth: 0.002,
      status: 'PENDING_CONFIRMATION', autoConfirmAt,
    },
  });
  order2Id = o2.id;
  await prisma.product.update({ where: { id: product2Id }, data: { status: 'SOLD' } });

  const o3 = await prisma.order.create({
    data: {
      buyerId, productId: product3Id,
      paymentMethod: 'ETH', amountEth: 0.003,
      status: 'PENDING_CONFIRMATION', autoConfirmAt,
    },
  });
  order3Id = o3.id;
  await prisma.product.update({ where: { id: product3Id }, data: { status: 'SOLD' } });

  check('주문 3개 생성', !!order1Id && !!order2Id && !!order3Id);
}

// ── 3. 상품 조회 ──────────────────────────────────────
async function testProducts() {
  section('PRODUCTS - 조회');

  let r = await api('GET', '/products');
  check('상품 목록 (비회원)', r.status === 200 && Array.isArray(r.data.items));

  r = await api('GET', `/products/${product1Id}`);
  check('상품 상세 조회', r.data.id === product1Id);

  const before = r.data.viewCount;
  r = await api('GET', `/products/${product1Id}`);
  check('조회수 자동 증가', r.data.viewCount === before + 1, `${before} → ${r.data.viewCount}`);

  r = await api('GET', '/products/seller/seller_t/stats');
  check('판매자 통계 조회', r.status === 200);
}

// ── 4. 찜 ─────────────────────────────────────────────
async function testWishlist() {
  section('WISHLIST - 찜');

  let r = await api('GET', '/wishlist', null, buyerToken);
  check('찜 목록 (빈 상태)', r.status === 200 && r.data.length === 0);

  r = await api('POST', `/wishlist/${product1Id}`, null, buyerToken);
  check('찜 추가', r.status === 201 || r.status === 200);

  r = await api('POST', `/wishlist/${product1Id}`, null, buyerToken);
  check('찜 중복 추가 거부 (409)', r.status === 409);

  r = await api('GET', '/wishlist', null, buyerToken);
  check('찜 목록 1개', r.data.length === 1);

  r = await api('DELETE', `/wishlist/${product1Id}`, null, buyerToken);
  check('찜 제거', r.status === 200);

  r = await api('GET', '/wishlist', null, buyerToken);
  check('찜 목록 다시 빈 상태', r.data.length === 0);

  r = await api('GET', '/wishlist');
  check('비인증 접근 (401)', r.status === 401);
}

// ── 5. 장바구니 ────────────────────────────────────────
async function testCart() {
  section('CART - 장바구니');

  let r = await api('GET', '/cart', null, buyerToken);
  check('장바구니 (빈 상태)', r.status === 200 && r.data.length === 0);

  // 이미 SOLD된 상품은 담기 불가
  r = await api('POST', `/cart/${product1Id}`, null, buyerToken);
  check('판매완료 상품 장바구니 불가 (404)', r.status === 404, r.data.message);

  // ON_SALE 상품 담기 (product3는 SOLD이므로 새로 하나 만들어 테스트)
  const tempProduct = await prisma.product.create({
    data: {
      sellerId, title: '장바구니 테스트용',
      description: '임시', fileKey: 'test/temp.pdf',
      fileType: 'PDF', priceEth: 0.001, tags: [],
    },
  });

  r = await api('POST', `/cart/${tempProduct.id}`, null, buyerToken);
  check('장바구니 담기', r.status === 201 || r.status === 200);

  r = await api('POST', `/cart/${tempProduct.id}`, null, buyerToken);
  check('장바구니 중복 담기 거부 (409)', r.status === 409);

  r = await api('GET', '/cart', null, buyerToken);
  check('장바구니 1개', r.data.length === 1);

  r = await api('DELETE', '/cart/all', null, buyerToken);
  check('장바구니 전체 비우기', r.status === 200);

  r = await api('GET', '/cart', null, buyerToken);
  check('장바구니 빈 상태', r.data.length === 0);

  await prisma.product.delete({ where: { id: tempProduct.id } });
}

// ── 6. 주문 확정 + 신뢰 토큰 ──────────────────────────
async function testOrdersAndTokens() {
  section('ORDERS & 신뢰 토큰');

  // 초기 토큰 확인 (30)
  let seller = await prisma.user.findUnique({ where: { id: sellerId } });
  check(`판매자 초기 신뢰 토큰 (30)`, seller.trustToken === 30, seller.trustToken);

  // 내 구매/판매 목록
  let r = await api('GET', '/orders/my/purchases', null, buyerToken);
  check('내 구매 목록', r.status === 200 && r.data.length === 3);

  r = await api('GET', '/orders/my/sales', null, sellerToken);
  check('내 판매 목록', r.status === 200 && r.data.length === 3);

  // 주문1 확정 (구매자) → 판매자 토큰 +2
  r = await api('PATCH', `/orders/${order1Id}/confirm`, null, buyerToken);
  check('주문1 확정', r.data.status === 'CONFIRMED', r.data.message);

  seller = await prisma.user.findUnique({ where: { id: sellerId } });
  check('구매 확정 → 신뢰 토큰 +2 (32)', seller.trustToken === 32, seller.trustToken);

  // 이미 확정된 주문 재확정 불가
  r = await api('PATCH', `/orders/${order1Id}/confirm`, null, buyerToken);
  check('이미 확정된 주문 재확정 불가 (400)', r.status === 400);

  // 주문2 확정 (5점 리뷰 준비)
  r = await api('PATCH', `/orders/${order2Id}/confirm`, null, buyerToken);
  check('주문2 확정', r.data.status === 'CONFIRMED');
  seller = await prisma.user.findUnique({ where: { id: sellerId } });
  check('주문2 확정 → 신뢰 토큰 +2 (34)', seller.trustToken === 34, seller.trustToken);
}

// ── 7. 리뷰 + 신뢰 토큰 ──────────────────────────────
async function testReviews() {
  section('REVIEWS & 신뢰 토큰');

  // 5점 리뷰 (주문1) → 판매자 +1
  let r = await api('POST', `/reviews/order/${order1Id}`, { rating: 5, content: '정말 좋아요!' }, buyerToken);
  check('5점 리뷰 작성', r.data.id, r.data.message);
  review1Id = r.data.id;

  let seller = await prisma.user.findUnique({ where: { id: sellerId } });
  check('5점 리뷰 → 신뢰 토큰 +1 (35)', seller.trustToken === 35, seller.trustToken);

  // 2점 리뷰 (주문2) → 판매자 -1
  r = await api('POST', `/reviews/order/${order2Id}`, { rating: 2, content: '별로였어요' }, buyerToken);
  check('2점 리뷰 작성', r.data.id, r.data.message);

  seller = await prisma.user.findUnique({ where: { id: sellerId } });
  check('2점 리뷰 → 신뢰 토큰 -1 (34)', seller.trustToken === 34, seller.trustToken);

  // 리뷰 목록
  r = await api('GET', `/reviews/product/${product1Id}`);
  check('상품 리뷰 목록 조회', r.status === 200 && r.data.length === 1);

  // 리뷰 수정
  r = await api('PATCH', `/reviews/${review1Id}`, { rating: 4, content: '수정했어요' }, buyerToken);
  check('리뷰 수정', r.data.rating === 4);

  // 중복 리뷰 불가
  r = await api('POST', `/reviews/order/${order1Id}`, { rating: 5, content: '중복' }, buyerToken);
  check('중복 리뷰 불가 (400)', r.status === 400 || r.status === 409);
}

// ── 8. 신고 + Slack 알림 ──────────────────────────────
async function testReports() {
  section('REPORTS & Slack 알림');

  // 주문3 신고 (구매자)
  let r = await api('POST', `/reports/order/${order3Id}`, {
    reason: '사기입니다. 파일이 설명과 다릅니다.',
  }, buyerToken);
  check('신고 접수 (→ Slack 발송됨)', r.data.id, r.data.message);
  reportId = r.data.id;

  // 주문 상태가 SETTLEMENT_HOLD로 변경됐는지 확인
  const order = await prisma.order.findUnique({ where: { id: order3Id } });
  check('신고 후 주문 상태 SETTLEMENT_HOLD', order.status === 'SETTLEMENT_HOLD', order.status);

  // 중복 신고 불가
  r = await api('POST', `/reports/order/${order3Id}`, { reason: '중복신고' }, buyerToken);
  check('중복 신고 불가 (400)', r.status === 400);

  // 신고 상세 (관리자 전용 엔드포인트)
  r = await api('GET', `/admin/reports/${reportId}`, null, adminToken);
  check('신고 상세 조회 (관리자)', r.data.id === reportId, r.data.message);
}

// ── 9. 어드민 처리 + 신뢰 토큰 초기화 ─────────────────
async function testAdmin() {
  section('ADMIN - 신고 처리 & 토큰 초기화');

  let seller = await prisma.user.findUnique({ where: { id: sellerId } });
  console.log(`  신고 처리 전 판매자 토큰: ${yellow(String(seller.trustToken))}`);

  // 신고 REFUNDED 처리 → 판매자 토큰 0으로 초기화
  let r = await api('PATCH', `/admin/reports/${reportId}/process`, { action: 'REFUNDED' }, adminToken);
  check('신고 REFUNDED 처리', r.data.success === true, r.data.message);

  seller = await prisma.user.findUnique({ where: { id: sellerId } });
  check('신고 확정 → 판매자 토큰 0 초기화', seller.trustToken === 0, seller.trustToken);

  // 비관리자 접근 차단
  r = await api('GET', '/admin/reports', null, sellerToken);
  check('비관리자 admin 접근 거부 (403)', r.status === 403);

  // 상품 숨김 처리
  r = await api('PATCH', `/admin/products/${product1Id}/visibility`, { isVisible: false }, adminToken);
  check('상품 숨김 처리', r.data.isVisible === false);

  // 정산 통계
  r = await api('GET', '/admin/settlement/stats', null, adminToken);
  check('정산 통계', r.status === 200);

  // 어드민 로그
  r = await api('GET', '/admin/logs', null, adminToken);
  check('어드민 로그 조회', r.status === 200);
}

// ── 10. 토큰/포인트 내역 ──────────────────────────────
async function testHistory() {
  section('내역 조회');

  let r = await api('GET', '/auth/me/tokens', null, sellerToken);
  check('신뢰 토큰 변동 내역', r.status === 200 && Array.isArray(r.data), r.data);
  if (Array.isArray(r.data)) {
    console.log(`  → 총 ${r.data.length}건 기록`);
    r.data.slice(0, 3).forEach(log =>
      console.log(`     ${log.type}  ${log.amount > 0 ? green('+' + log.amount) : red(String(log.amount))}  잔액: ${log.balance}`)
    );
  }

  r = await api('GET', '/auth/me/points', null, sellerToken);
  check('포인트 변동 내역', r.status === 200 && Array.isArray(r.data));
}

// ── 실행 ─────────────────────────────────────────────
(async () => {
  console.log(bold('\nAI Square 전체 API 테스트\n'));

  try {
    await cleanup();
    await testAuth();
    await seedProductsAndOrders();
    await testProducts();
    await testWishlist();
    await testCart();
    await testOrdersAndTokens();
    await testReviews();
    await testReports();
    await testAdmin();
    await testHistory();
  } catch (e) {
    console.log(red(`\n예외 발생: ${e.message}`));
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }

  const total = passed + failed;
  console.log(`\n${bold('━'.repeat(52))}`);
  console.log(`결과: ${green(`${passed}개 통과`)}  ${failed > 0 ? red(`${failed}개 실패`) : green('전체 통과')}  (총 ${total}개)`);
  console.log(bold('━'.repeat(52)) + '\n');
})();
