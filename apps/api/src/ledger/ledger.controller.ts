import { Controller, Get, Query } from '@nestjs/common';
import { PeriodQueryDto } from '../transactions/dto/transaction.dto';
import { LedgerService } from './ledger.service';

@Controller('ledger')
export class LedgerController {
  constructor(private readonly ledger: LedgerService) {}

  @Get('summary')
  summary(@Query() query: PeriodQueryDto): Promise<object> {
    return this.ledger.summary(query);
  }

  @Get('pulse')
  pulse(@Query() query: PeriodQueryDto): Promise<object> {
    return this.ledger.pulse(query);
  }

  @Get('timeline')
  timeline(@Query() query: PeriodQueryDto): Promise<object> {
    return this.ledger.timeline(query);
  }
}
