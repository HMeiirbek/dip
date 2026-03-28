import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
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

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`Application is running on port ${port}`);
}
bootstrap();
