import { Global, Module } from '@nestjs/common';
import { SecretsService } from './secrets.service';
import { EncryptionService } from './encryption.service';

@Global()
@Module({
  providers: [SecretsService, EncryptionService],
  exports: [SecretsService, EncryptionService],
})
export class SecurityModule {}
