import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ProductOptionService } from '../product-option.service';
import { IProductOptionRepository, PRODUCT_OPTION_REPOSITORY } from '../domain/product-option.repository.interface';
import { ProductOptionEntity } from '../domain/product-option.entity';

describe('ProductOptionService', () => {
  let service: ProductOptionService;
  let productOptionRepository: jest.Mocked<IProductOptionRepository>;

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

  const mockProductOptionEntity2: ProductOptionEntity = {
    id: 2,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    deletedAt: null,
    name: '256GB',
    price: 900000,
    stock: 30,
    productId: 1,
    product: null,
    orderProductOptions: [],
  };

  beforeEach(async () => {
    const mockRepository = {
      findByIds: jest.fn(),
      saveMultipleStock: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductOptionService,
        {
          provide: PRODUCT_OPTION_REPOSITORY,
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<ProductOptionService>(ProductOptionService);
    productOptionRepository = module.get(PRODUCT_OPTION_REPOSITORY);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkMultipleStock', () => {
    const items = [
      { productOptionId: 1, quantity: 10 },
      { productOptionId: 2, quantity: 5 },
    ];

    it('존재하지 않는 상품 옵션이 포함되어 있을 때 BadRequestException을 발생시킵니다.', async () => {
      productOptionRepository.findByIds.mockResolvedValue([mockProductOptionEntity]); // 1개만 반환

      await expect(service.checkMultipleStock(items)).rejects.toThrow(
        new BadRequestException('존재하지 않는 상품 옵션이 포함되어 있습니다.'),
      );
      expect(productOptionRepository.findByIds).toHaveBeenCalledWith([1, 2]);
    });

    it('재고가 부족한 상품 옵션이 있을 때 BadRequestException을 발생시킵니다.', async () => {
      const productOptions = [mockProductOptionEntity, mockProductOptionEntity2];
      productOptionRepository.findByIds.mockResolvedValue(productOptions);

      // 재고가 부족한 케이스: 256GB 옵션의 재고(30) < 요청 수량(35)
      const itemsWithInsufficientStock = [
        { productOptionId: 1, quantity: 10 },
        { productOptionId: 2, quantity: 35 }, // 재고(30)보다 많은 수량 요청
      ];

      await expect(service.checkMultipleStock(itemsWithInsufficientStock)).rejects.toThrow(
        new BadRequestException('상품 옵션 256GB의 재고가 부족합니다. (요청: 35, 재고: 30)'),
      );
      expect(productOptionRepository.findByIds).toHaveBeenCalledWith([1, 2]);
    });

    it('재고가 있다면 true를 반환합니다.', async () => {
      const productOptions = [mockProductOptionEntity, mockProductOptionEntity2];
      productOptionRepository.findByIds.mockResolvedValue(productOptions);

      const result = await service.checkMultipleStock(items);

      expect(result).toBe(true);
      expect(productOptionRepository.findByIds).toHaveBeenCalledWith([1, 2]);
    });
  });

  describe('deductMultipleStock', () => {
    const items = [
      { productOptionId: 1, quantity: 10 },
      { productOptionId: 2, quantity: 5 },
    ];

    it('존재하지 않는 상품 옵션이 포함되어 있을 때 BadRequestException을 발생시킵니다.', async () => {
      productOptionRepository.findByIds.mockResolvedValue([mockProductOptionEntity]); // 1개만 반환

      await expect(service.deductMultipleStock(items)).rejects.toThrow(
        new BadRequestException('존재하지 않는 상품 옵션이 포함되어 있습니다.'),
      );
      expect(productOptionRepository.findByIds).toHaveBeenCalledWith([1, 2]);
    });

    it('재고가 부족한 상품 옵션이 있을 때 BadRequestException을 발생시킵니다.', async () => {
      const productOptions = [mockProductOptionEntity, mockProductOptionEntity2];
      productOptionRepository.findByIds.mockResolvedValue(productOptions);

      // 재고가 부족한 케이스: 256GB 옵션의 재고(30) < 요청 수량(35)
      const itemsWithInsufficientStock = [
        { productOptionId: 1, quantity: 10 },
        { productOptionId: 2, quantity: 35 }, // 재고(30)보다 많은 수량 요청
      ];

      await expect(service.deductMultipleStock(itemsWithInsufficientStock)).rejects.toThrow(
        new BadRequestException('상품 옵션 256GB의 재고가 부족합니다. (요청: 35, 재고: 30)'),
      );
      expect(productOptionRepository.findByIds).toHaveBeenCalledWith([1, 2]);
    });

    it('재고를 차감하고 저장합니다.', async () => {
      const productOptions = [mockProductOptionEntity, mockProductOptionEntity2];
      productOptionRepository.findByIds.mockResolvedValue(productOptions);
      productOptionRepository.saveMultipleStock.mockResolvedValue(undefined);

      await service.deductMultipleStock(items);

      expect(productOptionRepository.findByIds).toHaveBeenCalledWith([1, 2]);
      expect(productOptionRepository.saveMultipleStock).toHaveBeenCalledWith([
        { ...mockProductOptionEntity, stock: 40 }, // 50 - 10
        { ...mockProductOptionEntity2, stock: 25 }, // 30 - 5
      ]);
    });
  });
});
