import { Module } from '@nestjs/common';
import { TransactionEvaluator } from './transaction-evaluator.service';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';

@Module({
  controllers: [TransactionsController],
  providers: [TransactionEvaluator, TransactionsService],
  exports: [TransactionEvaluator, TransactionsService],
})
export class TransactionsModule {}
