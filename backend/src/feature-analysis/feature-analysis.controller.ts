import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Sse,
  ParseUUIDPipe,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Observable, map, startWith } from 'rxjs';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { FeatureAnalysisService, PipelineEvent } from './feature-analysis.service';
import { CreateAnalysisDto } from './dto/create-analysis.dto';
import { CreateFounderProfileDto } from './dto/create-founder-profile.dto';
import type { User } from '@prisma/client';

@ApiTags('feature-analysis')
@Controller('api/feature-analysis')
@SkipThrottle() // AI pipeline calls take 15-60s — throttle would cause false 429s
@Roles() // any authenticated org member can access
export class FeatureAnalysisController {
  constructor(private readonly svc: FeatureAnalysisService) {}

  // ─── Founder Profile ──────────────────────────────────────────────────────

  @Post('profile')
  @Roles('owner', 'contributor')
  @ApiOperation({ summary: 'Create or update founder profile (upsert)' })
  @ApiResponse({ status: 200, description: 'Profile saved' })
  async upsertProfile(
    @Body() dto: CreateFounderProfileDto,
    @CurrentUser() user: User,
  ) {
    return this.svc.upsertFounderProfile(user.id, dto);
  }

  @Get('profile')
  @ApiOperation({ summary: 'Get current founder profile' })
  async getProfile(@CurrentUser() user: User) {
    return this.svc.getFounderProfile(user.id);
  }

  // ─── Feature Analysis ─────────────────────────────────────────────────────

  @Post()
  @Roles('owner', 'contributor')
  @ApiOperation({
    summary:
      'Submit a feature for analysis — returns analysisId immediately. Use GET /:id/stream to watch progress.',
  })
  @ApiResponse({
    status: 201,
    description: 'Pending analysis created. Pipeline runs asynchronously.',
  })
  async analyze(@Body() dto: CreateAnalysisDto, @CurrentUser() user: User) {
    // 1. Create pending record (fast — DB only)
    const record = await this.svc.createPendingAnalysis(user.id, dto);

    // 2. Fire-and-forget: kick off the pipeline in the background
    //    Intentionally NOT awaited — the SSE stream will deliver results
    this.svc.runPipeline(record.id, user.id, dto);

    return { analysisId: record.id, status: 'pending' };
  }

  @Get(':id/stream')
  @Sse()
  @ApiOperation({
    summary: 'SSE stream for real-time pipeline progress',
    description:
      'Opens a Server-Sent Events stream. Emits stage_start, stage_done, stage_timeout, complete, or failed events.',
  })
  streamAnalysis(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Observable<MessageEvent> {
    const subject = this.svc.getStream(id);

    if (!subject) {
      // Pipeline already finished or ID is invalid — check DB for the result
      // Return an observable that queries the DB and emits either the result or an error
      return new Observable<MessageEvent>((subscriber) => {
        this.svc
          .getByIdDirect(id)
          .then((record) => {
            if (!record) {
              subscriber.next({
                data: JSON.stringify({
                  type: 'failed',
                  detail: 'Analysis not found',
                }),
              } as MessageEvent);
              subscriber.complete();
              return;
            }
            if (record.status === 'complete') {
              subscriber.next({
                data: JSON.stringify({
                  type: 'complete',
                  result: record,
                }),
              } as MessageEvent);
            } else if (record.status === 'failed') {
              subscriber.next({
                data: JSON.stringify({
                  type: 'failed',
                  detail: record.errorMessage || 'Pipeline failed',
                }),
              } as MessageEvent);
            } else {
              subscriber.next({
                data: JSON.stringify({
                  type: 'failed',
                  detail: 'Pipeline stream not found — it may have already completed. Refresh to see results.',
                }),
              } as MessageEvent);
            }
            subscriber.complete();
          })
          .catch(() => {
            subscriber.next({
              data: JSON.stringify({
                type: 'failed',
                detail: 'Analysis not found',
              }),
            } as MessageEvent);
            subscriber.complete();
          });
      });
    }

    // Pipe the Subject into SSE MessageEvents
    return subject.asObservable().pipe(
      startWith({
        type: 'connected',
        detail: 'SSE stream connected — pipeline is running',
      } as PipelineEvent),
      map(
        (event: PipelineEvent) =>
          ({
            data: JSON.stringify(event),
          }) as MessageEvent,
      ),
    );
  }

  @Get()
  @ApiOperation({ summary: 'List all completed feature analyses for the logged-in founder' })
  async list(@CurrentUser() user: User) {
    return this.svc.listForUser(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Fetch a single feature analysis by ID' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async getOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: User,
  ) {
    return this.svc.getById(id, user.id);
  }
}
