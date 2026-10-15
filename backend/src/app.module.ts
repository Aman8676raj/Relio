import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { OrgRolesGuard } from './auth/org-roles.guard';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma';
import { AuthModule } from './auth/auth.module';
import { ContactsModule } from './contacts/contacts.module';
import { DraftsModule } from './drafts/drafts.module';
import { PipelineModule } from './pipeline/pipeline.module';
import { GmailModule } from './gmail/gmail.module';
import { WarmthModule } from './warmth/warmth.module';
import { QueueModule } from './queue/queue.module';
import { DigestModule } from './digest/digest.module';
import { SettingsModule } from './settings/settings.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { InvestorDatabaseModule } from './investor-database/investor-database.module';
import { DiscoveryModule } from './discovery/discovery.module';
import { SequenceModule } from './sequence/sequence.module';
import { ForecastingModule } from './forecasting/forecasting.module';
import { SentimentModule } from './sentiment/sentiment.module';
import { MeetingsModule } from './meetings/meetings.module';
import { DiagnosticsModule } from './diagnostics/diagnostics.module';
import { WorkspaceModule } from './workspace/workspace.module';
import { DecksModule } from './decks/decks.module';
import { HealthModule } from './health/health.module';
import { FeatureAnalysisModule } from './feature-analysis/feature-analysis.module';
import { BillingModule } from './billing/billing.module';
import { OnboardingModule } from './onboarding/onboarding.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env'],
    }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests/min — covers browsing-heavy pages
      },
      {
        name: 'auth',
        ttl: 60000,
        limit: 60, // 60/min — tight for login/token endpoints
      },
    ]),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
      },
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    ContactsModule,
    DraftsModule,
    PipelineModule,
    GmailModule,
    WarmthModule,
    QueueModule,
    DigestModule,
    SettingsModule,
    DashboardModule,
    InvestorDatabaseModule,
    DiscoveryModule,
    SequenceModule,
    ForecastingModule,
    SentimentModule,
    MeetingsModule,
    DiagnosticsModule,
    WorkspaceModule,
    DecksModule,
    HealthModule,
    FeatureAnalysisModule,
    BillingModule,
    OnboardingModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: OrgRolesGuard,
    },
  ],
})
export class AppModule {}
