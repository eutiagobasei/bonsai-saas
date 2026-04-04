import { Global, Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { LoggerService } from './logger.service';
import { CorrelationIdMiddleware } from './correlation-id.middleware';

@Global()
@Module({
  providers: [LoggerService],
  exports: [LoggerService],
})
export class LoggingModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
