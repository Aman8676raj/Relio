import { SetMetadata } from '@nestjs/common';

/**
 * Mark a route as public — bypasses the global JwtAuthGuard.
 * Use on auth endpoints, tracking pixels, public deck views, etc.
 */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
