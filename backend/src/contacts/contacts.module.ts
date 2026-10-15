import { Module } from '@nestjs/common';
import { ContactsController } from './contacts.controller';
import { ContactBriefingService } from './contact-briefing.service';
import { IntroPathService } from './intro-path.service';
import { PrismaModule } from '../prisma';

@Module({
  imports: [PrismaModule],
  controllers: [ContactsController],
  providers: [ContactBriefingService, IntroPathService],
  exports: [IntroPathService],
})
export class ContactsModule {}
