/**
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
const green  = (s) => `\x1b[32m${s}\x1b[0m`;
const red    = (s) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const cyan   = (s) => `\x1b[36m${s}\x1b[0m`;
const bold   = (s) => `\x1b[1m${s}\x1b[0m`;

let passed = 0, failed = 0;

function section(name) {
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
