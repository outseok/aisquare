/**
 * Seed: 정적 프로토타입의 mock products (p001~p012)과 1:1 매핑되는 상품을
 * BE DB에 넣어 둔다. 같은 ID/표지/제목을 사용하므로 static UI에서 클릭하면
 * 그대로 BE에 존재하는 productId로 연결돼 Toss 결제까지 흘러간다.
 */
import { PrismaClient, FileType, ProductStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const sellers = [
  { username: 'soyeon.k',         nickname: '소연카피',     email: 'soyeon@aisquare.com',    phone: '01011110001', name: '소연' },
  { username: 'mkt.lab',          nickname: '마케팅랩',     email: 'mkt@aisquare.com',       phone: '01011110002', name: '마케팅' },
  { username: 'seo.master',       nickname: 'SEO마스터',    email: 'seo@aisquare.com',       phone: '01011110003', name: 'SEO 마스터' },
  { username: 'a-plan',           nickname: 'A플랜',        email: 'aplan@aisquare.com',     phone: '01011110004', name: 'A플랜' },
  { username: 'youtuber.jin',     nickname: '유튜버진',     email: 'jin@aisquare.com',       phone: '01011110005', name: '진' },
  { username: 'thumbnail.master', nickname: '썸네일마스터', email: 'thumb@aisquare.com',     phone: '01011110006', name: '썸네일' },
  { username: 'shorts.kim',       nickname: '쇼츠킴',       email: 'shorts@aisquare.com',    phone: '01011110007', name: '쇼츠' },
  { username: 'sns.lab',          nickname: 'SNS랩',        email: 'sns@aisquare.com',       phone: '01011110008', name: 'SNS' },
  { username: 'devmate',          nickname: '데브메이트',   email: 'dev@aisquare.com',       phone: '01011110009', name: '데브' },
  { username: 'docgen',           nickname: '독젠',         email: 'doc@aisquare.com',       phone: '01011110010', name: '독' },
  { username: 'chairteam',        nickname: '체어팀',       email: 'chair@aisquare.com',     phone: '01011110011', name: '체어' },
  { username: 'debug.helper',     nickname: '디버그헬퍼',   email: 'debug@aisquare.com',     phone: '01011110012', name: '디버그' },
];

const products = [
  { id: 'p001', title: 'GPT-5 SNS 광고 카피 프롬프트 50종 + 톤앤매너 학습 시트', priceKrw: 5500, fileType: 'PDF', cover: 'cover-01.svg', seller: 'soyeon.k' },
  { id: 'p002', title: '주간 마케팅 리포트 자동 생성 GPT-5 프롬프트 패키지',     priceKrw: 3200, fileType: 'PDF', cover: 'cover-02.svg', seller: 'mkt.lab' },
  { id: 'p003', title: '네이버·구글 키워드 분석 자동화 시트 + Claude 프롬프트',    priceKrw: 2800, fileType: 'PDF', cover: 'cover-03.svg', seller: 'seo.master' },
  { id: 'p004', title: '블로그 SEO 자동화 워크시트 · 월 100건 검색 상위 노출',     priceKrw: 10000,fileType: 'PDF', cover: 'cover-04.svg', seller: 'a-plan' },
  { id: 'p005', title: '유튜브 후킹 스크립트 GPT 프롬프트 · 평균 시청 지속률 +18%', priceKrw: 1500, fileType: 'PDF', cover: 'cover-05.svg', seller: 'youtuber.jin' },
  { id: 'p006', title: 'Midjourney v7 + DALL·E 3 썸네일 자동 생성 프롬프트 100선',  priceKrw: 10000,fileType: 'PNG', cover: 'cover-06.svg', seller: 'thumbnail.master' },
  { id: 'p007', title: '릴스·쇼츠 자막 자동 생성 + 감정 분석 GPT 시트',            priceKrw: 3400, fileType: 'PDF', cover: 'cover-07.svg', seller: 'shorts.kim' },
  { id: 'p008', title: '인스타·X 일주일치 콘텐츠 큐레이션 GPT 자동화',             priceKrw: 500,  fileType: 'PDF', cover: 'cover-08.svg', seller: 'sns.lab' },
  { id: 'p009', title: 'Cursor + Claude 코드 리뷰 자동화 · 컨벤션 100% 일치',      priceKrw: 2500, fileType: 'PDF', cover: 'cover-09.svg', seller: 'devmate' },
  { id: 'p010', title: 'NestJS · FastAPI API 문서 자동 생성 GPT 프롬프트 세트',    priceKrw: 39900,fileType: 'PDF', cover: 'cover-10.svg', seller: 'docgen' },
  { id: 'p011', title: 'Jest · Vitest 단위 테스트 자동 생성 Claude 프롬프트',      priceKrw: 50000,fileType: 'PDF', cover: 'cover-11.svg', seller: 'chairteam' },
  { id: 'p012', title: '에러 로그 분석 → 픽스 제안 GPT 프롬프트 · 디버깅 단축',    priceKrw: 1600, fileType: 'PDF', cover: 'cover-12.svg', seller: 'debug.helper' },
];

async function main() {
  const passwordHash = await bcrypt.hash('seedpass', 10);

  // ── Default admin user (관리자 콘솔 즉시 사용 가능) ─────────────────────
  // username: admin / password: admin123
  // ADMIN_USERNAMES env에 'admin' 포함되어 있으면 일반 회원가입 시에도 자동 부여되지만,
  // 클론 직후 즉시 관리자 페이지를 쓸 수 있도록 여기서도 명시적으로 생성.
  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: { isAdmin: true },
    create: {
      username: 'admin',
      passwordHash: adminPasswordHash,
      name: 'AISquare 관리자',
      nickname: '관리자',
      email: 'admin@aisquare.com',
      phone: '01000000000',
      phoneVerified: false,
      isAdmin: true,
    } as any,
  });
  console.log('Default admin user 생성 — username: admin / password: admin123 (즉시 변경 권장)');

  // Seller users
  const sellerById: Record<string, string> = {};
  for (const s of sellers) {
    const u = await prisma.user.upsert({
      where: { username: s.username },
      update: {},
      create: { ...s, passwordHash, phoneVerified: true },
    });
    sellerById[s.username] = u.id;
  }

  // Products
  for (const p of products) {
    await prisma.product.upsert({
      where: { id: p.id },
      update: {},
      create: {
        id: p.id,
        sellerId: sellerById[p.seller],
        title: p.title,
        description: p.title + ' 의 상세 설명입니다. 실무 노하우 포함.',
        price: p.priceKrw,
        fileType: p.fileType as FileType,
        fileKey: 'mock/' + p.id,
        imageKey: 'assets/' + p.cover,
        status: ProductStatus.ON_SALE,
        tags: ['ai', 'prompt'] as any,
      } as any,
    });
  }

  console.log(`Seeded ${sellers.length} sellers and ${products.length} products.`);
}

main().finally(() => prisma.$disconnect());
