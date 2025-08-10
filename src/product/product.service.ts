import { Injectable, NotFoundException, Inject, BadRequestException } from '@nestjs/common';
import * as dayjs from 'dayjs';
import { GetProductsRequest } from './dto/request/get-products-request';
import { GetProductsResponse, ProductResponse } from './dto/response/get-products-response';
import { GetProductResponse } from './dto/response/get-product-response';
import { IProductRepository, PRODUCT_REPOSITORY } from './domain/product.repository.interface';
import {
  IProductSalesDailyRepository,
  PRODUCT_SALES_DAILY_REPOSITORY,
} from './domain/product-sales-daily.repository.interface';

@Injectable()
export class ProductService {
  constructor(
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: IProductRepository,
    @Inject(PRODUCT_SALES_DAILY_REPOSITORY)
    private readonly productSalesDailyRepository: IProductSalesDailyRepository,
  ) {}

  async getProducts(query: GetProductsRequest): Promise<GetProductsResponse> {
    const page = query.page;
    const limit = query.limit;

    const [paginatedProducts, totalCount] = await this.productRepository.findProducts(page, limit);

    const totalPages = Math.ceil(totalCount / limit);

    const response = new GetProductsResponse();
    response.list = paginatedProducts.map((entity) => ProductResponse.of(entity));
    response.totalCount = totalCount;
    response.currentPage = page;
    response.totalPages = totalPages;

    return response;
  }

  async getProduct(id: number): Promise<GetProductResponse> {
    const product = await this.productRepository.findByIdWithOptions(id);

    if (!product) {
      throw new NotFoundException(`ID가 '${id}'인 상품을 찾을 수 없습니다.`);
    }

    return GetProductResponse.of(product);
  }

  /**
   * 결제용 상품 정보 조회 및 유효성 검증 (배치 처리)
   * @param productOptionIds 상품 옵션 ID 배열
   * @returns 결제에 필요한 상품 정보 배열
   */
  async getProductsForPayment(productOptionIds: number[]): Promise<
    Array<{
      id: number;
      name: string;
      price: number;
      stock: number;
      optionId: number;
      optionName: string;
    }>
  > {
    if (productOptionIds.length === 0) {
      return [];
    }

    // 중복 제거
    const uniqueIds = [...new Set(productOptionIds)];

    // 배치로 상품 정보 조회
    const products = await this.productRepository.findByProductOptionIds(uniqueIds);

    if (products.length === 0) {
      throw new BadRequestException(`요청된 상품 옵션들을 찾을 수 없습니다: ${uniqueIds.join(', ')}`);
    }

    const result: Array<{
      id: number;
      name: string;
      price: number;
      stock: number;
      optionId: number;
      optionName: string;
    }> = [];

    // 각 상품 옵션 ID에 대해 정보 생성
    for (const optionId of productOptionIds) {
      const product = products.find((p) => p.productOptions?.some((option) => option.id === optionId));

      if (!product) {
        throw new BadRequestException(`상품 옵션 ID ${optionId}를 찾을 수 없습니다.`);
      }

      const productOption = product.productOptions?.find((option) => option.id === optionId);

      if (!productOption) {
        throw new BadRequestException(`상품 옵션 ID ${optionId}를 찾을 수 없습니다.`);
      }

      // 상품 유효성 검증 (예외 발생 시 바로 throw)
      this.validateProductForPayment(product, productOption);

      result.push({
        id: product.id,
        name: product.name,
        price: productOption.price,
        stock: productOption.stock,
        optionId: productOption.id,
        optionName: productOption.name,
      });
    }

    return result;
  }

  /**
   * 결제용 상품 정보 조회 및 유효성 검증
   * @param productOptionId 상품 옵션 ID
   * @returns 결제에 필요한 상품 정보 (ID, 이름, 가격, 재고, 옵션 정보)
   */
  async getProductForPayment(productOptionId: number): Promise<{
    id: number;
    name: string;
    price: number;
    stock: number;
    optionId: number;
    optionName: string;
  }> {
    const product = await this.productRepository.findByIdWithOptions(productOptionId);

    if (!product) {
      throw new BadRequestException(`상품 옵션 ID ${productOptionId}를 찾을 수 없습니다.`);
    }

    // 상품 옵션 찾기
    const productOption = product.productOptions?.find((option) => option.id === productOptionId);

    if (!productOption) {
      throw new BadRequestException(`상품 옵션 ID ${productOptionId}를 찾을 수 없습니다.`);
    }

    // 상품 유효성 검증 (예외 발생 시 바로 throw)
    this.validateProductForPayment(product, productOption);

    return {
      id: product.id,
      name: product.name,
      price: productOption.price,
      stock: productOption.stock,
      optionId: productOption.id,
      optionName: productOption.name,
    };
  }

  /**
   * 결제용 상품 유효성 검증
   * @param product 상품 엔티티
   * @param productOption 상품 옵션 엔티티
   * @returns 유효성 여부
   */
  private validateProductForPayment(product: any, productOption: any): boolean {
    // 1. 상품이 삭제되지 않았는지 확인
    if (product.deletedAt) {
      throw new BadRequestException(`상품 '${product.name}'이 삭제되었습니다.`);
    }

    // 2. 상품 옵션이 삭제되지 않았는지 확인
    if (productOption.deletedAt) {
      throw new BadRequestException(`상품 옵션 '${productOption.name}'이 삭제되었습니다.`);
    }

    // 3. 가격이 유효한지 확인
    if (productOption.price <= 0) {
      throw new BadRequestException(`상품 옵션 '${productOption.name}'의 가격이 유효하지 않습니다.`);
    }

    // 4. 재고가 있는지 확인
    if (productOption.stock <= 0) {
      throw new BadRequestException(`상품 옵션 '${productOption.name}'의 재고가 부족합니다.`);
    }

    return true;
  }

  /**
   * 최근 N일간 베스트셀러 상품 조회 (집계 테이블 사용)
   * @param days 조회할 기간 (일)
   * @returns 베스트셀러 상품 정보
   */
  async getTopSellingProducts(days: number = 3): Promise<
    Array<{
      productId: number;
      productName: string;
      totalSales: number;
      rank: number;
    }>
  > {
    // 비즈니스 로직: 날짜 범위 계산
    const endDate = dayjs().format('YYYY-MM-DD');
    const startDate = dayjs().subtract(days, 'day').format('YYYY-MM-DD');

    // Repository에서 데이터 조회
    const rawDailySales = await this.productSalesDailyRepository.findDailySalesByDateRange(startDate, endDate);

    // 데이터가 존재하지 않으면 빈 배열 반환
    if (!rawDailySales || rawDailySales.length === 0) {
      return [];
    }

    // Repository에서 받은 raw 데이터를 서비스 단에서 변환
    const dailySales = rawDailySales.map((row) => ({
      productId: Number(row.productId),
      productName: row.productName,
      totalSales: Number(row.totalSales),
    }));

    // 비즈니스 로직: 상위 5개 선택 및 순위 부여
    const topSellingProducts = dailySales.slice(0, 5).map((product, index) => ({
      ...product,
      rank: index + 1,
    }));

    return topSellingProducts;
  }
}
