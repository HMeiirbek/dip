import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as fs from 'fs';
import * as path from 'path';

async function bootstrap() {
  const certPath = path.join(process.cwd(), 'certs');
  const keyPath = path.join(certPath, 'key.pem');
  const certFilePath = path.join(certPath, 'cert.pem');
  const httpsOptions =
    fs.existsSync(keyPath) && fs.existsSync(certFilePath)
      ? {
          key: fs.readFileSync(keyPath),
          cert: fs.readFileSync(certFilePath),
        }
      : undefined;

  const app = await NestFactory.create(AppModule, {
    ...(httpsOptions && { httpsOptions }),
  });
  app.useWebSocketAdapter(new IoAdapter(app));
  app.setGlobalPrefix('api/v1');
  app.enableCors();

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

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`Application is running on port ${port}`);
}
bootstrap();
