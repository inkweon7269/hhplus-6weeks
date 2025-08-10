import { Injectable } from '@nestjs/common';
import { ProductService } from './product.service';
import { GetProductsRequest } from './dto/request/get-products-request';
import { GetProductsResponse } from './dto/response/get-products-response';
import { GetProductResponse } from './dto/response/get-product-response';
import { GetTopSellingProductsResponse } from './dto/response/get-top-selling-products-response';

@Injectable()
export class ProductFacade {
  constructor(private readonly productService: ProductService) {}

  async getProducts(query: GetProductsRequest): Promise<GetProductsResponse> {
    return this.productService.getProducts(query);
  }

  async getProduct(id: number): Promise<GetProductResponse> {
    return this.productService.getProduct(id);
  }

  async getTopSellingProducts(): Promise<GetTopSellingProductsResponse> {
    const data = await this.productService.getTopSellingProducts(3);
    return GetTopSellingProductsResponse.from(data);
  }
}
