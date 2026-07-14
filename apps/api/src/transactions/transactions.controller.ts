import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CreateTransactionDto, TransactionFiltersDto, UpdateTransactionDto } from './dto/transaction.dto';
import { TransactionsService } from './transactions.service';

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}

  @Post('preview')
  preview(@Body() dto: CreateTransactionDto): Promise<object> {
    return this.transactions.preview(dto);
  }

  @Post()
  create(
    @Body() dto: CreateTransactionDto,
    @Headers('idempotency-key') idempotencyKey = '',
  ): Promise<object> {
    return this.transactions.create(dto, idempotencyKey);
  }

  @Get()
  list(@Query() filters: TransactionFiltersDto): Promise<object> {
    return this.transactions.list(filters);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string): Promise<object> {
    return this.transactions.get(id);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTransactionDto): Promise<object> {
    return this.transactions.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.transactions.remove(id);
  }
}
