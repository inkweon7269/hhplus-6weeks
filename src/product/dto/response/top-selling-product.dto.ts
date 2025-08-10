import { ApiProperty } from '@nestjs/swagger';

export class TopSellingProductDto {
  @ApiProperty({
    description: '상품 ID',
    example: 1,
  })
  productId: number;

  @ApiProperty({
    description: '상품명',
    example: '베스트 상품',
  })
  productName: string;

  @ApiProperty({
    description: '총 판매 수량',
    example: 150,
  })
  totalSales: number;

  @ApiProperty({
    description: '순위',
    example: 1,
  })
  rank: number;

  static from(data: {
    productId: number;
    productName: string;
    totalSales: number;
    rank: number;
  }): TopSellingProductDto {
    const response = new TopSellingProductDto();

    response.productId = data.productId;
    response.productName = data.productName;
    response.totalSales = data.totalSales;
    response.rank = data.rank;

    return response;
  }
}
