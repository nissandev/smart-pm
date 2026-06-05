import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { join } from 'path';
import { mkdirSync } from 'fs';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Global prefix
  app.setGlobalPrefix('api', { exclude: ['uploads/(.*)'] });

  // Static file serving for task attachments — relative to repo root /app/uploads
  const uploadsDir = join(process.cwd(), 'uploads');
  mkdirSync(uploadsDir, { recursive: true });
  app.useStaticAssets(uploadsDir, { prefix: '/uploads/' });

  // CORS — supports multiple origins via comma-separated FRONTEND_URL.
  // e.g. FRONTEND_URL=https://web-smart-pm.com,https://smartpm.nexarift.com,http://localhost:3000
  // A bare "*" makes the API public (use only for demos).
  // Comparison is case-insensitive on the host portion because browsers
  // always send the Origin header lowercased, even if VITE_API_URL/site
  // URL was configured with mixed case.
  const normalizeOrigin = (raw: string) => raw.trim().toLowerCase().replace(/\/$/, '');

  const rawOrigins = process.env.FRONTEND_URL || 'http://localhost:3000';
  const allowedOrigins = rawOrigins
    .split(',')
    .map(normalizeOrigin)
    .filter(Boolean);

  app.enableCors({
    origin: (origin, cb) => {
      // Same-origin requests (curl, Postman, server-to-server) have no `origin` header.
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes('*')) return cb(null, true);
      if (allowedOrigins.includes(normalizeOrigin(origin))) return cb(null, true);
      return cb(new Error(`Origin ${origin} not allowed by CORS`), false);
    },
    credentials: true,
  });

  console.log(`🛡️  CORS allowed origins: ${allowedOrigins.join(', ') || '(none)'}`);

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger API docs
  const config = new DocumentBuilder()
    .setTitle('Smart PM API')
    .setDescription('Smart Project & Task Collaboration System API')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`🚀 Backend running on http://localhost:${port}/api`);
  console.log(`📚 Swagger docs at http://localhost:${port}/api/docs`);
}
bootstrap();
