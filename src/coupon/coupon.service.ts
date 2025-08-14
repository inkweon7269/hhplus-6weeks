import { Injectable, BadRequestException, Inject, ConflictException } from '@nestjs/common';
import { ICouponRepository, COUPON_REPOSITORY } from './domain/coupon.repository.interface';
import { IUserCouponRepository, USER_COUPON_REPOSITORY } from './domain/user-coupon.repository.interface';
import { GetCouponsRequest } from './dto/request/get-coupons-request';
import { GetCouponsResponse, CouponDetailResponse } from './dto/response/get-coupons-response';
import { GetUserCouponsRequest } from './dto/request/get-user-coupons-request';
import { GetUserCouponsResponse, UserCouponDetailResponse } from './dto/response/get-user-coupons-response';
import { CouponStatus, UserCouponStatus } from './enum/coupon-status.enum';
import { CouponEntity } from './domain/coupon.entity';
import { Retry } from '../common/decorator/retry.decorator';
import { QueryFailedError } from 'typeorm';
import { UserCouponEntity } from './domain/user-coupon.entity';
import { RedisLockService } from '../redis/redis-lock.service';

@Injectable()
export class CouponService {
  constructor(
    @Inject(COUPON_REPOSITORY)
    private readonly couponRepository: ICouponRepository,
    @Inject(USER_COUPON_REPOSITORY)
    private readonly userCouponRepository: IUserCouponRepository,
    private readonly redisLockService: RedisLockService,
  ) {}

  async issueCoupon(couponId: number, userId: number): Promise<UserCouponDetailResponse> {
    const lockKey = `issue:coupon:${userId}:${couponId}`;
    const lockValue = this.redisLockService.generateLockValue('issueCoupon', userId);
    const lockTTL = 5;

    const acquired = await this.redisLockService.tryAcquireLock(lockKey, lockValue, {
      ttlSeconds: lockTTL,
      retryAttempts: 3,
      retryDelayMs: 100,
    });

    if (!acquired) {
      throw new ConflictException(
        `쿠폰 발급이 진행 중입니다. 잠시 후 다시 시도해주세요. (사용자: ${userId}, 쿠폰: ${couponId})`,
      );
    }

    try {
      return await this.executeCouponIssueWithRetry(couponId, userId);
    } finally {
      await this.redisLockService.releaseLock(lockKey, lockValue);
    }
  }

  @Retry({
    maxAttempts: 3,
    baseDelay: 100,
    retryIf: (error: any) => {
      return (
        error instanceof QueryFailedError &&
        (error.message?.includes('lock') || error.message?.includes('timeout') || error.message?.includes('deadlock'))
      );
    },
  })
  private async executeCouponIssueWithRetry(couponId: number, userId: number): Promise<UserCouponDetailResponse> {
    await this.validateDuplicateIssue(userId, couponId);
    await this.validateCouponForIssue(couponId);

    const updatedCoupon = await this.couponRepository.decrementStockWithPessimisticLock(couponId);

    const userCoupon = await this.userCouponRepository.saveUserCoupon({
      userId,
      couponId: updatedCoupon.id,
      status: UserCouponStatus.AVAILABLE,
      usedDate: null,
    });

    userCoupon.coupon = updatedCoupon;

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

  async validateAndGetCouponInfo(userId: number, couponCode: string): Promise<UserCouponEntity> {
    const userCoupon = await this.userCouponRepository.findAvailableUserCouponByCode(userId, couponCode);

    if (!userCoupon) {
      throw new BadRequestException('사용할 수 없는 쿠폰입니다. 쿠폰이 존재하지 않거나 이미 사용되었습니다.');
    }

    const currentDate = new Date();
    if (currentDate > userCoupon.coupon.expiryDate) {
      throw new BadRequestException('만료된 쿠폰입니다.');
    }

    return userCoupon;
  }

  async useCoupon(userId: number, couponCode: string): Promise<UserCouponEntity> {
    const userCoupon = await this.validateAndGetCouponInfo(userId, couponCode);
    const usedDate = new Date();
    return await this.userCouponRepository.markUserCouponAsUsed(userCoupon.id, usedDate);
  }
}
