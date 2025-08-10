import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsArray, ValidateNested, IsOptional, IsString, Min, IsPositive, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { IsMultipleOfHundred } from '../../../common/decorator/validation.decorator';

export class OrderProductOptionRequest {
  @ApiProperty({
    description: '상품 옵션 ID',
    example: 1,
  })
  @IsNumber()
  productOptionId: number;

  @ApiProperty({
    description: '주문 수량',
    example: 2,
    minimum: 1,
  })
  @IsNumber()
  @Min(1)
  quantity: number;
}

export class OrderProductRequest {
  @ApiProperty({
    description: '상품 ID',
    example: 1,
  })
  @IsNumber()
  productId: number;

  @ApiProperty({
    description: '주문할 상품 옵션 목록',
    type: [OrderProductOptionRequest],
    example: [
      { productOptionId: 1, quantity: 1 },
      { productOptionId: 2, quantity: 2 },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderProductOptionRequest)
  options: OrderProductOptionRequest[];
}

export class CreateOrderRequest {
  @ApiProperty({
    description: '주문 상품 목록',
    type: [OrderProductRequest],
    example: [
      {
        productId: 1,
        options: [
          { productOptionId: 1, quantity: 1 },
          { productOptionId: 2, quantity: 2 },
        ],
      },
      {
        productId: 2,
        options: [{ productOptionId: 3, quantity: 1 }],
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderProductRequest)
  products: OrderProductRequest[];

  @ApiProperty({
    description: '사용할 잔액 (100원 단위로만 사용 가능)',
    example: 995000,
    minimum: 100,
    multipleOf: 100,
  })
  @IsNumber()
  @IsNotEmpty()
  @IsPositive()
  @Min(100, { message: '사용 금액은 최소 100원 이상이어야 합니다.' })
  @IsMultipleOfHundred({ message: '사용 금액은 100원 단위로만 입력 가능합니다.' })
  usedAmount: number;

  @ApiProperty({
    description: '쿠폰 코드 (선택사항)',
    example: 'ABC12341',
    required: false,
  })
  @IsOptional()
  @IsString()
  couponCode?: string;
}
