import { UserCouponEntity } from './user-coupon.entity';
import { UserCouponStatus } from '../enum/coupon-status.enum';

export interface IUserCouponRepository {
  findUserCoupons(
    userId: number,
    page: number,
    limit: number,
    status?: UserCouponStatus,
  ): Promise<[UserCouponEntity[], number]>;
  findAvailableUserCouponByCode(userId: number, couponCode: string): Promise<UserCouponEntity | null>;
  findUserCouponByUserIdAndCouponId(userId: number, couponId: number): Promise<UserCouponEntity | null>;
  saveUserCoupon(userCoupon: Partial<UserCouponEntity>): Promise<UserCouponEntity>;
  markUserCouponAsUsed(userCouponId: number, usedDate: Date): Promise<UserCouponEntity>;
}

export const USER_COUPON_REPOSITORY = Symbol('USER_COUPON_REPOSITORY');
