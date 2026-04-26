import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { findAvailablePort } from './common/utils/port.util';
import { branding } from './config/branding';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  const isProduction = nodeEnv === 'production';

  // Security headers with Helmet
  app.use(
    helmet({
      contentSecurityPolicy: isProduction
        ? {
            directives: {
              defaultSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", 'data:', 'https:'],
              scriptSrc: ["'self'"],
            },
          }
        : false, // Disable CSP in development for easier debugging
      hsts: isProduction
        ? {
            maxAge: 31536000, // 1 year
            includeSubDomains: true,
            preload: true,
          }
        : false,
      noSniff: true,
      xssFilter: true,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      frameguard: { action: 'deny' },
    }),
  );

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
  const corsOrigins = configService.get<string>('CORS_ORIGINS');

  if (isProduction && !corsOrigins) {
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

  // Swagger/OpenAPI documentation - disabled in production for security
  if (!isProduction) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle(branding.api.title)
      .setDescription(branding.api.description)
      .setVersion(branding.api.version)
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
  }

  const preferredPort = configService.get<number>('PORT', 3000);
  const port = await findAvailablePort(preferredPort);
  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`Application running on port ${port}`);
  if (!isProduction) {
    logger.log(`Swagger documentation available at http://localhost:${port}/api/docs`);
  }
}
bootstrap();
