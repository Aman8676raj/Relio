import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request>();
    const { method, url } = req;
    const userAgent = req.get('user-agent') || '-';
    const now = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const res = ctx.getResponse<Response>();
          const duration = Date.now() - now;
          this.logger.log(
            `${method} ${url} ${res.statusCode} ${duration}ms - ${userAgent}`,
          );
        },
        error: () => {
          const duration = Date.now() - now;
          this.logger.warn(
            `${method} ${url} ERR ${duration}ms - ${userAgent}`,
          );
        },
      }),
    );
  }
}
