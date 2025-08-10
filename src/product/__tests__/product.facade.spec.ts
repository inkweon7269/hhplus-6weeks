import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ProductFacade } from '../product.facade';
import { ProductService } from '../product.service';
import { GetProductsRequest } from '../dto/request/get-products-request';
import { GetProductsResponse } from '../dto/response/get-products-response';
import { GetProductResponse } from '../dto/response/get-product-response';
import { GetTopSellingProductsResponse } from '../dto/response/get-top-selling-products-response';

describe('ProductFacade', () => {
  let facade: ProductFacade;
  let productService: jest.Mocked<ProductService>;

  const mockProductResponse = {
    id: 1,
    name: '스마트폰',
  };

  const mockGetProductsResponse: GetProductsResponse = {
    list: [mockProductResponse],
    totalCount: 1,
    currentPage: 1,
    totalPages: 1,
  };

  const mockGetProductResponse: GetProductResponse = {
    id: 1,
    name: '스마트폰',
    productOptions: [
      {
        id: 1,
        name: '128GB',
        price: 800000,
        stock: 50,
      },
    ],
  };

  const mockTopSellingProductsData = [
    {
      productId: 1,
      productName: '스마트폰',
      totalSales: 3,
      rank: 1,
    },
    {
      productId: 2,
      productName: '노트북',
      totalSales: 1,
      rank: 2,
    },
  ];

  const mockGetTopSellingProductsResponse: GetTopSellingProductsResponse = {
    products: mockTopSellingProductsData.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      totalSales: item.totalSales,
      rank: item.rank,
    })),
  };

  beforeEach(async () => {
    const mockService = {
      getProducts: jest.fn(),
      getProduct: jest.fn(),
      getTopSellingProducts: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductFacade,
        {
          provide: ProductService,
          useValue: mockService,
        },
      ],
    }).compile();

    facade = module.get<ProductFacade>(ProductFacade);
    productService = module.get(ProductService);
  });

  it('should be defined', () => {
    expect(facade).toBeDefined();
  });

  describe('getProducts', () => {
    const query: GetProductsRequest = { page: 1, limit: 10 };

    it('상품 목록을 페이지네이션으로 조회합니다.', async () => {
      productService.getProducts.mockResolvedValue(mockGetProductsResponse);

      const result = await facade.getProducts(query);

      expect(result).toEqual(mockGetProductsResponse);
      expect(productService.getProducts).toHaveBeenCalledWith(query);
      expect(productService.getProducts).toHaveBeenCalledTimes(1);
    });
  });

  describe('getProduct', () => {
    const productId = 1;

    it('존재하지 않는 상품일 때 NotFoundException을 전달합니다.', async () => {
      const notFoundError = new NotFoundException(`ID가 '${productId}'인 상품을 찾을 수 없습니다.`);
      productService.getProduct.mockRejectedValue(notFoundError);

      await expect(facade.getProduct(productId)).rejects.toThrow(notFoundError);
      expect(productService.getProduct).toHaveBeenCalledWith(productId);
      expect(productService.getProduct).toHaveBeenCalledTimes(1);
    });

    it('상품 정보를 반환합니다.', async () => {
      productService.getProduct.mockResolvedValue(mockGetProductResponse);

      const result = await facade.getProduct(productId);

      expect(result).toEqual(mockGetProductResponse);
      expect(productService.getProduct).toHaveBeenCalledWith(productId);
      expect(productService.getProduct).toHaveBeenCalledTimes(1);
    });
  });

  describe('getTopSellingProducts', () => {
    it('인기 상품 목록을 반환합니다.', async () => {
      productService.getTopSellingProducts.mockResolvedValue(mockTopSellingProductsData);

      const result = await facade.getTopSellingProducts();

      expect(result).toEqual(mockGetTopSellingProductsResponse);
      expect(productService.getTopSellingProducts).toHaveBeenCalledWith(3);
      expect(productService.getTopSellingProducts).toHaveBeenCalledTimes(1);
    });

    it('빈 데이터가 반환될 때 빈 배열을 반환합니다.', async () => {
      productService.getTopSellingProducts.mockResolvedValue([]);

      const result = await facade.getTopSellingProducts();

      expect(result.products).toEqual([]);
      expect(productService.getTopSellingProducts).toHaveBeenCalledWith(3);
      expect(productService.getTopSellingProducts).toHaveBeenCalledTimes(1);
    });
  });
});
