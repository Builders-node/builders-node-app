// Vercel serverless entry for the NestJS API.
// Vercel routes every request here (see vercel.json) and the cached Express
// instance serves it. The app is built once per warm lambda and reused.
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express, { json, urlencoded, type Express, type Request, type Response } from 'express';
import { AppModule } from '../src/app.module';

let cached: Express | null = null;

async function bootstrap(): Promise<Express> {
  if (cached) return cached;

  const expressApp = express();
  // Larger bodies for base64 proof uploads (default is 100 kb).
  expressApp.use(json({ limit: '5mb' }));
  expressApp.use(urlencoded({ extended: true, limit: '5mb' }));
  const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp), { bodyParser: false });

  const config = app.get(ConfigService);
  const allowlist = [
    config.get<string>('FRONTEND_URL'),
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
  ].filter(Boolean) as string[];

  app.enableCors({
    // Allow the configured frontend, localhost dev, and any *.vercel.app deploy
    // (covers the web project + preview URLs) without brittle env coupling.
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      let host = '';
      try {
        host = new URL(origin).hostname;
      } catch {
        return cb(null, false);
      }
      const ok =
        allowlist.includes(origin) ||
        host === 'vercel.app' ||
        host.endsWith('.vercel.app') ||
        host === 'buildersnode.com' ||
        host.endsWith('.buildersnode.com');
      cb(null, ok);
    },
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  await app.init();
  cached = expressApp;
  return expressApp;
}

export default async function handler(req: Request, res: Response) {
  const server = await bootstrap();
  server(req, res);
}
