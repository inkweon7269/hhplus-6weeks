import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber } from 'class-validator';

export class GetProductsRequest {
  @ApiProperty({
    description: '페이지 번호',
    example: 1,
    minimum: 1,
  })
  @IsNumber()
  @IsNotEmpty()
  page: number;

  @ApiProperty({
    description: '페이지당 상품 수',
    example: 10,
    minimum: 1,
    maximum: 100,
  })
  @IsNumber()
  @IsNotEmpty()
  limit: number;
}
