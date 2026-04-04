import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { PrismaService } from '../../src/common/database/prisma.service';
import { AppModule } from '../../src/app.module';
import * as cookieParser from 'cookie-parser';

/**
 * Test application builder with configured database
 */
export class TestAppBuilder {
  private moduleFixture: TestingModule | null = null;
  private app: INestApplication | null = null;
  private prisma: PrismaService | null = null;

  async build(): Promise<INestApplication> {
    this.moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    this.app = this.moduleFixture.createNestApplication();

    // Apply same configuration as main.ts
    this.app.use(cookieParser());
    this.app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );
    this.app.setGlobalPrefix('api', {
      exclude: ['health'],
    });

    await this.app.init();

    this.prisma = this.moduleFixture.get<PrismaService>(PrismaService);

    return this.app;
  }

  getApp(): INestApplication {
    if (!this.app) {
      throw new Error('App not initialized. Call build() first.');
    }
    return this.app;
  }

  getPrisma(): PrismaService {
    if (!this.prisma) {
      throw new Error('Prisma not initialized. Call build() first.');
    }
    return this.prisma;
  }

  async cleanDatabase(): Promise<void> {
    if (this.prisma) {
      await this.prisma.cleanDatabase();
    }
  }

  async close(): Promise<void> {
    if (this.app) {
      await this.app.close();
    }
  }
}

/**
 * Create a test application with full setup
 */
export async function createTestApp(): Promise<{
  app: INestApplication;
  prisma: PrismaService;
  cleanup: () => Promise<void>;
}> {
  const builder = new TestAppBuilder();
  const app = await builder.build();
  const prisma = builder.getPrisma();

  return {
    app,
    prisma,
    cleanup: async () => {
      await builder.cleanDatabase();
      await builder.close();
    },
  };
}
