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
import { RedisCacheService } from '../redis/redis-cache.service';

@Injectable()
export class CouponService {
  constructor(
    @Inject(COUPON_REPOSITORY)
    private readonly couponRepository: ICouponRepository,
    @Inject(USER_COUPON_REPOSITORY)
    private readonly userCouponRepository: IUserCouponRepository,
    private readonly redisLockService: RedisLockService,
    private readonly redisCacheService: RedisCacheService,
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

    // 쿠폰 발급 후 해당 사용자의 쿠폰 목록 캐시 무효화
    await this.invalidateUserCouponCache(userId);
    // 재고가 변경되었으므로 전체 쿠폰 목록 캐시도 무효화
    await this.invalidateCouponListCache();

    return UserCouponDetailResponse.of(userCoupon);
  }

  async getCoupons(query: GetCouponsRequest): Promise<GetCouponsResponse> {
    const page = query.page;
    const limit = query.limit;
    const status = query.status || 'all';

    // 캐시 키 생성
    const cacheKey = `coupons:list:page:${page}:limit:${limit}:status:${status}`;

    // 캐시에서 먼저 조회
    const cachedCoupons = await this.redisCacheService.get<GetCouponsResponse>(cacheKey);
    if (cachedCoupons) {
      return cachedCoupons;
    }

    // 캐시에 없으면 DB에서 조회
    const [paginatedCoupons, totalCount] = await this.couponRepository.findCoupons(page, limit, query.status);

    const totalPages = Math.ceil(totalCount / limit);

    const response = new GetCouponsResponse();
    response.list = paginatedCoupons.map((entity) => CouponDetailResponse.of(entity));
    response.totalCount = totalCount;
    response.currentPage = page;
    response.totalPages = totalPages;

    // 조회된 결과를 캐시에 저장 (5분 TTL)
    await this.redisCacheService.set(cacheKey, response, 300);

    return response;
  }

  async getUserCoupons(userId: number, query: GetUserCouponsRequest): Promise<GetUserCouponsResponse> {
    const page = query.page;
    const limit = query.limit;

    // 캐시 키 생성
    const cacheKey = `user:${userId}:coupons:page:${page}:limit:${limit}`;

    // 캐시에서 먼저 조회
    const cachedUserCoupons = await this.redisCacheService.get<GetUserCouponsResponse>(cacheKey);
    if (cachedUserCoupons) {
      return cachedUserCoupons;
    }

    // 캐시에 없으면 DB에서 조회
    const [paginatedUserCoupons, totalCount] = await this.userCouponRepository.findUserCoupons(userId, page, limit);

    const totalPages = Math.ceil(totalCount / limit);

    const response = new GetUserCouponsResponse();
    response.list = paginatedUserCoupons.map((entity) => UserCouponDetailResponse.of(entity));
    response.totalCount = totalCount;
    response.currentPage = page;
    response.totalPages = totalPages;

    // 조회된 결과를 캐시에 저장 (3분 TTL - 사용자별 데이터이므로 짧은 TTL)
    await this.redisCacheService.set(cacheKey, response, 180);

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
    const result = await this.userCouponRepository.markUserCouponAsUsed(userCoupon.id, usedDate);
    
    // 쿠폰 사용 후 해당 사용자의 쿠폰 목록 캐시 무효화
    await this.invalidateUserCouponCache(userId);
    
    return result;
  }

  /**
   * 사용자 쿠폰 목록 캐시 무효화
   */
  private async invalidateUserCouponCache(userId: number): Promise<void> {
    // 사용자의 모든 페이지 캐시 무효화
    await this.redisCacheService.delPattern(`user:${userId}:coupons:*`);
  }

  /**
   * 전체 쿠폰 목록 캐시 무효화
   */
  private async invalidateCouponListCache(): Promise<void> {
    // 모든 쿠폰 목록 캐시 무효화
    await this.redisCacheService.delPattern('coupons:list:*');
  }
}
