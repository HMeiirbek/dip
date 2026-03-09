import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as fs from 'fs';
import * as path from 'path';

async function bootstrap() {
  const certsDir = path.join(__dirname, '..', 'certs');
  const keyPath = path.join(certsDir, 'key.pem');
  const certPath = path.join(certsDir, 'cert.pem');
  const useHttps =
    fs.existsSync(keyPath) && fs.existsSync(certPath);

  const httpsOptions = useHttps
    ? {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath),
      }
    : undefined;

  const app = await NestFactory.create(AppModule, {
    ...(httpsOptions && { httpsOptions }),
  });
  app.useWebSocketAdapter(new IoAdapter(app));
  app.setGlobalPrefix('api/v1');
  const corsOrigins = (process.env.CORS_ORIGIN || '*')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  app.enableCors({
    origin: corsOrigins.length === 1 && corsOrigins[0] === '*' ? true : corsOrigins,
    credentials: true,
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('DIP Backend API')
    .setDescription('HTTP API documentation for DIP signaling backend')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, swaggerDocument, {
    swaggerOptions: { persistAuthorization: true },
    customSiteTitle: 'DIP API Docs',
  });

  await app.listen(3000, '0.0.0.0');
  if (useHttps) {
    console.log('Backend running on https://0.0.0.0:3000');
  }
}
bootstrap();
