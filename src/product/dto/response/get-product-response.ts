import { ApiProperty } from '@nestjs/swagger';
import { ProductEntity } from '../../domain/product.entity';
import { ProductOptionEntity } from '../../domain/product-option.entity';

export class ProductOptionResponse {
  @ApiProperty({
    description: '옵션 ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: '옵션명',
    example: '128GB',
  })
  name: string;

  @ApiProperty({
    description: '가격',
    example: 800000,
  })
  price: number;

  @ApiProperty({
    description: '재고 수량',
    example: 50,
  })
  stock: number;

  static of(entity: ProductOptionEntity): ProductOptionResponse {
    const response = new ProductOptionResponse();

    response.id = entity.id;
    response.name = entity.name;
    response.price = entity.price;
    response.stock = entity.stock;

    return response;
  }
}

export class GetProductResponse {
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

  @ApiProperty({
    description: '상품 옵션 목록',
    type: [ProductOptionResponse],
  })
  productOptions: ProductOptionResponse[];

  static of(entity: ProductEntity): GetProductResponse {
    const response = new GetProductResponse();

    response.id = entity.id;
    response.name = entity.name;
    response.productOptions = entity.productOptions.map(ProductOptionResponse.of);

    return response;
  }
}
