import { Global, Module } from '@nestjs/common';
import { CryptoService } from './crypto.service';

/**
 * Application-level encryption for secrets at rest (design doc §3.3). AES-256-GCM
 * with a master key from the environment. Decryption happens only in memory at
 * the moment a secret is used; plaintext is never logged or returned.
 */
@Global()
@Module({
  providers: [CryptoService],
  exports: [CryptoService],
})
export class CryptoModule {}
