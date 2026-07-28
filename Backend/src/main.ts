import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { applyGlobalConfig, BODY_LIMIT } from './app-setup';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  // Larger bodies for base64 proof uploads (default is 100 kb).
  app.use(json({ limit: BODY_LIMIT }));
  app.use(urlencoded({ extended: true, limit: BODY_LIMIT }));

  const config = app.get(ConfigService);
  applyGlobalConfig(app, config);

  // Bind to all interfaces by default so the server is reachable inside a
  // container / on a host. Set HOST=127.0.0.1 to restrict to loopback locally.
  const host = config.get<string>('HOST') ?? '0.0.0.0';
  await app.listen(config.get<number>('PORT') ?? 3000, host);
}

void bootstrap();
