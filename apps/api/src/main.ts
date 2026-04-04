import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);

  // Cookie parser middleware
  app.use(cookieParser());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // CORS configuration
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  const corsOrigins = configService.get<string>('CORS_ORIGINS');

  if (nodeEnv === 'production' && !corsOrigins) {
    throw new Error(
      'CORS_ORIGINS environment variable must be set in production. ' +
      'Example: CORS_ORIGINS=https://example.com,https://www.example.com'
    );
  }

  // In production, always use explicit origins; in development, allow wildcard as fallback
  const allowedOrigins = corsOrigins
    ? corsOrigins.split(',').map((origin) => origin.trim())
    : ['http://localhost:3001']; // Development default

  app.enableCors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  // API prefix
  app.setGlobalPrefix('api', {
    exclude: ['health'],
  });

  // Swagger/OpenAPI documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('My SaaS API')
    .setDescription('Multi-tenant SaaS API with authentication and authorization')
    .setVersion('1.1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('auth', 'Authentication endpoints')
    .addTag('users', 'User management endpoints')
    .addTag('tenants', 'Tenant management endpoints')
    .addTag('health', 'Health check endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);

  console.log(`Application running on port ${port}`);
  console.log(`Swagger documentation available at http://localhost:${port}/api/docs`);
}
bootstrap();
