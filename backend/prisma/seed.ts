/**
 * Seed: 정적 프로토타입의 mock products (p001~p012)과 1:1 매핑되는 상품 + 확장 카탈로그.
 * 같은 ID/표지/제목을 사용하므로 static UI에서 클릭하면 그대로 BE에 존재하는 productId로
 * 연결돼 Toss 결제까지 흘러간다.
 */
import { PrismaClient, FileType, ProductStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const sellers = [
  // ── 마케팅 / 카피 ──
  { username: 'soyeon.k',         nickname: '소연카피',     email: 'soyeon@aisquare.com',    phone: '01011110001', name: '소연' },
  { username: 'mkt.lab',          nickname: '마케팅랩',     email: 'mkt@aisquare.com',       phone: '01011110002', name: '마케팅랩' },
  { username: 'seo.master',       nickname: 'SEO마스터',    email: 'seo@aisquare.com',       phone: '01011110003', name: 'SEO 마스터' },
  { username: 'a-plan',           nickname: 'A플랜',        email: 'aplan@aisquare.com',     phone: '01011110004', name: 'A플랜' },
  { username: 'brand.kim',        nickname: '브랜드킴',     email: 'brand@aisquare.com',     phone: '01011110013', name: '김브랜드' },
  { username: 'ad.optimizer',     nickname: '광고옵티마이저', email: 'ad@aisquare.com',      phone: '01011110014', name: '광고 옵티마이저' },
  { username: 'newsletter.pro',   nickname: '뉴스레터프로', email: 'nl@aisquare.com',        phone: '01011110015', name: '뉴스레터 프로' },
  { username: 'copy.studio',      nickname: '카피스튜디오', email: 'copy@aisquare.com',      phone: '01011110016', name: '카피 스튜디오' },
  // ── 크리에이터 / 영상 ──
  { username: 'youtuber.jin',     nickname: '유튜버진',     email: 'jin@aisquare.com',       phone: '01011110005', name: '유튜버 진' },
  { username: 'thumbnail.master', nickname: '썸네일마스터', email: 'thumb@aisquare.com',     phone: '01011110006', name: '썸네일 마스터' },
  { username: 'shorts.kim',       nickname: '쇼츠킴',       email: 'shorts@aisquare.com',    phone: '01011110007', name: '쇼츠 킴' },
  { username: 'sns.lab',          nickname: 'SNS랩',        email: 'sns@aisquare.com',       phone: '01011110008', name: 'SNS 랩' },
  { username: 'studio.pk',        nickname: '스튜디오PK',   email: 'studiopk@aisquare.com',  phone: '01011110017', name: '스튜디오 PK' },
  { username: 'reels.queen',      nickname: '릴스퀸',       email: 'reels@aisquare.com',     phone: '01011110018', name: '릴스 퀸' },
  { username: 'video.editor.ai',  nickname: '영상편집AI',   email: 'video@aisquare.com',     phone: '01011110019', name: '영상 편집 AI' },
  // ── 디자인 ──
  { username: 'designer.lee',     nickname: '디자이너이',   email: 'design@aisquare.com',    phone: '01011110020', name: '이 디자이너' },
  { username: 'figma.guru',       nickname: '피그마구루',   email: 'figma@aisquare.com',     phone: '01011110021', name: '피그마 구루' },
  { username: 'ppt.master',       nickname: 'PPT마스터',    email: 'ppt@aisquare.com',       phone: '01011110022', name: 'PPT 마스터' },
  { username: 'illust.studio',    nickname: '일러스트스튜디오', email: 'illust@aisquare.com', phone: '01011110023', name: '일러스트 스튜디오' },
  // ── 개발 / 엔지니어링 ──
  { username: 'devmate',          nickname: '데브메이트',   email: 'dev@aisquare.com',       phone: '01011110009', name: '데브메이트' },
  { username: 'docgen',           nickname: '독젠',         email: 'doc@aisquare.com',       phone: '01011110010', name: '독젠' },
  { username: 'chairteam',        nickname: '체어팀',       email: 'chair@aisquare.com',     phone: '01011110011', name: '체어팀' },
  { username: 'debug.helper',     nickname: '디버그헬퍼',   email: 'debug@aisquare.com',     phone: '01011110012', name: '디버그 헬퍼' },
  { username: 'data.lab',         nickname: '데이터랩',     email: 'data@aisquare.com',      phone: '01011110024', name: '데이터 랩' },
  { username: 'sql.master',       nickname: 'SQL마스터',    email: 'sql@aisquare.com',       phone: '01011110025', name: 'SQL 마스터' },
  { username: 'cloud.eng',        nickname: '클라우드엔지', email: 'cloud@aisquare.com',     phone: '01011110026', name: '클라우드 엔지니어' },
  { username: 'ci.helper',        nickname: 'CI헬퍼',       email: 'ci@aisquare.com',        phone: '01011110027', name: 'CI 헬퍼' },
  { username: 'frontend.pro',     nickname: '프론트프로',   email: 'fe@aisquare.com',        phone: '01011110028', name: '프론트엔드 프로' },
  // ── 비즈니스 / 업무 자동화 ──
  { username: 'notion.guru',      nickname: '노션구루',     email: 'notion@aisquare.com',    phone: '01011110029', name: '노션 구루' },
  { username: 'sheet.master',     nickname: '시트마스터',   email: 'sheet@aisquare.com',     phone: '01011110030', name: '시트 마스터' },
  { username: 'kim.work',         nickname: '킴워크',       email: 'kim@aisquare.com',       phone: '01011110031', name: '킴 워크' },
  { username: 'researcher.h',     nickname: '리서처H',      email: 'research@aisquare.com',  phone: '01011110032', name: 'H 리서처' },
  { username: 'hr.toolkit',       nickname: 'HR툴킷',       email: 'hr@aisquare.com',        phone: '01011110033', name: 'HR 툴킷' },
  { username: 'cs.helper',        nickname: 'CS헬퍼',       email: 'cs@aisquare.com',        phone: '01011110034', name: 'CS 헬퍼' },
  { username: 'finance.guru',     nickname: '파이낸스구루', email: 'fin@aisquare.com',       phone: '01011110035', name: '파이낸스 구루' },
  { username: 'legal.bot',        nickname: '리걸봇',       email: 'legal@aisquare.com',     phone: '01011110036', name: '리걸봇' },
  { username: 'startup.kit',      nickname: '스타트업킷',   email: 'startup@aisquare.com',   phone: '01011110037', name: '스타트업 킷' },
  // ── 교육 / 콘텐츠 ──
  { username: 'edu.helper',       nickname: '에듀헬퍼',     email: 'edu@aisquare.com',       phone: '01011110038', name: '에듀 헬퍼' },
  { username: 'novelist.s',       nickname: '노블리스트',   email: 'novel@aisquare.com',     phone: '01011110039', name: '노블리스트' },
  { username: 'translator.j',     nickname: '트랜슬레이터', email: 'tr@aisquare.com',        phone: '01011110040', name: '번역가 J' },
  { username: 'voice.lab',        nickname: '보이스랩',     email: 'voice@aisquare.com',     phone: '01011110041', name: '보이스 랩' },
  // ── UX / 라이팅 ──
  { username: 'ux.writer',        nickname: 'UX라이터',     email: 'uxw@aisquare.com',       phone: '01011110042', name: 'UX 라이터' },
  // ── 추가 셀러 ──
  { username: 'gpt.toolkit',      nickname: 'GPT툴킷',      email: 'gpttool@aisquare.com',   phone: '01011110043', name: 'GPT 툴킷' },
  { username: 'claude.expert',    nickname: '클로드엑스퍼트', email: 'claudex@aisquare.com', phone: '01011110044', name: '클로드 전문가' },
  { username: 'midjourney.pro',   nickname: '미드저니프로', email: 'mjpro@aisquare.com',     phone: '01011110045', name: '미드저니 프로' },
  { username: 'automation.king',  nickname: '자동화킹',     email: 'auto@aisquare.com',      phone: '01011110046', name: '자동화 킹' },
  { username: 'analyst.choi',     nickname: '애널리스트최', email: 'analyst@aisquare.com',   phone: '01011110047', name: '최 애널리스트' },
  { username: 'product.mgr',      nickname: '프로덕트매니저', email: 'pm@aisquare.com',      phone: '01011110048', name: 'PM' },
  { username: 'qa.engineer',      nickname: 'QA엔지니어',   email: 'qa@aisquare.com',        phone: '01011110049', name: 'QA 엔지니어' },
  { username: 'devops.lee',       nickname: '데브옵스이',   email: 'devops@aisquare.com',    phone: '01011110050', name: '이 데브옵스' },
];

type Tag = string;
type Prod = { id: string; title: string; priceKrw: number; fileType: string; cover: string; seller: string; desc: string; tags: Tag[] };

const products: Prod[] = [
  // ── 원본 12종 (UI mock과 1:1 매칭) ──
  { id: 'p001', title: 'GPT-5 SNS 광고 카피 프롬프트 50종 + 톤앤매너 학습 시트', priceKrw: 5500,  fileType: 'PDF', cover: 'cover-01.svg', seller: 'soyeon.k', desc: 'SNS 광고에 즉시 쓸 수 있는 GPT-5 카피 50종. 톤앤매너 분석 시트 포함.', tags: ['gpt-5','카피라이팅','광고','sns','마케팅'] },
  { id: 'p002', title: '주간 마케팅 리포트 자동 생성 GPT-5 프롬프트 패키지',     priceKrw: 3200,  fileType: 'PDF', cover: 'cover-02.svg', seller: 'mkt.lab', desc: '주간 KPI/CAC/리텐션 리포트를 GPT-5로 자동 생성하는 프롬프트 모음.', tags: ['gpt-5','리포트','마케팅','자동화','주간'] },
  { id: 'p003', title: '네이버·구글 키워드 분석 자동화 시트 + Claude 프롬프트',  priceKrw: 2800,  fileType: 'PDF', cover: 'cover-03.svg', seller: 'seo.master', desc: '네이버/구글 검색량·경쟁도 분석 자동화 시트와 Claude 프롬프트.', tags: ['seo','키워드','네이버','구글','claude'] },
  { id: 'p004', title: '블로그 SEO 자동화 워크시트 · 월 100건 검색 상위 노출',   priceKrw: 10000, fileType: 'ZIP', cover: 'cover-04.svg', seller: 'a-plan', desc: '블로그 SEO 점수 자동 측정 + 개선 가이드 워크시트.', tags: ['seo','블로그','자동화','콘텐츠'] },
  { id: 'p005', title: '유튜브 후킹 스크립트 GPT 프롬프트 · 평균 시청 지속률 +18%', priceKrw: 1500, fileType: 'MP4', cover: 'cover-05.svg', seller: 'youtuber.jin', desc: '첫 7초 후킹 + 9분 시청률 유지를 위한 GPT 스크립트 프롬프트.', tags: ['유튜브','후킹','스크립트','영상','gpt'] },
  { id: 'p006', title: 'Midjourney v7 + DALL·E 3 썸네일 자동 생성 프롬프트 100선', priceKrw: 10000, fileType: 'PNG', cover: 'cover-06.svg', seller: 'thumbnail.master', desc: '클릭률 +30% 검증 완료 썸네일 프롬프트 100종.', tags: ['midjourney','dalle','썸네일','이미지','crawl'] },
  { id: 'p007', title: '릴스·쇼츠 자막 자동 생성 + 감정 분석 GPT 시트',          priceKrw: 3400,  fileType: 'MP4', cover: 'cover-07.svg', seller: 'shorts.kim', desc: '릴스/쇼츠 자막을 자동 생성하고 감정 톤을 분석하는 GPT 시트.', tags: ['릴스','쇼츠','자막','감정분석','영상'] },
  { id: 'p008', title: '인스타·X 일주일치 콘텐츠 큐레이션 GPT 자동화',           priceKrw: 500,   fileType: 'PDF', cover: 'cover-08.svg', seller: 'sns.lab', desc: '인스타그램·X(트위터) 일주일치 포스팅 자동 큐레이션.', tags: ['인스타','sns','x','콘텐츠','자동화'] },
  { id: 'p009', title: 'Cursor + Claude 코드 리뷰 자동화 · 컨벤션 100% 일치',    priceKrw: 2500,  fileType: 'PDF', cover: 'cover-09.svg', seller: 'devmate', desc: 'Cursor IDE에서 Claude로 PR 리뷰 자동화. 팀 컨벤션 강제.', tags: ['cursor','claude','코드리뷰','개발','자동화'] },
  { id: 'p010', title: 'NestJS · FastAPI API 문서 자동 생성 GPT 프롬프트 세트',  priceKrw: 39900, fileType: 'PDF', cover: 'cover-10.svg', seller: 'docgen', desc: 'NestJS/FastAPI 코드에서 OpenAPI 스펙·README 자동 생성.', tags: ['nestjs','fastapi','api','문서','swagger'] },
  { id: 'p011', title: 'Jest · Vitest 단위 테스트 자동 생성 Claude 프롬프트',    priceKrw: 50000, fileType: 'ZIP', cover: 'cover-11.svg', seller: 'chairteam', desc: 'TS 함수에서 Jest/Vitest 테스트 자동 생성. 커버리지 90%+.', tags: ['jest','vitest','테스트','claude','typescript'] },
  { id: 'p012', title: '에러 로그 분석 → 픽스 제안 GPT 프롬프트 · 디버깅 단축',  priceKrw: 1600,  fileType: 'PDF', cover: 'cover-12.svg', seller: 'debug.helper', desc: '스택 트레이스 → 원인 분석 + 패치 제안 GPT 프롬프트.', tags: ['디버깅','로그','에러','gpt','개발'] },

  // ── 마케팅 / 카피라이팅 (저~중가) ──
  { id: 'p013', title: '브랜드 톤앤매너 학습 시트 + 카피 가이드 50선',           priceKrw: 4500,  fileType: 'PDF', cover: 'cover-01.svg', seller: 'brand.kim', desc: '브랜드 보이스 정의 → 카피 50선 자동 변환 가이드.', tags: ['브랜드','톤앤매너','카피','마케팅'] },
  { id: 'p014', title: '광고 카피 A/B 테스트 자동화 GPT 시트',                   priceKrw: 3800,  fileType: 'PDF', cover: 'cover-02.svg', seller: 'ad.optimizer', desc: 'A/B 테스트용 카피 30조 자동 생성 + 성과 분석.', tags: ['광고','ab테스트','카피','퍼포먼스'] },
  { id: 'p015', title: '뉴스레터 자동 작성 GPT 워크플로우',                       priceKrw: 4200,  fileType: 'PDF', cover: 'cover-03.svg', seller: 'newsletter.pro', desc: 'Stibee/Mailchimp 호환 뉴스레터 자동 작성 + 발송 워크플로우.', tags: ['뉴스레터','이메일','마케팅','자동화'] },
  { id: 'p016', title: '카카오·네이버 광고 카피 200선 GPT 프롬프트',             priceKrw: 6900,  fileType: 'PDF', cover: 'cover-04.svg', seller: 'copy.studio', desc: '카카오모먼트·네이버 광고에 최적화된 카피 200선.', tags: ['카카오','네이버','광고','카피','한국'] },
  { id: 'p017', title: '랜딩페이지 헤드라인 + CTA 자동 생성 GPT 시트',             priceKrw: 5500,  fileType: 'PDF', cover: 'cover-05.svg', seller: 'soyeon.k', desc: '전환율 검증 헤드라인/CTA 100개 자동 생성.', tags: ['랜딩페이지','cta','전환','카피'] },
  { id: 'p018', title: '제품 상세 페이지 카피 GPT 자동 작성 키트',                 priceKrw: 8800,  fileType: 'PDF', cover: 'cover-06.svg', seller: 'copy.studio', desc: '쿠팡/스마트스토어 제품 상세 페이지 카피 자동 생성.', tags: ['제품상세','이커머스','카피','쿠팡','스마트스토어'] },

  // ── 영상 / 크리에이터 ──
  { id: 'p019', title: 'Runway Gen-3 영상 편집 실전 노하우 워크북',                priceKrw: 12000, fileType: 'MP4', cover: 'cover-07.svg', seller: 'studio.pk', desc: 'Runway Gen-3로 광고/홍보 영상 제작 노하우.', tags: ['runway','영상편집','ai영상','crawl'] },
  { id: 'p020', title: '유튜브 썸네일 클릭률 최적화 가이드 — Midjourney 30종',     priceKrw: 7200,  fileType: 'PNG', cover: 'cover-08.svg', seller: 'thumbnail.master', desc: 'A/B 검증된 썸네일 30종 + 클릭률 데이터.', tags: ['유튜브','썸네일','midjourney','ctr'] },
  { id: 'p021', title: '쇼츠 자동 편집 Premiere AI 프리셋 + 자막 자동 삽입',       priceKrw: 5400,  fileType: 'ZIP', cover: 'cover-09.svg', seller: 'shorts.kim', desc: 'Premiere Pro AI 자동 편집 프리셋. 자막 자동 삽입.', tags: ['쇼츠','premiere','자막','자동편집'] },
  { id: 'p022', title: 'Stable Diffusion XL 상업용 이미지 프롬프트 200선',         priceKrw: 9900,  fileType: 'PNG', cover: 'cover-10.svg', seller: 'illust.studio', desc: '상업 라이선스 SDXL 프롬프트 200종 + LoRA 가이드.', tags: ['stable-diffusion','sdxl','이미지','상업'] },
  { id: 'p023', title: '브이로그 컷편집 GPT 콘티 + 음악 매칭 자동화',              priceKrw: 4400,  fileType: 'MP4', cover: 'cover-11.svg', seller: 'video.editor.ai', desc: '브이로그 컷 자동 추천 + 음악 매칭 GPT 워크플로우.', tags: ['브이로그','편집','음악','자동화'] },
  { id: 'p024', title: '릴스 후킹 첫 3초 스크립트 100선',                          priceKrw: 3300,  fileType: 'PDF', cover: 'cover-12.svg', seller: 'reels.queen', desc: '릴스 첫 3초 시청률 +40% 검증 스크립트.', tags: ['릴스','후킹','스크립트','sns'] },

  // ── 디자인 / UX ──
  { id: 'p025', title: 'Figma + Midjourney UI 디자인 자동화',                     priceKrw: 14900, fileType: 'PNG', cover: 'cover-01.svg', seller: 'designer.lee', desc: 'Figma 플러그인 + Midjourney로 UI 디자인 자동화.', tags: ['figma','midjourney','ui','디자인'] },
  { id: 'p026', title: 'PPT 자동 생성 GPT 프롬프트 · 임원 보고용 50종',           priceKrw: 7700,  fileType: 'PDF', cover: 'cover-02.svg', seller: 'ppt.master', desc: '경영진 보고용 PPT 50종 자동 생성 프롬프트.', tags: ['ppt','파워포인트','보고','임원'] },
  { id: 'p027', title: 'UX 라이팅 가이드 + 마이크로카피 200선',                   priceKrw: 6800,  fileType: 'PDF', cover: 'cover-03.svg', seller: 'ux.writer', desc: '버튼·에러·온보딩 마이크로카피 200선.', tags: ['ux','마이크로카피','라이팅','ui'] },
  { id: 'p028', title: '브랜드 컬러 팔레트 GPT 추천 + Figma 변환',                priceKrw: 3500,  fileType: 'PDF', cover: 'cover-04.svg', seller: 'figma.guru', desc: '브랜드 컨셉 → 컬러 팔레트 5종 자동 추천.', tags: ['색상','브랜드','figma','디자인'] },
  { id: 'p029', title: 'AI 일러스트 스타일 가이드 · Midjourney 30종',              priceKrw: 9500,  fileType: 'PNG', cover: 'cover-05.svg', seller: 'illust.studio', desc: '아트 스타일별 Midjourney 프롬프트 30종.', tags: ['일러스트','midjourney','아트','스타일'] },

  // ── 개발 / 엔지니어링 ──
  { id: 'p030', title: '코드 리팩토링 Cursor 프롬프트 모음 · 200선',               priceKrw: 5500,  fileType: 'PDF', cover: 'cover-06.svg', seller: 'devmate', desc: 'Cursor IDE에서 안전한 리팩토링 200 패턴.', tags: ['cursor','리팩토링','개발','typescript'] },
  { id: 'p031', title: 'GitHub Actions CI/CD 자동 생성 GPT 프롬프트',              priceKrw: 4900,  fileType: 'PDF', cover: 'cover-07.svg', seller: 'ci.helper', desc: 'PR/배포 자동 워크플로우 yml 자동 생성.', tags: ['github','actions','ci','cd','devops'] },
  { id: 'p032', title: 'AWS 인프라 다이어그램 자동 생성 프롬프트',                 priceKrw: 8800,  fileType: 'PNG', cover: 'cover-08.svg', seller: 'cloud.eng', desc: 'AWS 요구사항 → 다이어그램 자동 생성.', tags: ['aws','클라우드','인프라','다이어그램'] },
  { id: 'p033', title: 'SQL 쿼리 최적화 GPT 프롬프트 · 100가지 패턴',              priceKrw: 6900,  fileType: 'PDF', cover: 'cover-09.svg', seller: 'sql.master', desc: '느린 SQL → 최적화 100 패턴 + EXPLAIN 분석.', tags: ['sql','db','최적화','postgres','mysql'] },
  { id: 'p034', title: '엑셀 데이터 분석 GPT 프롬프트 100선',                     priceKrw: 3300,  fileType: 'PDF', cover: 'cover-10.svg', seller: 'data.lab', desc: '엑셀 함수 + 피벗 + 차트 자동 생성 프롬프트.', tags: ['엑셀','excel','데이터','분석','피벗'] },
  { id: 'p035', title: 'React 19 + Next 15 컴포넌트 자동 생성 Claude',             priceKrw: 8900,  fileType: 'PDF', cover: 'cover-11.svg', seller: 'frontend.pro', desc: 'React 19 / Next 15 패턴별 컴포넌트 자동 생성.', tags: ['react','next','frontend','claude','typescript'] },
  { id: 'p036', title: 'Python 데이터 파이프라인 자동 생성 GPT 프롬프트',          priceKrw: 7700,  fileType: 'PDF', cover: 'cover-12.svg', seller: 'data.lab', desc: 'Pandas + DuckDB 파이프라인 자동 생성.', tags: ['python','pandas','duckdb','데이터'] },
  { id: 'p037', title: 'Docker · K8s 매니페스트 자동 생성 GPT 프롬프트',           priceKrw: 9200,  fileType: 'PDF', cover: 'cover-01.svg', seller: 'devops.lee', desc: '컨테이너/Helm 차트 자동 생성.', tags: ['docker','kubernetes','helm','devops'] },
  { id: 'p038', title: '버그 재현 시나리오 자동 작성 QA 프롬프트',                 priceKrw: 2900,  fileType: 'PDF', cover: 'cover-02.svg', seller: 'qa.engineer', desc: '버그 리포트 → 재현 시나리오 + 회귀 테스트.', tags: ['qa','테스트','버그','회귀'] },

  // ── 비즈니스 / 업무 자동화 ──
  { id: 'p039', title: 'Notion AI 업무 자동화 템플릿 30종',                       priceKrw: 8900,  fileType: 'PDF', cover: 'cover-03.svg', seller: 'notion.guru', desc: '회의록·OKR·로드맵·CRM 30종 템플릿.', tags: ['notion','업무','자동화','템플릿'] },
  { id: 'p040', title: 'Google Sheets + GPT API 자동화 시트',                      priceKrw: 5500,  fileType: 'PDF', cover: 'cover-04.svg', seller: 'sheet.master', desc: 'Apps Script로 GPT API 직접 호출 자동화.', tags: ['google-sheets','gpt-api','자동화','apps-script'] },
  { id: 'p041', title: 'ChatGPT 회의록 자동화 워크플로우 8단계',                   priceKrw: 2200,  fileType: 'PDF', cover: 'cover-05.svg', seller: 'kim.work', desc: 'Zoom 녹음 → 회의록 → Notion 정리 8단계.', tags: ['회의록','zoom','업무','자동화'] },
  { id: 'p042', title: '시장 리서치 자동화 GPT 프롬프트 · 경쟁사 분석',           priceKrw: 9900,  fileType: 'PDF', cover: 'cover-06.svg', seller: 'researcher.h', desc: '경쟁사 5곳 자동 분석 + SWOT 리포트.', tags: ['리서치','경쟁사','시장','swot'] },
  { id: 'p043', title: 'HR 면접 질문 자동 생성 GPT 시트 · 직무별 200문항',         priceKrw: 6600,  fileType: 'PDF', cover: 'cover-07.svg', seller: 'hr.toolkit', desc: 'PM/개발/디자인/마케팅 직무별 200문항.', tags: ['hr','면접','채용','질문'] },
  { id: 'p044', title: 'CS 응대 스크립트 자동 생성 GPT 프롬프트',                  priceKrw: 2900,  fileType: 'PDF', cover: 'cover-08.svg', seller: 'cs.helper', desc: '환불/배송/품질 CS 응대 스크립트 자동 생성.', tags: ['cs','고객','응대','스크립트'] },
  { id: 'p045', title: '재무제표 분석 GPT 프롬프트 · 투자 검토용',                  priceKrw: 13500, fileType: 'PDF', cover: 'cover-09.svg', seller: 'finance.guru', desc: '손익·BS·CF 자동 분석 + 투자 의견.', tags: ['재무','투자','회계','분석'] },
  { id: 'p046', title: '계약서 검토 Claude 프롬프트 · 표준 약관 30종',              priceKrw: 11000, fileType: 'PDF', cover: 'cover-10.svg', seller: 'legal.bot', desc: 'NDA/용역/SaaS 계약서 자동 검토.', tags: ['계약서','법무','claude','nda'] },
  { id: 'p047', title: '스타트업 IR 덱 자동 생성 프롬프트 패키지',                 priceKrw: 19900, fileType: 'PDF', cover: 'cover-11.svg', seller: 'startup.kit', desc: 'Seed/Series A IR 덱 14페이지 자동 생성.', tags: ['ir','스타트업','투자','덱'] },
  { id: 'p048', title: '면접 자기소개서 자동 생성 GPT 시트 · 직군별',              priceKrw: 2400,  fileType: 'PDF', cover: 'cover-12.svg', seller: 'hr.toolkit', desc: '신입/경력 자소서 직군별 자동 생성.', tags: ['자소서','자기소개서','면접','취업'] },
  { id: 'p049', title: 'PM 스펙 문서(PRD) 자동 생성 GPT 프롬프트',                 priceKrw: 7300,  fileType: 'PDF', cover: 'cover-01.svg', seller: 'product.mgr', desc: 'PRD 8섹션 자동 작성 + 우선순위 산정.', tags: ['pm','prd','기획','제품'] },
  { id: 'p050', title: 'OKR 분기 자동 설정 GPT 워크북',                            priceKrw: 5800,  fileType: 'PDF', cover: 'cover-02.svg', seller: 'product.mgr', desc: '회사·팀·개인 OKR 분기 자동 설정.', tags: ['okr','목표','분기','경영'] },

  // ── 교육 / 콘텐츠 ──
  { id: 'p051', title: '학습지 자동 생성 GPT 프롬프트 · 중·고등 5과목',             priceKrw: 4800,  fileType: 'PDF', cover: 'cover-03.svg', seller: 'edu.helper', desc: '국·영·수·과·사 학습지 자동 생성.', tags: ['교육','학습지','중학','고등','과외'] },
  { id: 'p052', title: '웹소설 플롯 생성 GPT 프롬프트 · 연재용 30종',               priceKrw: 5900,  fileType: 'PDF', cover: 'cover-04.svg', seller: 'novelist.s', desc: '로맨스·판타지·미스터리 연재 플롯 30선.', tags: ['웹소설','플롯','연재','글쓰기'] },
  { id: 'p053', title: '번역 품질 향상 Claude 프롬프트 + 용어 사전',                priceKrw: 4400,  fileType: 'PDF', cover: 'cover-05.svg', seller: 'translator.j', desc: '한↔영 번역 품질 +30% 향상 프롬프트.', tags: ['번역','claude','영어','한국어'] },
  { id: 'p054', title: 'ElevenLabs 음성 합성 한국어 프롬프트 100선',                priceKrw: 6700,  fileType: 'MP4', cover: 'cover-06.svg', seller: 'voice.lab', desc: 'ElevenLabs 한국어 음성 합성 최적 프롬프트.', tags: ['elevenlabs','tts','음성','한국어'] },
  { id: 'p055', title: '영어 회화 스크립트 GPT 자동 생성 · 비즈니스 50종',          priceKrw: 3900,  fileType: 'PDF', cover: 'cover-07.svg', seller: 'edu.helper', desc: '실무 영어 비즈니스 스크립트 50종.', tags: ['영어','회화','비즈니스','학습'] },
  { id: 'p056', title: '논문 요약 + 인용 자동 생성 Claude 프롬프트',                priceKrw: 5200,  fileType: 'PDF', cover: 'cover-08.svg', seller: 'researcher.h', desc: '논문 PDF → 핵심 요약 + 인용 자동.', tags: ['논문','연구','요약','claude'] },

  // ── 추가 (고가/프리미엄) ──
  { id: 'p057', title: 'GPT-5 마케팅 AI 에이전트 마스터 패키지 (1년 라이선스)',     priceKrw: 199000,fileType: 'ZIP', cover: 'cover-09.svg', seller: 'gpt.toolkit', desc: '마케팅 AI 에이전트 풀스택 (캠페인·분석·리포트 자동).', tags: ['gpt-5','에이전트','마케팅','프리미엄'] },
  { id: 'p058', title: 'Claude 코드 마스터 — 풀스택 자동화 200시간 워크북',         priceKrw: 149000,fileType: 'ZIP', cover: 'cover-10.svg', seller: 'claude.expert', desc: 'Claude로 풀스택 200시간 절감 검증.', tags: ['claude','풀스택','개발','프리미엄'] },
  { id: 'p059', title: 'Midjourney v7 상업 포트폴리오 마스터 (500 프롬프트)',       priceKrw: 89000, fileType: 'PNG', cover: 'cover-11.svg', seller: 'midjourney.pro', desc: '상업 라이선스 Midjourney 500 프롬프트.', tags: ['midjourney','포트폴리오','상업','이미지'] },
  { id: 'p060', title: '데이터 분석 AI 에이전트 — Notion·BigQuery 연동',            priceKrw: 119000,fileType: 'ZIP', cover: 'cover-12.svg', seller: 'analyst.choi', desc: 'BigQuery + Notion 데이터 분석 자동화.', tags: ['데이터','bigquery','notion','에이전트'] },

  // ── 추가 저가 (살 만한 것 다양화) ──
  { id: 'p061', title: '인스타 캡션 자동 생성 GPT 30선',                            priceKrw: 1200,  fileType: 'PDF', cover: 'cover-01.svg', seller: 'sns.lab', desc: '인스타 캡션 30선 + 해시태그 자동.', tags: ['인스타','캡션','해시태그','sns'] },
  { id: 'p062', title: '이메일 답장 자동 생성 GPT 프롬프트 20선',                   priceKrw: 900,   fileType: 'PDF', cover: 'cover-02.svg', seller: 'kim.work', desc: '비즈니스 이메일 답장 20 패턴.', tags: ['이메일','답장','비즈니스','업무'] },
  { id: 'p063', title: '한 줄 광고 슬로건 GPT 100선',                               priceKrw: 1500,  fileType: 'PDF', cover: 'cover-03.svg', seller: 'soyeon.k', desc: '브랜드 슬로건 100선 자동 생성.', tags: ['슬로건','광고','카피','브랜드'] },
  { id: 'p064', title: '시 작성 GPT 프롬프트 — 감성/현대시 30종',                   priceKrw: 800,   fileType: 'PDF', cover: 'cover-04.svg', seller: 'novelist.s', desc: '감성시·현대시 작성 프롬프트 30종.', tags: ['시','글쓰기','문학','감성'] },
  { id: 'p065', title: '레시피 자동 생성 GPT — 냉장고 재료 입력',                   priceKrw: 1100,  fileType: 'PDF', cover: 'cover-05.svg', seller: 'kim.work', desc: '냉장고 재료 → 3가지 요리 자동 추천.', tags: ['요리','레시피','생활','gpt'] },
  { id: 'p066', title: '여행 일정 GPT 자동 생성 — 도시별 3박4일',                   priceKrw: 1300,  fileType: 'PDF', cover: 'cover-06.svg', seller: 'kim.work', desc: '서울·도쿄·오사카·뉴욕 3박4일 일정 자동.', tags: ['여행','일정','도쿄','서울','뉴욕'] },

  // ── 추가 중가 (실무) ──
  { id: 'p067', title: 'Excel VBA 매크로 GPT 자동 생성 100 패턴',                   priceKrw: 4900,  fileType: 'PDF', cover: 'cover-07.svg', seller: 'sheet.master', desc: '엑셀 VBA 매크로 자동 생성 100 패턴.', tags: ['엑셀','vba','매크로','자동화'] },
  { id: 'p068', title: '아마존 셀러 상품 설명 GPT 자동 생성 · 영어',                priceKrw: 6300,  fileType: 'PDF', cover: 'cover-08.svg', seller: 'copy.studio', desc: '아마존 셀러 영문 상품 설명 자동 생성.', tags: ['아마존','이커머스','영문','셀러'] },
  { id: 'p069', title: '쇼피파이 스토어 SEO GPT 워크북',                            priceKrw: 8200,  fileType: 'PDF', cover: 'cover-09.svg', seller: 'seo.master', desc: 'Shopify 상품·블로그 SEO 자동화.', tags: ['shopify','seo','쇼피파이','이커머스'] },
  { id: 'p070', title: 'AI 챗봇 응답 시나리오 자동 생성 · 50업종',                  priceKrw: 7400,  fileType: 'PDF', cover: 'cover-10.svg', seller: 'cs.helper', desc: '50개 업종 챗봇 응답 시나리오 자동.', tags: ['챗봇','시나리오','cs','자동화'] },
  { id: 'p071', title: '브랜딩 BX 가이드 + 로고 Midjourney 프롬프트',                priceKrw: 9800,  fileType: 'PNG', cover: 'cover-11.svg', seller: 'brand.kim', desc: 'BX 가이드 + 로고 디자인 Midjourney.', tags: ['브랜딩','bx','로고','midjourney'] },
  { id: 'p072', title: 'Google Ads 키워드 그룹 자동 생성 GPT',                      priceKrw: 5600,  fileType: 'PDF', cover: 'cover-12.svg', seller: 'ad.optimizer', desc: 'Google Ads 키워드 그룹 자동 생성.', tags: ['google-ads','키워드','광고','퍼포먼스'] },

  // ── 추가 다양성 (튜토리얼/콘텐츠) ──
  { id: 'p073', title: 'Cursor IDE 단축키 + 워크플로우 마스터북',                   priceKrw: 3700,  fileType: 'PDF', cover: 'cover-01.svg', seller: 'devmate', desc: 'Cursor IDE 단축키 + 워크플로우.', tags: ['cursor','ide','개발','단축키'] },
  { id: 'p074', title: 'Claude Projects 활용 워크북 — 컨텍스트 설계',                priceKrw: 4200,  fileType: 'PDF', cover: 'cover-02.svg', seller: 'claude.expert', desc: 'Claude Projects 컨텍스트 설계.', tags: ['claude','projects','워크북','컨텍스트'] },
  { id: 'p075', title: 'Stable Diffusion ControlNet 활용 가이드',                    priceKrw: 5500,  fileType: 'PNG', cover: 'cover-03.svg', seller: 'illust.studio', desc: 'ControlNet으로 포즈/구도 제어.', tags: ['stable-diffusion','controlnet','이미지','ai'] },
  { id: 'p076', title: 'Whisper 자막 자동 생성 + 번역 워크플로우',                   priceKrw: 4100,  fileType: 'MP4', cover: 'cover-04.svg', seller: 'voice.lab', desc: 'Whisper 자막 + 다국어 번역.', tags: ['whisper','자막','번역','tts'] },
  { id: 'p077', title: 'GPT-5 비교 분석 워크북 — Claude vs Gemini',                   priceKrw: 5800,  fileType: 'PDF', cover: 'cover-05.svg', seller: 'gpt.toolkit', desc: 'GPT-5 vs Claude vs Gemini 벤치마크.', tags: ['gpt-5','claude','gemini','비교'] },
  { id: 'p078', title: 'AI 윤리·저작권 가이드 — 상업 활용 체크리스트',                priceKrw: 3900,  fileType: 'PDF', cover: 'cover-06.svg', seller: 'legal.bot', desc: 'AI 저작권/윤리 상업 활용 체크리스트.', tags: ['윤리','저작권','상업','가이드'] },
  { id: 'p079', title: '온라인 강의 슬라이드 자동 생성 GPT · 6강',                    priceKrw: 8400,  fileType: 'PDF', cover: 'cover-07.svg', seller: 'edu.helper', desc: '온라인 강의 슬라이드 6강 자동.', tags: ['강의','슬라이드','교육','ppt'] },
  { id: 'p080', title: '커리어 면접 모의 — Claude 1:1 코칭 프롬프트',                 priceKrw: 6500,  fileType: 'PDF', cover: 'cover-08.svg', seller: 'hr.toolkit', desc: 'Claude 1:1 면접 코칭 + 피드백.', tags: ['면접','코칭','claude','커리어'] },
];

async function main() {
  const passwordHash = await bcrypt.hash('seedpass', 10);

  // ── Default admin user ─────────────────────────────────────────────────
  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: { isAdmin: true, passwordHash: adminPasswordHash, phoneVerified: true } as any,
    create: {
      username: 'admin',
      passwordHash: adminPasswordHash,
      name: 'AISquare 관리자',
      nickname: '관리자',
      email: 'admin@aisquare.com',
      phone: '01000000000',
      phoneVerified: true,
      isAdmin: true,
    } as any,
  });
  console.log('Default admin user 생성 — username: admin / password: admin123');

  // ── Naver Pay admin user (네이버 관리자 콘솔용) ─────────────────────────
  await prisma.user.upsert({
    where: { username: 'naver-admin' },
    update: { isNaverAdmin: true, passwordHash: adminPasswordHash, phoneVerified: true } as any,
    create: {
      username: 'naver-admin',
      passwordHash: adminPasswordHash,
      name: 'NaverPay 관리자',
      nickname: '네이버페이관리자',
      email: 'naver-admin@aisquare.com',
      phone: '01000000001',
      phoneVerified: true,
      isNaverAdmin: true,
    } as any,
  });
  console.log('NaverPay admin 생성 — username: naver-admin / password: admin123');

  // ── 테스트 일반 사용자 (clone 후 즉시 로그인 + 구매·판매 테스트) ──────
  const testUserHash = await bcrypt.hash('22222222', 10);
  await prisma.user.upsert({
    where: { username: '2222' },
    update: { passwordHash: testUserHash, phoneVerified: true } as any,
    create: {
      username: '2222',
      passwordHash: testUserHash,
      name: '테스트 유저',
      nickname: '2222',
      email: '2222@aisquare.com',
      phone: '01022222222',
      phoneVerified: true,
    } as any,
  });
  console.log('Test user 생성 — username: 2222 / password: 22222222');

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
      update: {
        title: p.title,
        description: p.desc,
        price: p.priceKrw,
        fileType: p.fileType as FileType,
        imageKey: 'assets/' + p.cover,
        tags: p.tags as any,
      },
      create: {
        id: p.id,
        sellerId: sellerById[p.seller],
        title: p.title,
        description: p.desc,
        price: p.priceKrw,
        fileType: p.fileType as FileType,
        fileKey: 'mock/' + p.id,
        imageKey: 'assets/' + p.cover,
        status: ProductStatus.ON_SALE,
        tags: p.tags as any,
      } as any,
    });
  }

  // ── 일부 상품을 SOLD 처리 + 주문/리뷰 시드 ──
  // 데모용 demo buyer 1명 만들고, 그 사람이 상품 일부를 사서 확정 + 리뷰 남긴 상태로
  const buyer = await prisma.user.upsert({
    where: { username: 'demo.buyer' },
    update: {},
    create: {
      username: 'demo.buyer',
      passwordHash,
      name: '데모구매자',
      nickname: '데모바이어',
      email: 'buyer@aisquare.com',
      phone: '01099990000',
      phoneVerified: true,
    } as any,
  });

  // 어떤 상품들을 SOLD로 만들지: 다양한 seller에 걸쳐 12개 정도
  const SOLD_PRODUCTS: { id: string; rating: number; content: string }[] = [
    { id: 'p001', rating: 5, content: 'SNS 광고 카피 50종 진짜 알차요. 톤앤매너 시트가 특히 좋네요.' },
    { id: 'p003', rating: 5, content: '키워드 분석이 한 번에 끝나서 시간 엄청 절약됩니다.' },
    { id: 'p005', rating: 4, content: '시청률 유지율 실제로 올랐어요. 다만 후킹 패턴 더 다양했으면.' },
    { id: 'p006', rating: 5, content: 'Midjourney 프롬프트 퀄리티 최고. 썸네일 클릭률 30% 상승.' },
    { id: 'p009', rating: 5, content: 'Cursor + Claude 워크플로우 그대로 따라했더니 코드리뷰가 자동화됨.' },
    { id: 'p010', rating: 5, content: 'API 문서 자동 생성 너무 편합니다. 팀에 바로 적용.' },
    { id: 'p013', rating: 4, content: '브랜드 톤앤매너 정리 시트가 실무적이에요.' },
    { id: 'p017', rating: 5, content: 'Notion 템플릿 30종 다 써먹을만 합니다.' },
    { id: 'p025', rating: 5, content: 'Figma+MJ 워크플로우 정말 시간 절약됨.' },
    { id: 'p033', rating: 5, content: 'SQL 최적화 100패턴이 진짜 실무 그 자체.' },
    { id: 'p039', rating: 4, content: 'Notion AI 자동화 템플릿 활용도 좋네요.' },
    { id: 'p056', rating: 5, content: '논문 요약/인용 Claude 프롬프트가 학부생한테 최고.' },
  ];

  let seededReviews = 0;
  for (const so of SOLD_PRODUCTS) {
    const prod = await prisma.product.findUnique({ where: { id: so.id } });
    if (!prod) continue;

    // 상품당 order는 unique (1:1). 기존 order 있으면 그것을 CONFIRMED로 승격, 없으면 demo buyer로 새로.
    let order = await prisma.order.findUnique({ where: { productId: so.id } });
    if (!order) {
      if (prod.sellerId === buyer.id) continue;
      try {
        order = await prisma.order.create({
          data: {
            buyerId: buyer.id,
            productId: so.id,
            paymentMethod: 'SQUARE',
            paymentAmount: Math.floor(prod.price * 1.05),
            status: 'CONFIRMED',
            autoConfirmAt: new Date(),
            settledAt: new Date(),
          },
        });
      } catch (e) { continue; }
    } else if (order.status !== 'CONFIRMED') {
      order = await prisma.order.update({
        where: { id: order.id },
        data: { status: 'CONFIRMED', settledAt: new Date() },
      });
    }

    await prisma.product.update({ where: { id: so.id }, data: { status: ProductStatus.SOLD } });

    // 리뷰는 그 주문의 실제 buyer 명의로 (없으면 새로, 있으면 skip)
    const existingReview = await prisma.review.findUnique({ where: { orderId: order.id } }).catch(() => null);
    if (!existingReview) {
      await prisma.review.create({
        data: {
          orderId: order.id,
          productId: so.id,
          reviewerId: order.buyerId,
          rating: so.rating,
          content: so.content,
        },
      });
      seededReviews++;
    }
  }
  console.log(`Marked ${SOLD_PRODUCTS.length} products as SOLD + ${seededReviews} reviews seeded.`);

  console.log(`Seeded ${sellers.length} sellers and ${products.length} products.`);
}

main().finally(() => prisma.$disconnect());
