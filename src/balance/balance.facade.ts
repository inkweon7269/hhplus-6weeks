import { Injectable } from '@nestjs/common';
import { BalanceService } from './balance.service';
import { BalanceRechargeRequest } from './dto/request/balance-recharge-request';
import { BalanceResponse } from './dto/response/balance-response';

@Injectable()
export class BalanceFacade {
  constructor(private readonly balanceService: BalanceService) {}

  async getBalance(userId: number) {
    const userBalance = await this.balanceService.getBalance(userId);
    return BalanceResponse.of(userBalance);
  }

  async rechargeBalance(userId: number, request: BalanceRechargeRequest) {
    await this.balanceService.rechargeBalance(userId, request);
  }
}
