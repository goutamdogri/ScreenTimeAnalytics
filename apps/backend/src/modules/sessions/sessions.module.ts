import { Module } from '@nestjs/common';
import { GamificationModule } from '../gamification/gamification.module';
import { SessionFinalizerWorkerService } from './session-finalizer.worker.service';
import { SessionsFinalizerService } from './sessions.finalizer.service';

@Module({
  imports: [GamificationModule],
  providers: [SessionsFinalizerService, SessionFinalizerWorkerService],
  exports: [SessionsFinalizerService],
})
export class SessionsModule {}
