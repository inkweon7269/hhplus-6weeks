import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus } from '../../enum/order-status.enum';

export class OrderItemResponse {
  @ApiProperty({
    description: '상품 ID',
    example: 1,
  })
  productId: number;

  @ApiProperty({
    description: '상품명',
    example: '스마트폰',
  })
  name: string;

  @ApiProperty({
    description: '상품 가격',
    example: 800000,
  })
  price: number;

  @ApiProperty({
    description: '주문 수량',
    example: 1,
  })
  quantity: number;
}

export class CreateOrderResponse {
  @ApiProperty({
    description: '주문 ID',
    example: 1,
  })
  orderId: number;

  @ApiProperty({
    description: '주문 생성 시간',
    example: '2025-01-27 14:30:00',
  })
  createdAt: string;

  @ApiProperty({
    description: '주문 상품 목록',
    type: [OrderItemResponse],
  })
  items: OrderItemResponse[];

  @ApiProperty({
    description: '총 주문 금액',
    example: 1000000,
  })
  totalAmount: number;

  @ApiProperty({
    description: '할인 금액',
    example: 5000,
  })
  discountAmount: number;

  @ApiProperty({
    description: '최종 결제 금액',
    example: 995000,
  })
  finalAmount: number;

  @ApiProperty({
    description: '주문 상태',
    enum: OrderStatus,
    example: OrderStatus.CONFIRMED,
  })
  status: OrderStatus;

  @ApiProperty({
    description: '사용된 쿠폰 코드',
    example: 'ABC12341',
    nullable: true,
  })
  couponCode: string | null;
}
