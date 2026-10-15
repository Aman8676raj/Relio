import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import type { User } from '@prisma/client';
import { Request } from 'express';

export const CurrentUser = createParamDecorator(
  (data: keyof User | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request & { user?: User }>();
    const user = request.user;
    if (!user) return undefined;
    
    return data ? user[data] : user;
  },
);
