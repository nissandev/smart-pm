import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { join } from 'path';
import { mkdirSync } from 'fs';
import { AppModule } from './app.module';

async function bootstrap() {
  if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET must be set when NODE_ENV=production');
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
    }),
  );

  // Global prefix — uploads are served only via authenticated /api/tasks/.../download
  app.setGlobalPrefix('api');

  // Ensure upload directory exists (files are not publicly served)
  const uploadsDir = join(process.cwd(), 'uploads');
  mkdirSync(uploadsDir, { recursive: true });

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

  // Swagger API docs (disable in production unless explicitly enabled)
  if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_SWAGGER === 'true') {
    const config = new DocumentBuilder()
    .setTitle('Smart PM API')
    .setDescription('Smart Project & Task Collaboration System API')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`🚀 Backend running on http://localhost:${port}/api`);
  console.log(`📚 Swagger docs at http://localhost:${port}/api/docs`);
}
bootstrap();
