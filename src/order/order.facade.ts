import { Injectable, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OrderService } from './order.service';
import { BalanceService } from '../balance/balance.service';
import { ProductService } from '../product/product.service';
import { ProductOptionService } from '../product/product-option.service';
import { CouponService } from '../coupon/coupon.service';
import { CreateOrderRequest } from './dto/request/create-order-request';
import { CreateOrderResponse } from './dto/response/create-order-response';
import { Transactional } from 'typeorm-transactional';

@Injectable()
export class OrderFacade {
  constructor(
    private readonly orderService: OrderService,
    private readonly balanceService: BalanceService,
    private readonly productService: ProductService,
    private readonly productOptionService: ProductOptionService,
    private readonly couponService: CouponService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // 트랜잭션 밖에서 무거운 조회/검증/계산을 모두 처리하고, 실제 데이터 변경(재고 차감, 쿠폰 사용, 잔액 차감, 주문 저장)만 짧은 트랜잭션으로 처리
  async pay(userId: number, request: CreateOrderRequest): Promise<CreateOrderResponse> {
    // 1) 주문 검증 및 상품 정보 조회 (읽기 전용)
    const { productInfos, orderProductOptions } = await this.getValidatedProductInfos(request);

    // 2) 주문 금액 계산 (쿠폰 할인 포함, 읽기 전용)
    const amounts = await this.calculateOrderAmount(userId, request, productInfos);

    // 3) 사용 금액 검증 (읽기 전용)
    if (request.usedAmount !== amounts.finalAmount) {
      throw new BadRequestException(
        `사용 금액이 주문 금액과 일치하지 않습니다. 실제 주문 금액: ${amounts.finalAmount.toLocaleString()}원, 요청 사용 금액: ${request.usedAmount.toLocaleString()}원`,
      );
    }

    // 4) 쿠폰 사전 조회 (읽기 전용) - 실제 사용은 트랜잭션 내에서 처리
    let couponInfo: { couponId: number; userCouponId: number; discountAmount: number } | null = null;
    if (request.couponCode) {
      const userCoupon = await this.couponService.findAvailableUserCouponByCode(userId, request.couponCode);
      if (!userCoupon) {
        throw new BadRequestException('사용할 수 없는 쿠폰입니다. 쿠폰이 존재하지 않거나 이미 사용되었습니다.');
      }
      couponInfo = {
        couponId: userCoupon.couponId,
        userCouponId: userCoupon.id,
        discountAmount: amounts.discountAmount,
      };
    }

    // 5) 실제 변경 작업만 트랜잭션으로 짧게 묶어서 처리
    const order = await this.confirmAndCreateOrder(userId, request, {
      orderProductOptions,
      amounts,
      productInfos,
      couponInfo,
    });

    // 6) 커밋 이후 주문 생성 이벤트 발생 (비동기)
    this.eventEmitter.emit('order.created', {
      orderId: order.orderId,
      orderProducts: request.products.map((product) => ({
        productId: product.productId,
      })),
      createdAt: new Date(order.createdAt),
    });

    return order;
  }

  // 짧은 트랜잭션 경계 — 실제 변경(재고 차감 → 쿠폰 사용 → 잔액 차감 → 주문 저장)만 포함
  @Transactional()
  private async confirmAndCreateOrder(
    userId: number,
    request: CreateOrderRequest,
    args: {
      orderProductOptions: Array<{ productOptionId: number; quantity: number }>;
      amounts: { totalAmount: number; discountAmount: number; finalAmount: number };
      productInfos: Array<{
        id: number;
        name: string;
        price: number;
        stock: number;
        optionId: number;
        optionName: string;
      }>;
      couponInfo: { couponId: number; userCouponId: number; discountAmount: number } | null;
    },
  ): Promise<CreateOrderResponse> {
    const { orderProductOptions, amounts, productInfos, couponInfo } = args;

    // 1) 재고 차감 (현재 구현 유지: 조회 후 저장 방식)
    await this.productOptionService.deductMultipleStock(orderProductOptions);

    // 2) 쿠폰 사용 (현재 구현 유지)
    if (couponInfo && request.couponCode) {
      await this.couponService.useCoupon(userId, request.couponCode);
    }

    // 3) 잔액 차감 (낙관적 락 + 재시도)
    await this.balanceService.useBalance(userId, request.usedAmount);

    // 4) 주문 생성 (검증된 상품 정보 전달)
    return await this.orderService.createOrder(userId, request, amounts, productInfos, couponInfo);
  }

  private async getValidatedProductInfos(request: CreateOrderRequest): Promise<{
    productInfos: Array<{
      id: number;
      name: string;
      price: number;
      stock: number;
      optionId: number;
      optionName: string;
    }>;
    orderProductOptions: Array<{ productOptionId: number; quantity: number }>;
  }> {
    // 모든 상품 옵션 정보 수집
    const orderProductOptions = request.products.flatMap((productRequest) =>
      productRequest.options.map((optionRequest) => ({
        productOptionId: optionRequest.productOptionId,
        quantity: optionRequest.quantity,
      })),
    );

    // productO,tionIds 추출
    const productOptionIds = orderProductOptions.map((item) => item.productOptionId);

    // 배치로 상품 정보 조회 및 유효성 검증
    let productInfos: Array<{
      id: number;
      name: string;
      price: number;
      stock: number;
      optionId: number;
      optionName: string;
    }> = [];

    try {
      productInfos = await this.productService.getProductsForPayment(productOptionIds);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw new BadRequestException(`상품 검증 실패: ${error.message}`);
      }
      throw error;
    }

    // 재고 체크
    try {
      await this.productOptionService.checkMultipleStock(orderProductOptions);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw new BadRequestException(`재고 부족: ${error.message}`);
      }
      throw error;
    }

    return { productInfos, orderProductOptions };
  }

  private async calculateOrderAmount(
    userId: number,
    request: CreateOrderRequest,
    productInfos: Array<{
      id: number;
      name: string;
      price: number;
      stock: number;
      optionId: number;
      optionName: string;
    }>,
  ): Promise<{ totalAmount: number; discountAmount: number; finalAmount: number }> {
    let totalAmount = 0;
    for (const productRequest of request.products) {
      for (const optionRequest of productRequest.options) {
        const product = productInfos.find((p) => p.optionId === optionRequest.productOptionId);
        if (!product) {
          throw new BadRequestException(`상품 옵션 ID ${optionRequest.productOptionId}의 정보를 찾을 수 없습니다.`);
        }
        totalAmount += product.price * optionRequest.quantity;
      }
    }

    // 쿠폰 할인 적용
    let discountAmount = 0;
    if (request.couponCode) {
      discountAmount = await this.couponService.validateAndGetDiscountAmount(userId, request.couponCode);
    }

    const finalAmount = totalAmount - discountAmount;

    if (finalAmount < 0) {
      throw new BadRequestException('할인 금액이 주문 금액보다 클 수 없습니다.');
    }

    return {
      totalAmount,
      discountAmount,
      finalAmount,
    };
  }
}
