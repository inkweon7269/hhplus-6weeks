import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BalanceController } from './balance.controller';
import { BalanceService } from './balance.service';
import { BalanceFacade } from './balance.facade';
import { BalanceRepository } from './domain/balance.repository';
import { BalanceEntity } from './domain/balance.entity';
import { BALANCE_REPOSITORY } from './domain/balance.repository.interface';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [TypeOrmModule.forFeature([BalanceEntity]), RedisModule],
  controllers: [BalanceController],
  providers: [
    {
      provide: BALANCE_REPOSITORY,
      useClass: BalanceRepository,
    },
    BalanceService,
    BalanceFacade,
  ],
  exports: [BALANCE_REPOSITORY, BalanceService, BalanceFacade],
})
export class BalanceModule {}
