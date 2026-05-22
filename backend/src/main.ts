import 'reflect-metadata';
// .env 자동 로드 — `npm run start:dev` 등 어떤 방식으로 띄워도 DATABASE_URL/TOSS_*/FABRIC_* 인식
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useStaticAssets(join(__dirname, '..', 'test'), { prefix: '/test' });

  // ── 정적 프론트엔드 동시 서빙 (단일 터널/도메인으로 풀스택 노출) ────────
  // ../../frontend  ← repo의 frontend 디렉토리
  // SERVE_FRONTEND=false 환경변수로 끄기 가능
  if (process.env.SERVE_FRONTEND !== 'false') {
    const feDir = join(__dirname, '..', '..', 'frontend');
    app.useStaticAssets(feDir, { index: ['index.html'] });
    console.log(`Frontend static 서빙: ${feDir}`);
  }

  // CORS — localhost 어떤 포트든 허용 + .env의 FRONTEND_URL 추가 허용
  // (정적 프론트(8000), Vite(5173), Next(3000 등) 모두 커버)
  const allowList = (process.env.FRONTEND_URL || 'http://localhost:8000,http://localhost:5173,http://localhost:3000,http://127.0.0.1:8000,http://127.0.0.1:5173')
    .split(',').map(s => s.trim()).filter(Boolean);
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowList.includes(origin)) return callback(null, true);
      // localhost / 127.0.0.1 (개발)
      if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return callback(null, true);
      // cloudflare quick tunnel (*.trycloudflare.com)
      if (/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(origin)) return callback(null, true);
      // ngrok / loca.lt / serveo 같은 다른 터널들도 허용
      if (/^https:\/\/[a-z0-9-]+\.(ngrok\.io|ngrok-free\.app|loca\.lt|serveo\.net)$/.test(origin)) return callback(null, true);
      callback(new Error('CORS: origin not allowed → ' + origin), false);
    },
    credentials: true,
    exposedHeaders: ['Content-Disposition', 'Content-Type', 'Content-Length'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Recode AI API')
    .setDescription('Web3 AI Marketplace Backend API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Recode AI Backend running on http://localhost:${port}`);
  console.log(`Swagger docs: http://localhost:${port}/api/docs`);
}

bootstrap();
