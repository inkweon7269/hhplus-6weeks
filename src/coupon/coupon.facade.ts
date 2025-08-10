import { Injectable } from '@nestjs/common';
import { CouponService } from './coupon.service';
import { GetCouponsRequest } from './dto/request/get-coupons-request';
import { GetCouponsResponse } from './dto/response/get-coupons-response';
import { GetUserCouponsRequest } from './dto/request/get-user-coupons-request';
import { GetUserCouponsResponse, UserCouponDetailResponse } from './dto/response/get-user-coupons-response';

@Injectable()
export class CouponFacade {
  constructor(private readonly couponService: CouponService) {}

  async issueCoupon(couponId: number, userId: number): Promise<UserCouponDetailResponse> {
    return await this.couponService.issueCoupon(couponId, userId);
  }

  async getCoupons(query: GetCouponsRequest): Promise<GetCouponsResponse> {
    return await this.couponService.getCoupons(query);
  }

  async getUserCoupons(userId: number, query: GetUserCouponsRequest): Promise<GetUserCouponsResponse> {
    return await this.couponService.getUserCoupons(userId, query);
  }
}
