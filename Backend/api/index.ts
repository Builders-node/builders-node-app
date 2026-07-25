// Vercel serverless entry for the NestJS API.
// Vercel routes every request here (see vercel.json) and the cached Express
// instance serves it. The app is built once per warm lambda and reused.
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express, { type Express, type Request, type Response } from 'express';
import { AppModule } from '../src/app.module';

let cached: Express | null = null;

async function bootstrap(): Promise<Express> {
  if (cached) return cached;

  const expressApp = express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp));

  const config = app.get(ConfigService);
  const frontendUrl = config.get<string>('FRONTEND_URL') ?? '*';
  app.enableCors({ origin: [frontendUrl], credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  await app.init();
  cached = expressApp;
  return expressApp;
}

export default async function handler(req: Request, res: Response) {
  const server = await bootstrap();
  server(req, res);
}
