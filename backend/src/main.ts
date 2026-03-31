import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Log JWT configuration
  const jwtSecretConfigured = !!process.env.JWT_SECRET;
  const jwtSecretLength = (process.env.JWT_SECRET || 'secret').length;
  console.log('=== JWT Configuration ===');
  console.log('JWT_SECRET configured:', jwtSecretConfigured);
  console.log('JWT secret length:', jwtSecretLength);
  if (!jwtSecretConfigured) {
    console.warn('WARNING: JWT_SECRET environment variable is not set. Using default "secret".');
  }
  
  app.useWebSocketAdapter(new IoAdapter(app));
  app.setGlobalPrefix('api/v1');
  const corsOriginEnv = process.env.CORS_ORIGIN?.trim();
  const corsOrigins = (() => {
    if (!corsOriginEnv) return true;
    const origins = corsOriginEnv.split(',').map((v) => v.trim()).filter(Boolean);
    return origins.length === 1 && origins[0] === '*' ? true : origins;
  })();
  const corsOptions = {
    origin: corsOrigins,                                                  
    credentials: true,                                                            
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Origin'],
    exposedHeaders: ['Authorization'],
  };
  app.enableCors(corsOptions);
  console.log(`CORS origins: ${JSON.stringify(corsOrigins)}`);

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
