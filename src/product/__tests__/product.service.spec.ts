import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ProductService } from '../product.service';
import { IProductRepository, PRODUCT_REPOSITORY } from '../domain/product.repository.interface';
import {
  IProductSalesDailyRepository,
  PRODUCT_SALES_DAILY_REPOSITORY,
} from '../domain/product-sales-daily.repository.interface';
import { ProductEntity } from '../domain/product.entity';
import { ProductOptionEntity } from '../domain/product-option.entity';
import { GetProductsRequest } from '../dto/request/get-products-request';

describe('ProductService', () => {
  let service: ProductService;
  let productRepository: jest.Mocked<IProductRepository>;
  let productSalesDailyRepository: jest.Mocked<IProductSalesDailyRepository>;

  const mockProductOptionEntity: ProductOptionEntity = {
    id: 1,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    deletedAt: null,
    name: '128GB',
    price: 800000,
    stock: 50,
    productId: 1,
    product: null,
    orderProductOptions: [],
  };

  const mockProductEntity: ProductEntity = {
    id: 1,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    deletedAt: null,
    name: '스마트폰',
    productOptions: [mockProductOptionEntity],
    orderProducts: [],
    salesDaily: [],
  };

  beforeEach(async () => {
    const mockProductRepository = {
      findProducts: jest.fn(),
      findByIdWithOptions: jest.fn(),
    };

    const mockProductSalesDailyRepository = {
      findDailySalesByDateRange: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductService,
        {
          provide: PRODUCT_REPOSITORY,
          useValue: mockProductRepository,
        },
        {
          provide: PRODUCT_SALES_DAILY_REPOSITORY,
          useValue: mockProductSalesDailyRepository,
        },
      ],
    }).compile();

    service = module.get<ProductService>(ProductService);
    productRepository = module.get(PRODUCT_REPOSITORY);
    productSalesDailyRepository = module.get(PRODUCT_SALES_DAILY_REPOSITORY);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getProducts', () => {
    const query: GetProductsRequest = { page: 1, limit: 10 };

    it('상품 목록을 페이지네이션으로 조회합니다.', async () => {
      const totalCount = 5;
      const mockProducts = [mockProductEntity];
      productRepository.findProducts.mockResolvedValue([mockProducts, totalCount]);

      const result = await service.getProducts(query);

      expect(result.list).toHaveLength(1);
      expect(result.totalCount).toEqual(totalCount);
      expect(result.currentPage).toEqual(query.page);
      expect(result.totalPages).toEqual(1);
      expect(productRepository.findProducts).toHaveBeenCalledWith(query.page, query.limit);
    });
  });

  describe('getProduct', () => {
    const productId = 1;

    it('존재하지 않는 상품일 때 NotFoundException을 발생시킵니다.', async () => {
      productRepository.findByIdWithOptions.mockResolvedValue(null);

      await expect(service.getProduct(productId)).rejects.toThrow(
        new NotFoundException(`ID가 '${productId}'인 상품을 찾을 수 없습니다.`),
      );
      expect(productRepository.findByIdWithOptions).toHaveBeenCalledWith(productId);
    });

    it('정상적인 경우 상품 정보를 반환합니다.', async () => {
      productRepository.findByIdWithOptions.mockResolvedValue(mockProductEntity);

      const result = await service.getProduct(productId);

      expect(result.id).toEqual(mockProductEntity.id);
      expect(result.name).toEqual(mockProductEntity.name);
      expect(result.productOptions).toHaveLength(1);
      expect(result.productOptions[0].id).toEqual(mockProductOptionEntity.id);
      expect(result.productOptions[0].name).toEqual(mockProductOptionEntity.name);
      expect(result.productOptions[0].price).toEqual(mockProductOptionEntity.price);
      expect(result.productOptions[0].stock).toEqual(mockProductOptionEntity.stock);
      expect(productRepository.findByIdWithOptions).toHaveBeenCalledWith(productId);
    });
  });

  describe('getProductForPayment', () => {
    const productOptionId = 1;

    it('존재하지 않는 상품 옵션일 때 BadRequestException을 발생시킵니다.', async () => {
      productRepository.findByIdWithOptions.mockResolvedValue(null);

      await expect(service.getProductForPayment(productOptionId)).rejects.toThrow(
        new BadRequestException(`상품 옵션 ID ${productOptionId}를 찾을 수 없습니다.`),
      );
      expect(productRepository.findByIdWithOptions).toHaveBeenCalledWith(productOptionId);
    });

    it('상품 옵션을 찾을 수 없을 때 BadRequestException을 발생시킵니다.', async () => {
      const productWithoutOption = { ...mockProductEntity, productOptions: [] };
      productRepository.findByIdWithOptions.mockResolvedValue(productWithoutOption);

      await expect(service.getProductForPayment(productOptionId)).rejects.toThrow(
        new BadRequestException(`상품 옵션 ID ${productOptionId}를 찾을 수 없습니다.`),
      );
    });

    it('정상적인 경우 결제용 상품 정보를 반환합니다.', async () => {
      productRepository.findByIdWithOptions.mockResolvedValue(mockProductEntity);

      const result = await service.getProductForPayment(productOptionId);

      expect(result.id).toEqual(mockProductEntity.id);
      expect(result.name).toEqual(mockProductEntity.name);
      expect(result.price).toEqual(mockProductOptionEntity.price);
      expect(result.stock).toEqual(mockProductOptionEntity.stock);
      expect(result.optionId).toEqual(mockProductOptionEntity.id);
      expect(result.optionName).toEqual(mockProductOptionEntity.name);
      expect(productRepository.findByIdWithOptions).toHaveBeenCalledWith(productOptionId);
    });
  });

  describe('getTopSellingProducts', () => {
    const mockDailySalesData = [
      {
        productId: 1,
        productName: '스마트폰',
        totalSales: 3,
      },
      {
        productId: 2,
        productName: '노트북',
        totalSales: 1,
      },
    ];

    it('인기 상품 목록을 반환합니다.', async () => {
      productSalesDailyRepository.findDailySalesByDateRange.mockResolvedValue(mockDailySalesData);

      const result = await service.getTopSellingProducts(3);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        productId: 1,
        productName: '스마트폰',
        totalSales: 3,
        rank: 1,
      });
      expect(result[1]).toEqual({
        productId: 2,
        productName: '노트북',
        totalSales: 1,
        rank: 2,
      });
      expect(productSalesDailyRepository.findDailySalesByDateRange).toHaveBeenCalled();
    });

    it('판매 데이터가 없을 때 빈 배열을 반환합니다.', async () => {
      productSalesDailyRepository.findDailySalesByDateRange.mockResolvedValue([]);

      const result = await service.getTopSellingProducts(3);

      expect(result).toEqual([]);
      expect(productSalesDailyRepository.findDailySalesByDateRange).toHaveBeenCalled();
    });

    it('null 데이터가 반환될 때 빈 배열을 반환합니다.', async () => {
      productSalesDailyRepository.findDailySalesByDateRange.mockResolvedValue(null);

      const result = await service.getTopSellingProducts(3);

      expect(result).toEqual([]);
      expect(productSalesDailyRepository.findDailySalesByDateRange).toHaveBeenCalled();
    });

    it('최대 5개까지만 반환합니다.', async () => {
      const manySalesData = [
        { productId: 1, productName: '상품1', totalSales: 5 },
        { productId: 2, productName: '상품2', totalSales: 4 },
        { productId: 3, productName: '상품3', totalSales: 3 },
        { productId: 4, productName: '상품4', totalSales: 2 },
        { productId: 5, productName: '상품5', totalSales: 1 },
        { productId: 6, productName: '상품6', totalSales: 0 },
      ];
      productSalesDailyRepository.findDailySalesByDateRange.mockResolvedValue(manySalesData);

      const result = await service.getTopSellingProducts(3);

      expect(result).toHaveLength(5);
      expect(result[0].rank).toBe(1);
      expect(result[1].rank).toBe(2);
      expect(result[2].rank).toBe(3);
      expect(result[3].rank).toBe(4);
      expect(result[4].rank).toBe(5);
    });
  });
});
