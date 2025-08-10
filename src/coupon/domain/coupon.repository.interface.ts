import { CouponEntity } from './coupon.entity';
import { CouponStatus } from '../enum/coupon-status.enum';

export interface ICouponRepository {
  findCoupons(page: number, limit: number, status?: CouponStatus): Promise<[CouponEntity[], number]>;
  findCouponById(couponId: number): Promise<CouponEntity | null>;
  saveCoupon(coupon: Partial<CouponEntity>): Promise<CouponEntity>;
  updateCouponStock(couponId: number, remainingStock: number): Promise<CouponEntity>;
}

export const COUPON_REPOSITORY = Symbol('COUPON_REPOSITORY');
