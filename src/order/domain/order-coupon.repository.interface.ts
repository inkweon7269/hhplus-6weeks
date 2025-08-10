import { OrderCouponEntity } from './order-coupon.entity';

export interface IOrderCouponRepository {
  saveOrderCoupon(data: {
    orderId: number;
    couponId: number;
    userCouponId: number;
    discountAmount: number;
  }): Promise<OrderCouponEntity>;

  findByOrderId(orderId: number): Promise<OrderCouponEntity | null>;
}

export const ORDER_COUPON_REPOSITORY = Symbol('ORDER_COUPON_REPOSITORY');