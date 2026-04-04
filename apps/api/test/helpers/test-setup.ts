import { PrismaService } from '../../src/common/database/prisma.service';

// Global test setup
beforeAll(async () => {
  // Set test environment
  process.env.NODE_ENV = 'test';
});

// Global cleanup helper
export async function cleanDatabase(prisma: PrismaService): Promise<void> {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('cleanDatabase can only be called in test environment');
  }
  await prisma.cleanDatabase();
}

// Increase timeout for async operations
jest.setTimeout(30000);
