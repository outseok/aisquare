/**
<<<<<<< HEAD
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
=======
 * Recode AI - 전체 API 자동 테스트
 * 실행: node test/run.js
 *
 * 토큰/ID 자동 저장 → 순서대로 모든 기능 테스트
 */

const BASE_URL = 'http://localhost:3000';

// 테스트용 지갑 주소
const ADMIN_WALLET  = '0x2aF0c85799cFca053FFd2326172Bd34BD0CDBe87';
const BUYER_WALLET  = '0xabcdef1234567890abcdef1234567890abcdef12';
const SELLER_WALLET = '0x1111111111111111111111111111111111111111';

// 실행 중 채워지는 값
let adminToken, buyerToken, sellerToken;
let productId, orderId, reviewId, reportId, order2Id;

// ── 출력 헬퍼 ────────────────────────────────────────────
>>>>>>> origin/JC
const green  = (s) => `\x1b[32m${s}\x1b[0m`;
const red    = (s) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const cyan   = (s) => `\x1b[36m${s}\x1b[0m`;
const bold   = (s) => `\x1b[1m${s}\x1b[0m`;

let passed = 0, failed = 0;

function section(name) {
<<<<<<< HEAD
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

  // 초기 토큰 확인 (15)
  let seller = await prisma.user.findUnique({ where: { id: sellerId } });
  check(`판매자 초기 신뢰 토큰 (15)`, seller.trustToken === 15, seller.trustToken);

  // 내 구매/판매 목록
  let r = await api('GET', '/orders/my/purchases', null, buyerToken);
  check('내 구매 목록', r.status === 200 && r.data.length === 3);

  r = await api('GET', '/orders/my/sales', null, sellerToken);
  check('내 판매 목록', r.status === 200 && r.data.length === 3);

  // 주문1 확정 (구매자) → 판매자 토큰 +2
  r = await api('PATCH', `/orders/${order1Id}/confirm`, null, buyerToken);
  check('주문1 확정', r.data.status === 'CONFIRMED', r.data.message);

  seller = await prisma.user.findUnique({ where: { id: sellerId } });
  check('구매 확정 → 신뢰 토큰 +1 (16)', seller.trustToken === 16, seller.trustToken);

  // 이미 확정된 주문 재확정 불가
  r = await api('PATCH', `/orders/${order1Id}/confirm`, null, buyerToken);
  check('이미 확정된 주문 재확정 불가 (400)', r.status === 400);

  // 주문2 확정 (5점 리뷰 준비)
  r = await api('PATCH', `/orders/${order2Id}/confirm`, null, buyerToken);
  check('주문2 확정', r.data.status === 'CONFIRMED');
  seller = await prisma.user.findUnique({ where: { id: sellerId } });
  check('주문2 확정 → 신뢰 토큰 +1 (17)', seller.trustToken === 17, seller.trustToken);
}

// ── 7. 리뷰 + 신뢰 토큰 ──────────────────────────────
async function testReviews() {
  section('REVIEWS & 신뢰 토큰');

  // 5점 리뷰 (주문1) → 판매자 +1
  let r = await api('POST', `/reviews/order/${order1Id}`, { rating: 5, content: '정말 좋아요!' }, buyerToken);
  check('5점 리뷰 작성', r.data.id, r.data.message);
  review1Id = r.data.id;

  let seller = await prisma.user.findUnique({ where: { id: sellerId } });
  check('5점 리뷰 → 신뢰 토큰 +0.5 (17.5)', seller.trustToken === 17.5, seller.trustToken);

  // 2점 리뷰 (주문2) → 판매자 -0.5
  r = await api('POST', `/reviews/order/${order2Id}`, { rating: 2, content: '별로였어요' }, buyerToken);
  check('2점 리뷰 작성', r.data.id, r.data.message);

  seller = await prisma.user.findUnique({ where: { id: sellerId } });
  check('2점 리뷰 → 신뢰 토큰 -0.5 (17)', seller.trustToken === 17, seller.trustToken);

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
=======
  console.log(`\n${bold(cyan('━'.repeat(50)))}`);
  console.log(bold(cyan(`  ${name}`)));
  console.log(bold(cyan('━'.repeat(50))));
}

