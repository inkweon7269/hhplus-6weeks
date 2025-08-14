import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CouponService } from '../coupon.service';
import { ICouponRepository, COUPON_REPOSITORY } from '../domain/coupon.repository.interface';
import { IUserCouponRepository, USER_COUPON_REPOSITORY } from '../domain/user-coupon.repository.interface';
import { CouponEntity } from '../domain/coupon.entity';
import { UserCouponEntity } from '../domain/user-coupon.entity';
import { CouponStatus, UserCouponStatus } from '../enum/coupon-status.enum';
import { GetCouponsRequest } from '../dto/request/get-coupons-request';
import { GetUserCouponsRequest } from '../dto/request/get-user-coupons-request';

describe('CouponService', () => {
  let service: CouponService;
  let couponRepository: jest.Mocked<ICouponRepository>;
  let userCouponRepository: jest.Mocked<IUserCouponRepository>;

  const mockCouponEntity: CouponEntity = {
    id: 1,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    couponCode: 'DISCOUNT10',
    name: '10000 할인 쿠폰',
    discountAmount: 10000,
    remainingStock: 100,
    expiryDate: new Date('2025-12-31'),
    status: CouponStatus.AVAILABLE,
    userCoupons: [],
  };

  const mockUserCouponEntity: UserCouponEntity = {
    id: 1,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    userId: 1,
    couponId: 1,
    status: UserCouponStatus.AVAILABLE,
    usedDate: null,
    user: null,
    coupon: mockCouponEntity,
  };

  beforeEach(async () => {
    const mockCouponRepository = {
      findCoupons: jest.fn(),
      findCouponById: jest.fn(),
      saveCoupon: jest.fn(),
      updateCouponStock: jest.fn(),
      // 비관적 락 기반 재고 차감 메서드 추가
      decrementStockWithPessimisticLock: jest.fn(),
    };

    const mockUserCouponRepository = {
      findUserCoupons: jest.fn(),
      findAvailableUserCouponByCode: jest.fn(),
      findUserCouponByUserIdAndCouponId: jest.fn(),
      saveUserCoupon: jest.fn(),
      markUserCouponAsUsed: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CouponService,
        {
          provide: COUPON_REPOSITORY,
          useValue: mockCouponRepository,
        },
        {
          provide: USER_COUPON_REPOSITORY,
          useValue: mockUserCouponRepository,
        },
      ],
    }).compile();

    service = module.get<CouponService>(CouponService);
    couponRepository = module.get(COUPON_REPOSITORY);
    userCouponRepository = module.get(USER_COUPON_REPOSITORY);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('issueCoupon', () => {
    const couponId = 1;
    const userId = 1;

    it('이미 발급받은 쿠폰일 때 BadRequestException을 발생시킵니다.', async () => {
      userCouponRepository.findUserCouponByUserIdAndCouponId.mockResolvedValue(mockUserCouponEntity);

      await expect(service.issueCoupon(couponId, userId)).rejects.toThrow(
        new BadRequestException('이미 발급받은 쿠폰입니다.'),
      );
      expect(userCouponRepository.findUserCouponByUserIdAndCouponId).toHaveBeenCalledWith(userId, couponId);
    });

    it('존재하지 않는 쿠폰일 때 BadRequestException을 발생시킵니다.', async () => {
      userCouponRepository.findUserCouponByUserIdAndCouponId.mockResolvedValue(null);
      couponRepository.findCouponById.mockResolvedValue(null);

      await expect(service.issueCoupon(couponId, userId)).rejects.toThrow(
        new BadRequestException('존재하지 않는 쿠폰입니다.'),
      );
      expect(couponRepository.findCouponById).toHaveBeenCalledWith(couponId);
    });

    it('재고가 부족한 쿠폰일 때 BadRequestException을 발생시킵니다.', async () => {
      const outOfStockCoupon = { ...mockCouponEntity, remainingStock: 0 };
      userCouponRepository.findUserCouponByUserIdAndCouponId.mockResolvedValue(null);
      couponRepository.findCouponById.mockResolvedValue(outOfStockCoupon);

      await expect(service.issueCoupon(couponId, userId)).rejects.toThrow(
        new BadRequestException('쿠폰 재고가 부족합니다.'),
      );
    });

    it('만료된 쿠폰일 때 BadRequestException을 발생시킵니다.', async () => {
      const expiredCoupon = { ...mockCouponEntity, status: CouponStatus.EXPIRED };
      userCouponRepository.findUserCouponByUserIdAndCouponId.mockResolvedValue(null);
      couponRepository.findCouponById.mockResolvedValue(expiredCoupon);

      await expect(service.issueCoupon(couponId, userId)).rejects.toThrow(
        new BadRequestException('만료된 쿠폰은 발급할 수 없습니다.'),
      );
    });

    it('일시중단된 쿠폰일 때 BadRequestException을 발생시킵니다.', async () => {
      const suspendedCoupon = { ...mockCouponEntity, status: CouponStatus.SUSPENDED };
      userCouponRepository.findUserCouponByUserIdAndCouponId.mockResolvedValue(null);
      couponRepository.findCouponById.mockResolvedValue(suspendedCoupon);

      await expect(service.issueCoupon(couponId, userId)).rejects.toThrow(
        new BadRequestException('일시중단된 쿠폰은 발급할 수 없습니다.'),
      );
    });

    it('정상적인 경우 쿠폰을 발급하고 UserCouponDetailResponse를 반환합니다.', async () => {
      userCouponRepository.findUserCouponByUserIdAndCouponId.mockResolvedValue(null);
      couponRepository.findCouponById.mockResolvedValue(mockCouponEntity);
      couponRepository.decrementStockWithPessimisticLock.mockResolvedValue({
        ...mockCouponEntity,
        remainingStock: 99,
      });
      userCouponRepository.saveUserCoupon.mockResolvedValue(mockUserCouponEntity);

      const result = await service.issueCoupon(couponId, userId);

      expect(userCouponRepository.findUserCouponByUserIdAndCouponId).toHaveBeenCalledWith(userId, couponId);
      expect(couponRepository.findCouponById).toHaveBeenCalledWith(couponId);
      expect(couponRepository.decrementStockWithPessimisticLock).toHaveBeenCalledWith(couponId);
      expect(userCouponRepository.saveUserCoupon).toHaveBeenCalledWith({
        userId,
        couponId,
        status: UserCouponStatus.AVAILABLE,
        usedDate: null,
      });
      expect(result.id).toEqual(mockUserCouponEntity.id);
      expect(result.userId).toEqual(userId);
    });
  });

  describe('getCoupons', () => {
    const query: GetCouponsRequest = { page: 1, limit: 10, status: CouponStatus.AVAILABLE };

    it('쿠폰 목록을 페이지네이션으로 조회합니다.', async () => {
      const totalCount = 5;
      const mockCoupons = [mockCouponEntity];
      couponRepository.findCoupons.mockResolvedValue([mockCoupons, totalCount]);

      const result = await service.getCoupons(query);

      expect(result.list).toHaveLength(1);
      expect(result.totalCount).toEqual(totalCount);
      expect(result.currentPage).toEqual(query.page);
      expect(result.totalPages).toEqual(1);
      expect(couponRepository.findCoupons).toHaveBeenCalledWith(query.page, query.limit, query.status);
    });
  });

  describe('getUserCoupons', () => {
    const userId = 1;
    const query: GetUserCouponsRequest = { page: 1, limit: 10 };

    it('사용자 쿠폰 목록을 페이지네이션으로 조회합니다.', async () => {
      const totalCount = 3;
      const mockUserCoupons = [mockUserCouponEntity];
      userCouponRepository.findUserCoupons.mockResolvedValue([mockUserCoupons, totalCount]);

      const result = await service.getUserCoupons(userId, query);

      expect(result.list).toHaveLength(1);
      expect(result.totalCount).toEqual(totalCount);
      expect(result.currentPage).toEqual(query.page);
      expect(result.totalPages).toEqual(1);
      expect(userCouponRepository.findUserCoupons).toHaveBeenCalledWith(userId, query.page, query.limit);
    });
  });

  describe('useCoupon', () => {
    const userId = 1;
    const couponCode = 'DISCOUNT10';

    it('사용할 수 없는 쿠폰일 때 BadRequestException을 발생시킵니다.', async () => {
      userCouponRepository.findAvailableUserCouponByCode.mockResolvedValue(null);

      await expect(service.useCoupon(userId, couponCode)).rejects.toThrow(
        new BadRequestException('사용할 수 없는 쿠폰입니다. 쿠폰이 존재하지 않거나 이미 사용되었습니다.'),
      );
      expect(userCouponRepository.findAvailableUserCouponByCode).toHaveBeenCalledWith(userId, couponCode);
    });

    it('정상적인 경우 쿠폰을 사용 처리하고 업데이트된 쿠폰 정보를 반환합니다.', async () => {
      const usedUserCoupon = { ...mockUserCouponEntity, status: UserCouponStatus.USED, usedDate: new Date() };
      userCouponRepository.findAvailableUserCouponByCode.mockResolvedValue(mockUserCouponEntity);
      userCouponRepository.markUserCouponAsUsed.mockResolvedValue(usedUserCoupon);

      const result = await service.useCoupon(userId, couponCode);

      expect(result).toEqual(usedUserCoupon);
      expect(userCouponRepository.findAvailableUserCouponByCode).toHaveBeenCalledWith(userId, couponCode);
      expect(userCouponRepository.markUserCouponAsUsed).toHaveBeenCalledWith(mockUserCouponEntity.id, expect.any(Date));
    });
  });
});
