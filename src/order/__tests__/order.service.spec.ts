import { Test, TestingModule } from '@nestjs/testing';
import { OrderService } from '../order.service';
import { IOrderRepository, ORDER_REPOSITORY } from '../domain/order.repository.interface';
import { IOrderProductRepository, ORDER_PRODUCT_REPOSITORY } from '../domain/order-product.repository.interface';
import {
  IOrderProductOptionRepository,
  ORDER_PRODUCT_OPTION_REPOSITORY,
} from '../domain/order-product-option.repository.interface';
import { IOrderCouponRepository, ORDER_COUPON_REPOSITORY } from '../domain/order-coupon.repository.interface';
import { ProductService } from '../../product/product.service';
import { OrderEntity } from '../domain/order.entity';
import { OrderProductEntity } from '../domain/order-product.entity';
import { OrderProductOptionEntity } from '../domain/order-product-option.entity';
import { CreateOrderRequest } from '../dto/request/create-order-request';
import { OrderStatus } from '../enum/order-status.enum';

describe('OrderService', () => {
  let service: OrderService;
  let orderRepository: jest.Mocked<IOrderRepository>;
  let orderProductRepository: jest.Mocked<IOrderProductRepository>;
  let orderProductOptionRepository: jest.Mocked<IOrderProductOptionRepository>;
  let orderCouponRepository: jest.Mocked<IOrderCouponRepository>;
  let productService: jest.Mocked<ProductService>;

  const mockOrderEntity: OrderEntity = {
    id: 1,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    deletedAt: null,
    userId: 1,
    totalPrice: 995000,
    status: OrderStatus.CONFIRMED,
    user: null,
    orderProducts: [],
    orderCoupon: undefined,
  };

  const mockOrderProductEntity: OrderProductEntity = {
    id: 1,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    deletedAt: null,
    orderId: 1,
    productId: 1,
    name: '스마트폰',
    order: null,
    product: null,
    orderProductOptions: [],
  };

  const mockOrderProductOptionEntity: OrderProductOptionEntity = {
    id: 1,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    deletedAt: null,
    orderProductId: 1,
    productOptionId: 1,
    name: '128GB',
    price: 800000,
    quantity: 1,
    orderProduct: null,
    productOption: null,
  };

  const mockCreateOrderRequest: CreateOrderRequest = {
    products: [
      {
        productId: 1,
        options: [
          { productOptionId: 1, quantity: 1 },
          { productOptionId: 2, quantity: 2 },
        ],
      },
    ],
    usedAmount: 995000,
    couponCode: 'DISCOUNT10',
  };

  const mockValidatedProducts = [
    {
      id: 1,
      name: '스마트폰',
      price: 800000,
      stock: 50,
      optionId: 1,
      optionName: '128GB',
    },
    {
      id: 1,
      name: '스마트폰',
      price: 900000,
      stock: 30,
      optionId: 2,
      optionName: '256GB',
    },
  ];

  const mockCalculatedAmounts = {
    totalAmount: 1000000,
    discountAmount: 5000,
    finalAmount: 995000,
  };

  beforeEach(async () => {
    const mockOrderRepository = {
      saveOrder: jest.fn(),
      findById: jest.fn(),
    };

    const mockOrderProductRepository = {
      saveOrderProduct: jest.fn(),
      findById: jest.fn(),
      findByOrderId: jest.fn(),
    };

    const mockOrderProductOptionRepository = {
      saveOrderProductOption: jest.fn(),
      findById: jest.fn(),
      findByOrderProductId: jest.fn(),
    };

    const mockOrderCouponRepository = {
      saveOrderCoupon: jest.fn(),
      findByOrderId: jest.fn(),
    };

    const mockProductService = {
      getProduct: jest.fn(),
      getProductsForPayment: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        {
          provide: ORDER_REPOSITORY,
          useValue: mockOrderRepository,
        },
        {
          provide: ORDER_PRODUCT_REPOSITORY,
          useValue: mockOrderProductRepository,
        },
        {
          provide: ORDER_PRODUCT_OPTION_REPOSITORY,
          useValue: mockOrderProductOptionRepository,
        },
        {
          provide: ORDER_COUPON_REPOSITORY,
          useValue: mockOrderCouponRepository,
        },
        {
          provide: ProductService,
          useValue: mockProductService,
        },
      ],
    }).compile();

    service = module.get<OrderService>(OrderService);
    orderRepository = module.get(ORDER_REPOSITORY);
    orderProductRepository = module.get(ORDER_PRODUCT_REPOSITORY);
    orderProductOptionRepository = module.get(ORDER_PRODUCT_OPTION_REPOSITORY);
    orderCouponRepository = module.get(ORDER_COUPON_REPOSITORY);
    productService = module.get(ProductService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createOrder', () => {
    const userId = 1;

    it('주문을 성공적으로 생성합니다.', async () => {
      // Arrange
      orderRepository.saveOrder.mockResolvedValue(mockOrderEntity);
      productService.getProduct.mockResolvedValue({
        id: 1,
        name: '스마트폰',
        productOptions: [],
      });
      orderProductRepository.saveOrderProduct.mockResolvedValue(mockOrderProductEntity);
      orderProductOptionRepository.saveOrderProductOption.mockResolvedValue(mockOrderProductOptionEntity);

      // Act
      const result = await service.createOrder(
        userId,
        mockCreateOrderRequest,
        mockCalculatedAmounts,
        mockValidatedProducts,
        null, // 쿠폰 정보 없음
      );

      // Assert
      expect(orderRepository.saveOrder).toHaveBeenCalledWith({
        userId,
        totalPrice: mockCalculatedAmounts.finalAmount,
        status: OrderStatus.CONFIRMED,
      });
      expect(productService.getProduct).toHaveBeenCalledWith(mockCreateOrderRequest.products[0].productId);
      expect(orderProductRepository.saveOrderProduct).toHaveBeenCalledWith({
        orderId: mockOrderEntity.id,
        productId: mockCreateOrderRequest.products[0].productId,
        name: '스마트폰',
      });
      expect(orderProductOptionRepository.saveOrderProductOption).toHaveBeenCalledTimes(2);
      expect(orderCouponRepository.saveOrderCoupon).not.toHaveBeenCalled(); // 쿠폰 정보가 없으므로 호출되지 않음
      expect(result.orderId).toEqual(mockOrderEntity.id);
      expect(result.createdAt).toEqual(mockOrderEntity.createdAt.toISOString());
      expect(result.items).toHaveLength(2);
      expect(result.totalAmount).toEqual(mockCalculatedAmounts.totalAmount);
      expect(result.discountAmount).toEqual(mockCalculatedAmounts.discountAmount);
      expect(result.finalAmount).toEqual(mockCalculatedAmounts.finalAmount);
      expect(result.status).toEqual(OrderStatus.CONFIRMED);
      expect(result.couponCode).toEqual(mockCreateOrderRequest.couponCode);
    });

    it('쿠폰을 사용한 주문을 성공적으로 생성합니다.', async () => {
      // Arrange
      const mockCouponInfo = {
        couponId: 2,
        userCouponId: 4,
        discountAmount: 5000,
      };
      const mockOrderCouponEntity = {
        id: 1,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
        orderId: mockOrderEntity.id,
        couponId: mockCouponInfo.couponId,
        userCouponId: mockCouponInfo.userCouponId,
        discountAmount: mockCouponInfo.discountAmount,
        order: null,
        coupon: null,
        userCoupon: null,
      };

      orderRepository.saveOrder.mockResolvedValue(mockOrderEntity);
      orderCouponRepository.saveOrderCoupon.mockResolvedValue(mockOrderCouponEntity);
      productService.getProduct.mockResolvedValue({
        id: 1,
        name: '스마트폰',
        productOptions: [],
      });
      orderProductRepository.saveOrderProduct.mockResolvedValue(mockOrderProductEntity);
      orderProductOptionRepository.saveOrderProductOption.mockResolvedValue(mockOrderProductOptionEntity);

      // Act
      const result = await service.createOrder(
        userId,
        mockCreateOrderRequest,
        mockCalculatedAmounts,
        mockValidatedProducts,
        mockCouponInfo,
      );

      // Assert
      expect(orderRepository.saveOrder).toHaveBeenCalledWith({
        userId,
        totalPrice: mockCalculatedAmounts.finalAmount,
        status: OrderStatus.CONFIRMED,
      });
      expect(orderCouponRepository.saveOrderCoupon).toHaveBeenCalledWith({
        orderId: mockOrderEntity.id,
        couponId: mockCouponInfo.couponId,
        userCouponId: mockCouponInfo.userCouponId,
        discountAmount: mockCouponInfo.discountAmount,
      });
      expect(result.orderId).toEqual(mockOrderEntity.id);
      expect(result.status).toEqual(OrderStatus.CONFIRMED);
      expect(result.couponCode).toEqual(mockCreateOrderRequest.couponCode);
    });

    it('쿠폰 정보가 null일 때도 정상적으로 처리합니다.', async () => {
      // Arrange
      orderRepository.saveOrder.mockResolvedValue(mockOrderEntity);
      productService.getProduct.mockResolvedValue({
        id: 1,
        name: '스마트폰',
        productOptions: [],
      });
      orderProductRepository.saveOrderProduct.mockResolvedValue(mockOrderProductEntity);
      orderProductOptionRepository.saveOrderProductOption.mockResolvedValue(mockOrderProductOptionEntity);

      // Act
      const result = await service.createOrder(
        userId,
        mockCreateOrderRequest,
        mockCalculatedAmounts,
        mockValidatedProducts,
        null, // 쿠폰 정보 없음
      );

      // Assert
      expect(orderRepository.saveOrder).toHaveBeenCalledWith({
        userId,
        totalPrice: mockCalculatedAmounts.finalAmount,
        status: OrderStatus.CONFIRMED,
      });
      expect(orderCouponRepository.saveOrderCoupon).not.toHaveBeenCalled(); // 쿠폰 정보가 없으므로 호출되지 않음
      expect(result.orderId).toEqual(mockOrderEntity.id);
    });

    it('상품 옵션 정보를 찾을 수 없을 때 Error를 발생시킵니다.', async () => {
      // Arrange
      orderRepository.saveOrder.mockResolvedValue(mockOrderEntity);
      productService.getProduct.mockResolvedValue({
        id: 1,
        name: '스마트폰',
        productOptions: [],
      });
      orderProductRepository.saveOrderProduct.mockResolvedValue(mockOrderProductEntity);

      const invalidProductOptionId = 999;
      const requestWithInvalidOption = {
        ...mockCreateOrderRequest,
        products: [
          {
            productId: 1,
            options: [{ productOptionId: invalidProductOptionId, quantity: 1 }],
          },
        ],
      };

      // Act & Assert
      await expect(
        service.createOrder(userId, requestWithInvalidOption, mockCalculatedAmounts, mockValidatedProducts, null),
      ).rejects.toThrow(`상품 옵션 ID ${invalidProductOptionId}의 정보를 찾을 수 없습니다.`);
    });
  });
});
