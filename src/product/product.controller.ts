import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

import { GetProductsRequest } from './dto/request/get-products-request';
import { GetProductsResponse } from './dto/response/get-products-response';
import { GetProductResponse } from './dto/response/get-product-response';
import { GetTopSellingProductsResponse } from './dto/response/get-top-selling-products-response';
import { ProductFacade } from './product.facade';

@ApiTags('상품 관리')
@Controller('products')
export class ProductController {
  constructor(private readonly productFacade: ProductFacade) {}

  @ApiOperation({
    summary: '상품 목록 조회',
    description: '상품 목록을 조회합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '상품 목록 조회 성공',
    type: GetProductsResponse,
  })
  @Get()
  async getProducts(@Query() query: GetProductsRequest): Promise<GetProductsResponse> {
    return this.productFacade.getProducts(query);
  }

  @ApiOperation({
    summary: '상품 상세 조회',
    description: '특정 상품의 상세 정보를 조회합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '상품 상세 조회 성공',
    type: GetProductResponse,
  })
  @ApiOperation({
    summary: '베스트셀러 상품 조회',
    description: '최근 3일간 가장 많이 팔린 상위 5개 상품을 조회합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '베스트셀러 상품 조회 성공',
    type: GetTopSellingProductsResponse,
  })
  @Get('top-selling')
  async getTopSellingProducts(): Promise<GetTopSellingProductsResponse> {
    return this.productFacade.getTopSellingProducts();
  }

  @Get(':id')
  async getProduct(@Param('id') id: number): Promise<GetProductResponse> {
    return this.productFacade.getProduct(id);
  }
}
