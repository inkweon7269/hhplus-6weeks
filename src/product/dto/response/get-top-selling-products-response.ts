import { ApiProperty } from '@nestjs/swagger';
import { TopSellingProductDto } from './top-selling-product.dto';

export class GetTopSellingProductsResponse {
  @ApiProperty({
    description: '인기 상품 목록',
    type: [TopSellingProductDto],
  })
  products: TopSellingProductDto[];

  static from(
    data: Array<{
      productId: number;
      productName: string;
      totalSales: number;
      rank: number;
    }>,
  ): GetTopSellingProductsResponse {
    const response = new GetTopSellingProductsResponse();
    response.products = data.map((item) => TopSellingProductDto.from(item));
    return response;
  }
}
