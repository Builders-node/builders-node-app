// Vercel serverless entry for the NestJS API.
// Vercel routes every request here (see vercel.json) and the cached Express
// instance serves it. The app is built once per warm lambda and reused.
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express, { json, urlencoded, type Express, type Request, type Response } from 'express';
import { AppModule } from '../src/app.module';
import { applyGlobalConfig, BODY_LIMIT } from '../src/app-setup';

let cached: Express | null = null;

async function bootstrap(): Promise<Express> {
  if (cached) return cached;

  const expressApp = express();
  // Larger bodies for base64 proof uploads (default is 100 kb).
  expressApp.use(json({ limit: BODY_LIMIT }));
  expressApp.use(urlencoded({ extended: true, limit: BODY_LIMIT }));
  const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp), { bodyParser: false });

  const config = app.get(ConfigService);
  applyGlobalConfig(app, config);

  await app.init();
  cached = expressApp;
  return expressApp;
}

export default async function handler(req: Request, res: Response) {
  const server = await bootstrap();
  server(req, res);
}
