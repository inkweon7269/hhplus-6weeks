import { Controller, Get, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

import { UserId } from '../common/decorator/user-id.decorator';
import { BalanceFacade } from './balance.facade';
import { BalanceRechargeRequest } from './dto/request/balance-recharge-request';
import { BalanceResponse } from './dto/response/balance-response';

@ApiTags('잔액 관리')
@Controller('balances')
export class BalanceController {
  constructor(private readonly balanceFacade: BalanceFacade) {}

  @ApiOperation({
    summary: '잔액 충전',
    description: '사용자의 잔액을 충전합니다. 신규 사용자의 잔액은 0원입니다.',
  })
  @ApiResponse({
    status: 200,
    description: '잔액 충전 성공',
  })
  @Post('recharge')
  async rechargeBalance(@UserId() userId: number, @Body() request: BalanceRechargeRequest) {
    await this.balanceFacade.rechargeBalance(userId, request);
  }

  @ApiOperation({
    summary: '잔액 조회',
    description: '사용자의 현재 잔액을 조회합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '잔액 조회 성공',
    type: BalanceResponse,
  })
  @Get()
  async getBalance(@UserId() userId: number): Promise<BalanceResponse> {
    return await this.balanceFacade.getBalance(userId);
  }
}
