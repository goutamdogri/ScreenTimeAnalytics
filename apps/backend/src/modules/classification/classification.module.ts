import { Module } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module';
import { ClassificationService } from './classification.service';
import { ClassificationWorkerService } from './classification.worker.service';

@Module({
  imports: [LlmModule],
  providers: [ClassificationService, ClassificationWorkerService],
  exports: [ClassificationService],
})
export class ClassificationModule {}
