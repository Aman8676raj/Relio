import { Module } from '@nestjs/common';
import { InvestorDatabaseController } from './investor-database.controller';
import { InvestorDatabaseService } from './investor-database.service';

@Module({
  controllers: [InvestorDatabaseController],
  providers: [InvestorDatabaseService],
  exports: [InvestorDatabaseService],
})
export class InvestorDatabaseModule {}
