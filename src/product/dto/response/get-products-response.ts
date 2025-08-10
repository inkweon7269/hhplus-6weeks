import { ApiProperty } from '@nestjs/swagger';
import { ProductEntity } from '../../domain/product.entity';

export class ProductResponse {
  @ApiProperty({
    description: '상품 ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: '상품명',
    example: '스마트폰',
  })
  name: string;

  static of(entity: ProductEntity): ProductResponse {
    const response = new ProductResponse();

    response.id = entity.id;
    response.name = entity.name;

    return response;
  }
}

export class GetProductsResponse {
  @ApiProperty({
    description: '상품 목록',
    type: [ProductResponse],
  })
  list: ProductResponse[];

  @ApiProperty({
    description: '전체 상품 수',
    example: 5,
  })
  totalCount: number;

  @ApiProperty({
    description: '현재 페이지',
    example: 1,
  })
  currentPage: number;

  @ApiProperty({
    description: '전체 페이지 수',
    example: 1,
  })
  totalPages: number;
}
