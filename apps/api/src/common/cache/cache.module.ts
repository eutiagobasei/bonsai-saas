import { Global, Module } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-ioredis-yet';
import { CacheService } from './cache.service';

@Global()
@Module({
  imports: [
    NestCacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL');

        if (!redisUrl) {
          // Fallback to in-memory cache for development without Redis
          return {
            ttl: 5 * 60 * 1000, // 5 minutes default
            max: 1000, // Maximum number of items in cache
          };
        }

        // Parse Redis URL
        const url = new URL(redisUrl);
        const password = url.password || undefined;
        const host = url.hostname;
        const port = parseInt(url.port, 10) || 6379;

        return {
          store: await redisStore({
            host,
            port,
            password,
            ttl: 5 * 60 * 1000, // 5 minutes default TTL
          }),
        };
      },
    }),
  ],
  providers: [CacheService],
  exports: [CacheService, NestCacheModule],
})
export class CacheModule {}
