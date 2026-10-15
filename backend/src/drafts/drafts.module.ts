import { Module } from '@nestjs/common';
import { DraftsController } from './drafts.controller';
import { DraftGeneratorService } from './draft-generator.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [DraftsController],
  providers: [DraftGeneratorService],
})
export class DraftsModule {}
