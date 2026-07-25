import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  const frontendUrl = config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';
  app.enableCors({
    origin: [frontendUrl, 'http://localhost:5173', 'http://localhost:5174', 'http://127.0.0.1:5173', 'http://127.0.0.1:5174'],
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
