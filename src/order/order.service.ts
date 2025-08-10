import { Injectable, Inject } from '@nestjs/common';
import { IOrderRepository, ORDER_REPOSITORY } from './domain/order.repository.interface';
import { IOrderProductRepository, ORDER_PRODUCT_REPOSITORY } from './domain/order-product.repository.interface';
import {
  IOrderProductOptionRepository,
  ORDER_PRODUCT_OPTION_REPOSITORY,
} from './domain/order-product-option.repository.interface';
import { IOrderCouponRepository, ORDER_COUPON_REPOSITORY } from './domain/order-coupon.repository.interface';
import { ProductService } from '../product/product.service';
import { CreateOrderRequest } from './dto/request/create-order-request';
import { CreateOrderResponse } from './dto/response/create-order-response';
import { OrderStatus } from './enum/order-status.enum';

@Injectable()
export class OrderService {
  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: IOrderRepository,
    @Inject(ORDER_PRODUCT_REPOSITORY)
    private readonly orderProductRepository: IOrderProductRepository,
    @Inject(ORDER_PRODUCT_OPTION_REPOSITORY)
    private readonly orderProductOptionRepository: IOrderProductOptionRepository,
    @Inject(ORDER_COUPON_REPOSITORY)
    private readonly orderCouponRepository: IOrderCouponRepository,
    private readonly productService: ProductService,
  ) {}

  async createOrder(
    userId: number,
    request: CreateOrderRequest,
    calculatedAmounts: {
      totalAmount: number;
      discountAmount: number;
      finalAmount: number;
    },
    validatedProducts: Array<{
      id: number;
      name: string;
      price: number;
      stock: number;
      optionId: number;
      optionName: string;
    }>,
    couponInfo?: { couponId: number; userCouponId: number; discountAmount: number } | null,
  ): Promise<CreateOrderResponse> {
    // 1. 주문 엔티티 생성 및 저장
    const order = await this.orderRepository.saveOrder({
      userId,
      totalPrice: calculatedAmounts.finalAmount,
      status: OrderStatus.CONFIRMED,
    });

    // 2. 쿠폰 정보가 있는 경우 주문-쿠폰 관계 생성
    if (couponInfo) {
      await this.orderCouponRepository.saveOrderCoupon({
        orderId: order.id,
        couponId: couponInfo.couponId,
        userCouponId: couponInfo.userCouponId,
        discountAmount: couponInfo.discountAmount,
      });
    }

    // 3. 주문 상품들 생성 및 저장
    const orderProducts = [];
    for (const productRequest of request.products) {
      // 상품 정보 조회
      const productInfo = await this.productService.getProduct(productRequest.productId);

      // 주문 상품 생성
      const orderProduct = await this.orderProductRepository.saveOrderProduct({
        orderId: order.id,
        productId: productRequest.productId,
        name: productInfo.name,
      });

      // 4. 주문 상품 옵션들 생성 및 저장
      for (const optionRequest of productRequest.options) {
        const product = validatedProducts.find((p) => p.optionId === optionRequest.productOptionId);
        if (!product) {
          throw new Error(`상품 옵션 ID ${optionRequest.productOptionId}의 정보를 찾을 수 없습니다.`);
        }

        await this.orderProductOptionRepository.saveOrderProductOption({
          orderProductId: orderProduct.id,
          productOptionId: optionRequest.productOptionId,
          name: product.name,
          price: product.price,
          quantity: optionRequest.quantity,
        });

        orderProducts.push({
          productId: optionRequest.productOptionId,
          name: product.name,
          price: product.price,
          quantity: optionRequest.quantity,
        });
      }
    }

    return {
      orderId: order.id,
      createdAt: order.createdAt.toISOString(),
      items: orderProducts,
      totalAmount: calculatedAmounts.totalAmount,
      discountAmount: calculatedAmounts.discountAmount,
      finalAmount: calculatedAmounts.finalAmount,
      status: order.status as OrderStatus,
      couponCode: request.couponCode || null,
    };
  }
}
