import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  // Larger bodies for base64 proof uploads (default is 100 kb).
  app.use(json({ limit: '5mb' }));
  app.use(urlencoded({ extended: true, limit: '5mb' }));
  const config = app.get(ConfigService);

  const allowlist = [
    config.get<string>('FRONTEND_URL'),
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
  ].filter(Boolean) as string[];
  app.enableCors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      let host = '';
      try {
        host = new URL(origin).hostname;
      } catch {
        return cb(null, false);
      }
      cb(null, allowlist.includes(origin) || host === 'vercel.app' || host.endsWith('.vercel.app'));
    },
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // Bind to all interfaces by default so the server is reachable inside a
  // container / on a host. Set HOST=127.0.0.1 to restrict to loopback locally.
  const host = config.get<string>('HOST') ?? '0.0.0.0';
  await app.listen(config.get<number>('PORT') ?? 3000, host);
}

void bootstrap();
