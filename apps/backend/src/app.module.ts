import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import configuration from './config/configuration';
import { envFilePaths } from './config/env-paths';
import { validateEnvironment } from './config/validation';
import { AuthModule } from './modules/auth/auth.module';
import { DevicesModule } from './modules/devices/devices.module';
import { EventsModule } from './modules/events/events.module';
import { CryptoModule } from './modules/crypto/crypto.module';
import { LlmModule } from './modules/llm/llm.module';
import { ClassificationModule } from './modules/classification/classification.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { GamificationModule } from './modules/gamification/gamification.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { PrismaModule } from './modules/prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnvironment,
      envFilePath: envFilePaths,
      cache: true,
    }),
    PrismaModule,
    CryptoModule,
    AuthModule,
    DevicesModule,
    ClassificationModule,
    LlmModule,
    EventsModule,
    DashboardModule,
    GamificationModule,
    SessionsModule,
  ],
  controllers: [AppController],
  providers: [AppService, ConfigService],
})
export class AppModule {}
