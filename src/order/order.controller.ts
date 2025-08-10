import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

import { UserId } from '../common/decorator/user-id.decorator';
import { OrderFacade } from './order.facade';
import { CreateOrderRequest } from './dto/request/create-order-request';
import { CreateOrderResponse } from './dto/response/create-order-response';

@ApiTags('주문 / 결제 관리')
@Controller('orders')
export class OrderController {
  constructor(private readonly orderFacade: OrderFacade) {}

  @ApiOperation({
    summary: '사용자의 주문 생성 및 결제',
    description: '로그인한 사용자가 상품을 주문하고 결제를 수행합니다. 사용자의 잔액에서 결제 금액을 차감합니다.',
  })
  @ApiResponse({
    status: 201,
    description: '주문 생성 및 결제 성공',
    type: CreateOrderResponse,
  })
  @Post()
  async pay(@UserId() userId: number, @Body() request: CreateOrderRequest) {
    return await this.orderFacade.pay(userId, request);
  }
}