async function test(name, fn) {
  try {
    const result = await fn();
    console.log(`  ${green('✅')} ${name}`);
    if (result) console.log(`     ${yellow('→')} ${JSON.stringify(result).slice(0, 120)}`);
    passed++;
    return result;
  } catch (e) {
    console.log(`  ${red('❌')} ${name}`);
    console.log(`     ${red('오류:')} ${e.message}`);
    failed++;
    return null;
  }
}

async function expectError(name, fn) {
  try {
    await fn();
    console.log(`  ${red('❌')} ${name} ${red('(에러가 나야 하는데 성공함)')}`);
    failed++;
  } catch (e) {
    const status = e.status || '?';
    console.log(`  ${green('✅')} ${name} ${yellow(`(예상된 ${status} 에러)`)}`);
    passed++;
  }
}

// ── HTTP 헬퍼 ────────────────────────────────────────────
async function req(method, path, { body, token, form } = {}) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let bodyInit;
  if (form) {
    bodyInit = form;
  } else if (body) {
    headers['Content-Type'] = 'application/json';
    bodyInit = JSON.stringify(body);
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: bodyInit,
  });

  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }

  if (!res.ok) {
    const err = new Error(data?.message || text || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

// 가짜 PDF 파일 버퍼 생성 (S3 업로드용)
function fakePdfBuffer() {
  return Buffer.from('%PDF-1.4 fake pdf content for testing');
}

function fakeFormData(fields, fileBuffer) {
  const boundary = '----TestBoundary' + Date.now();
  const lines = [];

  for (const [key, value] of Object.entries(fields)) {
    lines.push(`--${boundary}`);
    lines.push(`Content-Disposition: form-data; name="${key}"`);
    lines.push('');
    lines.push(value);
  }

  if (fileBuffer) {
    lines.push(`--${boundary}`);
    lines.push('Content-Disposition: form-data; name="file"; filename="test.pdf"');
    lines.push('Content-Type: application/pdf');
    lines.push('');
  }

  const header = lines.join('\r\n') + '\r\n';
  const footer = `\r\n--${boundary}--\r\n`;

  const body = fileBuffer
    ? Buffer.concat([Buffer.from(header), fileBuffer, Buffer.from(footer)])
    : Buffer.from(header + footer);

  return {
    buffer: body,
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

async function reqMultipart(method, path, fields, fileBuffer, token) {
  const { buffer, contentType } = fakeFormData(fields, fileBuffer);
  const headers = { 'Content-Type': contentType };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: buffer,
  });

  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }

  if (!res.ok) {
    const err = new Error(data?.message || text || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

// ── 테스트 시작 ──────────────────────────────────────────
async function main() {
  console.log(bold('\n🚀 Recode AI 전체 API 테스트 시작\n'));

  // ────────────────────────────────────────────
  section('[1] AUTH - 로그인 / 인증');
  // ────────────────────────────────────────────

  await test('어드민 로그인', async () => {
    const data = await req('POST', '/auth/wallet-login', { body: { walletAddress: ADMIN_WALLET } });
    adminToken = data.accessToken;
    return { userId: data.user.id, isAdmin: data.user.isAdmin };
  });

  await test('구매자 로그인', async () => {
    const data = await req('POST', '/auth/wallet-login', { body: { walletAddress: BUYER_WALLET } });
    buyerToken = data.accessToken;
    return { userId: data.user.id };
  });

  await test('판매자 로그인 (어드민과 다른 계정)', async () => {
    const data = await req('POST', '/auth/wallet-login', { body: { walletAddress: SELLER_WALLET } });
    sellerToken = data.accessToken;
    return { userId: data.user.id };
  });

  await test('내 프로필 조회', async () => {
    const data = await req('GET', '/auth/profile', { token: adminToken });
    return { walletAddress: data.walletAddress, isAdmin: data.isAdmin };
  });

  await test('어드민 PASS 인증 완료', async () => {
    return req('PATCH', '/auth/pass-verify', { token: adminToken, body: { phoneNumber: '01011112222' } });
  });

  await test('구매자 PASS 인증 완료', async () => {
    return req('PATCH', '/auth/pass-verify', { token: buyerToken, body: { phoneNumber: '01033334444' } });
  });

  await test('판매자 PASS 인증 완료', async () => {
    return req('PATCH', '/auth/pass-verify', { token: sellerToken, body: { phoneNumber: '01055556666' } });
  });

  // ────────────────────────────────────────────
  section('[2] PRODUCTS - 상품');
  // ────────────────────────────────────────────

  await test('상품 목록 조회 (비회원)', async () => {
    const data = await req('GET', '/products');
    return { 총상품수: data.total ?? data.length ?? '?' };
  });

  await test('상품 검색 (필터/정렬)', async () => {
    const data = await req('GET', '/products?search=AI&sortBy=rating&page=1&limit=5');
    return { 검색결과: data.total ?? data.length ?? '?' };
  });

  await test('상품 등록 (판매자, 파일 업로드 포함)', async () => {
    const data = await reqMultipart(
      'POST', '/products',
      {
        title: '테스트 AI 프롬프트 가이드',
        description: 'ChatGPT 활용 프롬프트 모음집 테스트용',
        priceEth: '0.002',
        mintingTime: 'IMMEDIATE',
        tags: JSON.stringify(['AI', '프롬프트']),
      },
      fakePdfBuffer(),
      sellerToken,
    );
    productId = data.id;
    return { id: productId, title: data.title, status: data.status };
  });

  await test('상품 상세 조회', async () => {
    const data = await req('GET', `/products/${productId}`);
    return { title: data.title, priceEth: data.priceEth };
  });

  await test('판매자 통계 조회', async () => {
    const data = await req('GET', `/products/seller/${SELLER_WALLET}/stats`);
    return data;
  });

  await test('상품 수정', async () => {
    const data = await req('PATCH', `/products/${productId}`, {
      token: sellerToken,
      body: { title: '수정된 AI 프롬프트 가이드 v2', priceEth: '0.003' },
    });
    return { title: data.title, priceEth: data.priceEth };
  });

  // ────────────────────────────────────────────
  section('[3] FILES - 파일');
  // ────────────────────────────────────────────

  await test('Presigned 업로드 URL 발급 (S3 직접 업로드용)', async () => {
    const data = await req('POST', '/files/presigned-upload', {
      token: adminToken,
      body: { filename: 'test.pdf', contentType: 'application/pdf' },
    });
    return { key: data.key, url: data.uploadUrl?.slice(0, 60) + '...' };
  });

  await test('URL 안전성 검사 - 정상 URL', async () => {
    const data = await req('POST', '/files/check-url', {
      token: adminToken,
      body: { url: 'https://www.google.com' },
    });
    return { safe: data.safe };
  });

  await test('URL 안전성 검사 - 악성 URL (Google 테스트용)', async () => {
    const data = await req('POST', '/files/check-url', {
      token: adminToken,
      body: { url: 'http://malware.testing.google.test/testing/malware/' },
    });
    return { safe: data.safe, threat: data.threat };
  });

  // ────────────────────────────────────────────
  section('[4] ORDERS - 주문');
  // ────────────────────────────────────────────

  await test('주문 생성 (ETH 결제)', async () => {
    const data = await req('POST', '/orders', {
      token: buyerToken,
      body: { productId, paymentMethod: 'ETH' },
    });
    orderId = data.id;
    return { id: orderId, status: data.status, autoConfirmAt: data.autoConfirmAt };
  });

  await test('내 구매 내역 조회', async () => {
    const data = await req('GET', '/orders/my/purchases', { token: buyerToken });
    return { 구매건수: data.length };
  });

  await test('내 판매 내역 조회', async () => {
    const data = await req('GET', '/orders/my/sales', { token: sellerToken });
    return { 판매건수: data.length };
  });

  await test('파일 다운로드 URL 발급 (CloudFront Signed URL)', async () => {
    const data = await req('GET', `/orders/${orderId}/download`, { token: buyerToken });
    return { url: data.url?.slice(0, 80) + '...', expiresIn: data.expiresIn };
  });

  await test('구매 확정', async () => {
    const data = await req('PATCH', `/orders/${orderId}/confirm`, { token: buyerToken });
    return { status: data.status, settledAt: data.settledAt };
  });

  // ────────────────────────────────────────────
  section('[5] REVIEWS - 리뷰');
  // ────────────────────────────────────────────

  await test('리뷰 목록 조회 (비회원)', async () => {
    const data = await req('GET', `/reviews/product/${productId}`);
    return { 리뷰수: data.length };
  });

  await test('리뷰 작성 (구매 확정 후)', async () => {
    const data = await req('POST', `/reviews/order/${orderId}`, {
      token: buyerToken,
      body: { rating: 5, content: '정말 유용한 자료였습니다! 강력 추천합니다.' },
    });
    reviewId = data.id;
    return { id: reviewId, rating: data.rating };
  });

  await test('리뷰 수정', async () => {
    const data = await req('PATCH', `/reviews/${reviewId}`, {
      token: buyerToken,
      body: { rating: 4, content: '좋은 자료이나 조금 더 보완이 필요합니다.' },
    });
    return { rating: data.rating, content: data.content?.slice(0, 30) };
  });

  // ────────────────────────────────────────────
  section('[6] REPORTS - 신고');
  // ────────────────────────────────────────────

  // 신고는 PENDING_CONFIRMATION 상태 주문에서만 가능 → 새 상품+주문 생성
  await test('신고용 상품 등록 (판매자)', async () => {
    const data = await reqMultipart(
      'POST', '/products',
      {
        title: '신고 테스트용 상품',
        description: '신고 기능 테스트용',
        priceEth: '0.001',
        mintingTime: 'IMMEDIATE',
        tags: JSON.stringify(['테스트']),
      },
      fakePdfBuffer(),
      sellerToken,
    );
    return { id: data.id, status: data.status };
  });

  // 신고용 주문 생성 (confirm 전 상태 유지)
  const reportProduct = await req('GET', '/products?limit=50').catch(() => null);
  const pendingProduct = reportProduct?.items?.find(p => p.status === 'ON_SALE');

  if (pendingProduct) {
    await test('신고용 주문 생성 (confirm 안 함)', async () => {
      const data = await req('POST', '/orders', {
        token: buyerToken,
        body: { productId: pendingProduct.id, paymentMethod: 'ETH' },
      });
      order2Id = data.id;
      return { id: order2Id, status: data.status };
    });

    await test('신고 접수 (Slack 알림 전송됨)', async () => {
      const data = await reqMultipart(
        'POST', `/reports/order/${order2Id}`,
        { reason: '판매자가 설명과 다른 파일을 제공했습니다. 환불을 요청합니다.' },
        null,
        buyerToken,
      );
      reportId = data.id;
      return { id: reportId, status: data.status };
    });

    await test('신고 후 주문 상태 SETTLEMENT_HOLD 확인', async () => {
      const orders = await req('GET', '/orders/my/purchases', { token: buyerToken });
      const target = orders.find(o => o.id === order2Id);
      return { status: target?.status };
    });

    await test('신고 상세 조회', async () => {
      const data = await req('GET', `/reports/${reportId}`, { token: buyerToken });
      return { id: data.id, status: data.status, reason: data.reason?.slice(0, 30) };
    });
  }

  // ────────────────────────────────────────────
  section('[7] ADMIN - 관리자');
  // ────────────────────────────────────────────

  await test('신고 목록 조회 (전체)', async () => {
    const data = await req('GET', '/admin/reports', { token: adminToken });
    return { 총신고수: data.length };
  });

  await test('신고 목록 조회 (PENDING 필터)', async () => {
    const data = await req('GET', '/admin/reports?status=PENDING', { token: adminToken });
    return { PENDING건수: data.length };
  });

  if (reportId) {
    await test('신고 상세 조회 (관리자)', async () => {
      const data = await req('GET', `/admin/reports/${reportId}`, { token: adminToken });
      return { id: data.id, status: data.status };
    });

    await test('신고 처리 - 환불 승인 (REFUNDED)', async () => {
      const data = await req('PATCH', `/admin/reports/${reportId}/process`, {
        token: adminToken,
        body: { action: 'REFUNDED' },
      });
      return data;
    });
  }

  await test('상품 노출 숨김 처리', async () => {
    const data = await req('PATCH', `/admin/products/${productId}/visibility`, {
      token: adminToken,
      body: { isVisible: false },
    });
    return { productId: data.productId, isVisible: data.isVisible };
  });

  await test('상품 노출 복구', async () => {
    const data = await req('PATCH', `/admin/products/${productId}/visibility`, {
      token: adminToken,
      body: { isVisible: true },
    });
    return { productId: data.productId, isVisible: data.isVisible };
  });

  await test('정산 현황 통계', async () => {
    const data = await req('GET', '/admin/settlement/stats', { token: adminToken });
    return {
      총주문: data.totalOrders,
      확정: data.confirmed?.count,
      환불: data.refunded?.count,
    };
  });

  await test('전체 상품 목록 (관리자)', async () => {
    const data = await req('GET', '/admin/products', { token: adminToken });
    return { 총상품: data.total, 현재페이지: data.page };
  });

  await test('관리자 액션 로그', async () => {
    const data = await req('GET', '/admin/logs', { token: adminToken });
    return { 로그수: data.total };
  });

  // ────────────────────────────────────────────
  section('[8] 에러 케이스 - 잘못된 요청');
  // ────────────────────────────────────────────

  await expectError('토큰 없이 보호된 API → 401', () =>
    req('GET', '/auth/profile')
  );

  await expectError('본인 상품 구매 시도 → 400', () =>
    req('POST', '/orders', {
      token: sellerToken,
      body: { productId, paymentMethod: 'ETH' },
    })
  );

  await expectError('존재하지 않는 상품 조회 → 404', () =>
    req('GET', '/products/nonexistent-id-00000000000')
  );

  await expectError('일반 유저가 어드민 API 접근 → 403', () =>
    req('GET', '/admin/reports', { token: buyerToken })
  );

  await expectError('리뷰 수정 권한 없음 → 403', () =>
    req('PATCH', `/reviews/${reviewId}`, {
      token: adminToken,
      body: { rating: 1 },
    })
  );

  // ────────────────────────────────────────────
  // 최종 결과
  // ────────────────────────────────────────────
  const total = passed + failed;
  console.log(`\n${bold(cyan('━'.repeat(50)))}`);
  console.log(bold(`\n  테스트 결과: ${green(`${passed}개 성공`)}  ${failed > 0 ? red(`${failed}개 실패`) : ''}  / 전체 ${total}개`));
  if (failed === 0) {
    console.log(bold(green('\n  🎉 모든 테스트 통과!\n')));
  } else {
    console.log(bold(yellow(`\n  ⚠️  ${failed}개 항목을 확인하세요\n`)));
  }
}

main().catch((e) => {
  console.error(red('\n서버에 연결할 수 없습니다. npm run start:dev 가 실행 중인지 확인하세요.'));
  console.error(red(e.message));
  process.exit(1);
});
>>>>>>> origin/JC
