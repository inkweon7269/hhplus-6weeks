import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { OrderFacade } from '../order.facade';
import { OrderService } from '../order.service';
import { BalanceService } from '../../balance/balance.service';
import { ProductService } from '../../product/product.service';
import { ProductOptionService } from '../../product/product-option.service';
import { CouponService } from '../../coupon/coupon.service';
import { CreateOrderRequest } from '../dto/request/create-order-request';
import { CreateOrderResponse } from '../dto/response/create-order-response';
import { OrderStatus } from '../enum/order-status.enum';
import { EventEmitter2 } from '@nestjs/event-emitter';

// @Transactional 데코레이터 모킹
jest.mock('typeorm-transactional', () => ({
  Transactional: () => jest.fn(),
}));

describe('OrderFacade', () => {
  let facade: OrderFacade;
  let orderService: jest.Mocked<OrderService>;
  let balanceService: jest.Mocked<BalanceService>;
  let productService: jest.Mocked<ProductService>;
  let productOptionService: jest.Mocked<ProductOptionService>;
  let couponService: jest.Mocked<CouponService>;

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
    usedAmount: 2595000, // (800000 * 1) + (900000 * 2) - 5000 = 2595000
    couponCode: 'DISCOUNT10',
  };

  const mockCreateOrderResponse: CreateOrderResponse = {
    orderId: 1,
    createdAt: '2025-01-01T00:00:00.000Z',
    items: [
      {
        productId: 1,
        name: '스마트폰',
        price: 800000,
        quantity: 1,
      },
      {
        productId: 2,
        name: '스마트폰',
        price: 900000,
        quantity: 2,
      },
    ],
    totalAmount: 2600000, // (800000 * 1) + (900000 * 2)
    discountAmount: 5000,
    finalAmount: 2595000, // 2600000 - 5000
    status: OrderStatus.CONFIRMED,
    couponCode: 'DISCOUNT10',
  };

  const mockProductInfos = [
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

  const mockOrderProductOptions = [
    { productOptionId: 1, quantity: 1 },
    { productOptionId: 2, quantity: 2 },
  ];

  beforeEach(async () => {
    const mockOrderService = {
      createOrder: jest.fn(),
    };

    const mockBalanceService = {
      useBalance: jest.fn(),
    };

    const mockProductService = {
      getProductsForPayment: jest.fn(),
    };

    const mockProductOptionService = {
      checkMultipleStock: jest.fn(),
      deductMultipleStock: jest.fn(),
    };

    const mockCouponService = {
      validateAndGetCouponInfo: jest.fn(),
      useCoupon: jest.fn(),
    };

    const mockEventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderFacade,
        {
          provide: OrderService,
          useValue: mockOrderService,
        },
        {
          provide: BalanceService,
          useValue: mockBalanceService,
        },
        {
          provide: ProductService,
          useValue: mockProductService,
        },
        {
          provide: ProductOptionService,
          useValue: mockProductOptionService,
        },
        {
          provide: CouponService,
          useValue: mockCouponService,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
      ],
    }).compile();

    facade = module.get<OrderFacade>(OrderFacade);
    orderService = module.get(OrderService);
    balanceService = module.get(BalanceService);
    productService = module.get(ProductService);
    productOptionService = module.get(ProductOptionService);
    couponService = module.get(CouponService);
  });

  it('should be defined', () => {
    expect(facade).toBeDefined();
  });

  describe('pay', () => {
    const userId = 1;

    it('주문과 결제를 성공적으로 처리합니다.', async () => {
      // Arrange
      productService.getProductsForPayment.mockResolvedValue(mockProductInfos);
      productOptionService.checkMultipleStock.mockResolvedValue(undefined);
      const mockUserCoupon = {
        id: 4,
        userId: 1,
        couponId: 2,
        status: 'AVAILABLE' as any,
        usedDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: {} as any,
        coupon: {
          id: 2,
          discountAmount: 5000,
          expiryDate: new Date('2025-12-31'),
        } as any,
      } as any;
      couponService.validateAndGetCouponInfo.mockResolvedValue(mockUserCoupon);
      balanceService.useBalance.mockResolvedValue(undefined);
      productOptionService.deductMultipleStock.mockResolvedValue(undefined);
      const usedCoupon = { ...mockUserCoupon, status: 'USED', usedDate: new Date() };
      couponService.useCoupon.mockResolvedValue(usedCoupon);
      orderService.createOrder.mockResolvedValue(mockCreateOrderResponse);

      // Act
      const result = await facade.pay(userId, mockCreateOrderRequest);

      // Assert
      expect(productService.getProductsForPayment).toHaveBeenCalledWith([1, 2]);
      expect(productOptionService.checkMultipleStock).toHaveBeenCalledWith(mockOrderProductOptions);
      expect(couponService.validateAndGetCouponInfo).toHaveBeenCalledWith(userId, mockCreateOrderRequest.couponCode);
      expect(balanceService.useBalance).toHaveBeenCalledWith(userId, mockCreateOrderRequest.usedAmount);
      expect(productOptionService.deductMultipleStock).toHaveBeenCalledWith(mockOrderProductOptions);
      expect(couponService.useCoupon).toHaveBeenCalledWith(userId, mockCreateOrderRequest.couponCode);
      expect(orderService.createOrder).toHaveBeenCalledWith(
        userId,
        mockCreateOrderRequest,
        {
          totalAmount: 2600000,
          discountAmount: 5000,
          finalAmount: 2595000,
        },
        mockProductInfos,
        {
          couponId: 2,
          userCouponId: 4,
          discountAmount: 5000,
        },
      );
      expect(result).toEqual(mockCreateOrderResponse);
    });

    it('사용 금액이 주문 금액과 일치하지 않을 때 BadRequestException을 발생시킵니다.', async () => {
      // Arrange
      productService.getProductsForPayment.mockResolvedValue(mockProductInfos);
      productOptionService.checkMultipleStock.mockResolvedValue(undefined);
      const mockUserCoupon = {
        id: 4,
        userId: 1,
        couponId: 2,
        status: 'AVAILABLE' as any,
        usedDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: {} as any,
        coupon: {
          id: 2,
          discountAmount: 5000,
          expiryDate: new Date('2025-12-31'),
        } as any,
      } as any;
      couponService.validateAndGetCouponInfo.mockResolvedValue(mockUserCoupon);

      const requestWithWrongAmount = {
        ...mockCreateOrderRequest,
        usedAmount: 1000000, // 잘못된 금액
      };

      // Act & Assert
      await expect(facade.pay(userId, requestWithWrongAmount)).rejects.toThrow(
        new BadRequestException(
          '사용 금액이 주문 금액과 일치하지 않습니다. 실제 주문 금액: 2,595,000원, 요청 사용 금액: 1,000,000원',
        ),
      );
    });

    it('상품 검증 실패 시 BadRequestException을 발생시킵니다.', async () => {
      // Arrange
      const validationError = new BadRequestException('상품이 존재하지 않습니다.');
      productService.getProductsForPayment.mockRejectedValue(validationError);

      // Act & Assert
      await expect(facade.pay(userId, mockCreateOrderRequest)).rejects.toThrow(
        new BadRequestException('상품 검증 실패: 상품이 존재하지 않습니다.'),
      );
    });

    it('재고 부족 시 BadRequestException을 발생시킵니다.', async () => {
      // Arrange
      productService.getProductsForPayment.mockResolvedValue(mockProductInfos);
      const stockError = new BadRequestException('재고가 부족합니다.');
      productOptionService.checkMultipleStock.mockRejectedValue(stockError);

      // Act & Assert
      await expect(facade.pay(userId, mockCreateOrderRequest)).rejects.toThrow(
        new BadRequestException('재고 부족: 재고가 부족합니다.'),
      );
    });

    it('쿠폰이 없는 주문을 성공적으로 처리합니다.', async () => {
      // Arrange
      const requestWithoutCoupon = {
        ...mockCreateOrderRequest,
        couponCode: undefined,
        usedAmount: 2600000, // 쿠폰 없으므로 할인 없음
      };

      productService.getProductsForPayment.mockResolvedValue(mockProductInfos);
      productOptionService.checkMultipleStock.mockResolvedValue(undefined);
      balanceService.useBalance.mockResolvedValue(undefined);
      productOptionService.deductMultipleStock.mockResolvedValue(undefined);
      orderService.createOrder.mockResolvedValue({
        ...mockCreateOrderResponse,
        couponCode: null,
        discountAmount: 0,
        finalAmount: 2600000,
      });

      // Act
      const result = await facade.pay(userId, requestWithoutCoupon);

      // Assert
      expect(couponService.validateAndGetCouponInfo).not.toHaveBeenCalled();
      expect(couponService.useCoupon).not.toHaveBeenCalled();
      expect(orderService.createOrder).toHaveBeenCalledWith(
        userId,
        requestWithoutCoupon,
        {
          totalAmount: 2600000,
          discountAmount: 0,
          finalAmount: 2600000,
        },
        mockProductInfos,
        null,
      );
      expect(result.couponCode).toBeNull();
    });

    it('쿠폰 사용 시 쿠폰 정보를 올바르게 전달합니다.', async () => {
      // Arrange
      const mockUserCoupon = {
        id: 4,
        userId: 1,
        couponId: 2,
        status: 'AVAILABLE' as any,
        couponCode: 'DISCOUNT10',
        usedDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: {} as any,
        coupon: {
          id: 2,
          discountAmount: 5000,
          expiryDate: new Date('2025-12-31'),
        } as any,
      } as any;

      productService.getProductsForPayment.mockResolvedValue(mockProductInfos);
      productOptionService.checkMultipleStock.mockResolvedValue(undefined);
      couponService.validateAndGetCouponInfo.mockResolvedValue(mockUserCoupon);
      balanceService.useBalance.mockResolvedValue(undefined);
      productOptionService.deductMultipleStock.mockResolvedValue(undefined);
      const usedCoupon = { ...mockUserCoupon, status: 'USED', usedDate: new Date() };
      couponService.useCoupon.mockResolvedValue(usedCoupon);
      orderService.createOrder.mockResolvedValue(mockCreateOrderResponse);

      // Act
      const result = await facade.pay(userId, mockCreateOrderRequest);

      // Assert
      expect(couponService.useCoupon).toHaveBeenCalledWith(userId, mockCreateOrderRequest.couponCode);
      expect(orderService.createOrder).toHaveBeenCalledWith(
        userId,
        mockCreateOrderRequest,
        {
          totalAmount: 2600000,
          discountAmount: 5000,
          finalAmount: 2595000,
        },
        mockProductInfos,
        {
          couponId: mockUserCoupon.couponId,
          userCouponId: mockUserCoupon.id,
          discountAmount: 5000,
        },
      );
      expect(result).toEqual(mockCreateOrderResponse);
    });

    it('쿠폰을 찾을 수 없을 때 쿠폰 정보를 null로 전달합니다.', async () => {
      // Arrange
      productService.getProductsForPayment.mockResolvedValue(mockProductInfos);
      productOptionService.checkMultipleStock.mockResolvedValue(undefined);
      const mockUserCoupon = {
        id: 4,
        userId: 1,
        couponId: 2,
        status: 'AVAILABLE' as any,
        usedDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: {} as any,
        coupon: {
          id: 2,
          discountAmount: 5000,
          expiryDate: new Date('2025-12-31'),
        } as any,
      } as any;
      couponService.validateAndGetCouponInfo.mockResolvedValue(mockUserCoupon);
      balanceService.useBalance.mockResolvedValue(undefined);
      productOptionService.deductMultipleStock.mockResolvedValue(undefined);
      const usedCoupon = { ...mockUserCoupon, status: 'USED', usedDate: new Date() };
      couponService.useCoupon.mockResolvedValue(usedCoupon);
      orderService.createOrder.mockResolvedValue(mockCreateOrderResponse);

      // Act
      const result = await facade.pay(userId, mockCreateOrderRequest);

      // Assert
      expect(couponService.useCoupon).toHaveBeenCalledWith(userId, mockCreateOrderRequest.couponCode);
      expect(orderService.createOrder).toHaveBeenCalledWith(
        userId,
        mockCreateOrderRequest,
        {
          totalAmount: 2600000,
          discountAmount: 5000,
          finalAmount: 2595000,
        },
        mockProductInfos,
        {
          couponId: 2,
          userCouponId: 4,
          discountAmount: 5000,
        },
      );
      expect(result).toEqual(mockCreateOrderResponse);
    });

    it('할인 금액이 주문 금액보다 클 때 BadRequestException을 발생시킵니다.', async () => {
      // Arrange
      productService.getProductsForPayment.mockResolvedValue(mockProductInfos);
      productOptionService.checkMultipleStock.mockResolvedValue(undefined);
      const mockUserCoupon = {
        id: 4,
        userId: 1,
        couponId: 2,
        status: 'AVAILABLE' as any,
        usedDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: {} as any,
        coupon: {
          id: 2,
          discountAmount: 3000000, // 주문 금액보다 큰 할인
          expiryDate: new Date('2025-12-31'),
        } as any,
      } as any;
      couponService.validateAndGetCouponInfo.mockResolvedValue(mockUserCoupon);

      // Act & Assert
      await expect(facade.pay(userId, mockCreateOrderRequest)).rejects.toThrow(
        new BadRequestException('할인 금액이 주문 금액보다 클 수 없습니다.'),
      );
    });
  });
});
