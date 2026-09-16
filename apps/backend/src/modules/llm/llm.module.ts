import { Module } from '@nestjs/common';
import { LlmConfigService } from './llm-config.service';
import { LlmProvidersService } from './llm-providers.service';
import { LlmController } from './llm.controller';

@Module({
  controllers: [LlmController],
  providers: [LlmConfigService, LlmProvidersService],
  exports: [LlmConfigService, LlmProvidersService],
})
export class LlmModule {}
