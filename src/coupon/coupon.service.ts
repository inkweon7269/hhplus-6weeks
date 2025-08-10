import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { ICouponRepository, COUPON_REPOSITORY } from './domain/coupon.repository.interface';
import { IUserCouponRepository, USER_COUPON_REPOSITORY } from './domain/user-coupon.repository.interface';
import { GetCouponsRequest } from './dto/request/get-coupons-request';
import { GetCouponsResponse, CouponDetailResponse } from './dto/response/get-coupons-response';
import { GetUserCouponsRequest } from './dto/request/get-user-coupons-request';
import { GetUserCouponsResponse, UserCouponDetailResponse } from './dto/response/get-user-coupons-response';
import { CouponStatus, UserCouponStatus } from './enum/coupon-status.enum';
import { CouponEntity } from './domain/coupon.entity';

@Injectable()
export class CouponService {
  constructor(
    @Inject(COUPON_REPOSITORY)
    private readonly couponRepository: ICouponRepository,
    @Inject(USER_COUPON_REPOSITORY)
    private readonly userCouponRepository: IUserCouponRepository,
  ) {}

  async issueCoupon(couponId: number, userId: number): Promise<UserCouponDetailResponse> {
    await this.validateDuplicateIssue(userId, couponId);

    const coupon = await this.validateCouponForIssue(couponId);

    await this.couponRepository.updateCouponStock(couponId, coupon.remainingStock - 1);

    const userCoupon = await this.userCouponRepository.saveUserCoupon({
      userId,
      couponId: coupon.id,
      status: UserCouponStatus.AVAILABLE,
      usedDate: null,
    });

    userCoupon.coupon = coupon;

    return UserCouponDetailResponse.of(userCoupon);
  }

  async getCoupons(query: GetCouponsRequest): Promise<GetCouponsResponse> {
    const page = query.page;
    const limit = query.limit;

    const [paginatedCoupons, totalCount] = await this.couponRepository.findCoupons(page, limit, query.status);

    const totalPages = Math.ceil(totalCount / limit);

    const response = new GetCouponsResponse();
    response.list = paginatedCoupons.map((entity) => CouponDetailResponse.of(entity));
    response.totalCount = totalCount;
    response.currentPage = page;
    response.totalPages = totalPages;

    return response;
  }

  async getUserCoupons(userId: number, query: GetUserCouponsRequest): Promise<GetUserCouponsResponse> {
    const page = query.page;
    const limit = query.limit;

    const [paginatedUserCoupons, totalCount] = await this.userCouponRepository.findUserCoupons(userId, page, limit);

    const totalPages = Math.ceil(totalCount / limit);

    const response = new GetUserCouponsResponse();
    response.list = paginatedUserCoupons.map((entity) => UserCouponDetailResponse.of(entity));
    response.totalCount = totalCount;
    response.currentPage = page;
    response.totalPages = totalPages;

    return response;
  }

  private async validateDuplicateIssue(userId: number, couponId: number): Promise<void> {
    const existingUserCoupon = await this.userCouponRepository.findUserCouponByUserIdAndCouponId(userId, couponId);

    if (existingUserCoupon) {
      throw new BadRequestException('이미 발급받은 쿠폰입니다.');
    }
  }

  private async validateCouponForIssue(couponId: number): Promise<CouponEntity> {
    const coupon = await this.couponRepository.findCouponById(couponId);

    if (!coupon) {
      throw new BadRequestException('존재하지 않는 쿠폰입니다.');
    }

    if (coupon.remainingStock < 1) {
      throw new BadRequestException('쿠폰 재고가 부족합니다.');
    }

    if (coupon.status === CouponStatus.EXPIRED) {
      throw new BadRequestException('만료된 쿠폰은 발급할 수 없습니다.');
    }

    if (coupon.status === CouponStatus.SUSPENDED) {
      throw new BadRequestException('일시중단된 쿠폰은 발급할 수 없습니다.');
    }

    return coupon;
  }

  async findAvailableUserCouponByCode(userId: number, couponCode: string): Promise<any> {
    return await this.userCouponRepository.findAvailableUserCouponByCode(userId, couponCode);
  }

  async validateAndGetDiscountAmount(userId: number, couponCode: string): Promise<number> {
    const userCoupon = await this.userCouponRepository.findAvailableUserCouponByCode(userId, couponCode);

    if (!userCoupon) {
      throw new BadRequestException('사용할 수 없는 쿠폰입니다. 쿠폰이 존재하지 않거나 이미 사용되었습니다.');
    }

    const currentDate = new Date();
    if (currentDate > userCoupon.coupon.expiryDate) {
      throw new BadRequestException('만료된 쿠폰입니다.');
    }

    return userCoupon.coupon.discountAmount;
  }

  async useCoupon(userId: number, couponCode: string): Promise<void> {
    const userCoupon = await this.userCouponRepository.findAvailableUserCouponByCode(userId, couponCode);

    if (!userCoupon) {
      throw new BadRequestException('사용할 수 없는 쿠폰입니다.');
    }

    const usedDate = new Date();
    await this.userCouponRepository.markUserCouponAsUsed(userCoupon.id, usedDate);
  }
}
