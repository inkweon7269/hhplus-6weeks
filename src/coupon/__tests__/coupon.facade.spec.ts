import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CouponFacade } from '../coupon.facade';
import { CouponService } from '../coupon.service';
import { GetCouponsRequest } from '../dto/request/get-coupons-request';
import { GetUserCouponsRequest } from '../dto/request/get-user-coupons-request';
import { GetCouponsResponse, CouponDetailResponse } from '../dto/response/get-coupons-response';
import { GetUserCouponsResponse, UserCouponDetailResponse } from '../dto/response/get-user-coupons-response';
import { CouponStatus, UserCouponStatus } from '../enum/coupon-status.enum';

describe('CouponFacade', () => {
  let facade: CouponFacade;
  let couponService: jest.Mocked<CouponService>;

  const mockCouponDetailResponse: CouponDetailResponse = {
    id: 1,
    name: '10000 할인 쿠폰',
    couponCode: 'DISCOUNT10',
    discountAmount: 10000,
    remainingStock: 100,
    expiryDate: '2025-12-31',
    status: CouponStatus.AVAILABLE,
  };

  const mockUserCouponDetailResponse: UserCouponDetailResponse = {
    id: 1,
    couponCode: 'DISCOUNT10',
    couponName: '10000 할인 쿠폰',
    discountAmount: 10000,
    issuedDate: '2025-01-01',
    expiryDate: '2025-12-31',
    status: UserCouponStatus.AVAILABLE,
    usedDate: null,
    userId: 1,
  };

  const mockGetCouponsResponse: GetCouponsResponse = {
    list: [mockCouponDetailResponse],
    totalCount: 1,
    currentPage: 1,
    totalPages: 1,
  };

  const mockGetUserCouponsResponse: GetUserCouponsResponse = {
    list: [mockUserCouponDetailResponse],
    totalCount: 1,
    currentPage: 1,
    totalPages: 1,
  };

  beforeEach(async () => {
    const mockService = {
      issueCoupon: jest.fn(),
      getCoupons: jest.fn(),
      getUserCoupons: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CouponFacade,
        {
          provide: CouponService,
          useValue: mockService,
        },
      ],
    }).compile();

    facade = module.get<CouponFacade>(CouponFacade);
    couponService = module.get(CouponService);
  });

  it('should be defined', () => {
    expect(facade).toBeDefined();
  });

  describe('issueCoupon', () => {
    const couponId = 1;
    const userId = 1;

    it('이미 발급받은 쿠폰일 때 BadRequestException을 전달합니다.', async () => {
      const duplicateError = new BadRequestException('이미 발급받은 쿠폰입니다.');
      couponService.issueCoupon.mockRejectedValue(duplicateError);

      await expect(facade.issueCoupon(couponId, userId)).rejects.toThrow(duplicateError);
      expect(couponService.issueCoupon).toHaveBeenCalledWith(couponId, userId);
      expect(couponService.issueCoupon).toHaveBeenCalledTimes(1);
    });

    it('존재하지 않는 쿠폰일 때 BadRequestException을 전달합니다.', async () => {
      const notFoundError = new BadRequestException('존재하지 않는 쿠폰입니다.');
      couponService.issueCoupon.mockRejectedValue(notFoundError);

      await expect(facade.issueCoupon(couponId, userId)).rejects.toThrow(notFoundError);
      expect(couponService.issueCoupon).toHaveBeenCalledWith(couponId, userId);
      expect(couponService.issueCoupon).toHaveBeenCalledTimes(1);
    });

    it('재고가 부족한 쿠폰일 때 BadRequestException을 전달합니다.', async () => {
      const outOfStockError = new BadRequestException('쿠폰 재고가 부족합니다.');
      couponService.issueCoupon.mockRejectedValue(outOfStockError);

      await expect(facade.issueCoupon(couponId, userId)).rejects.toThrow(outOfStockError);
      expect(couponService.issueCoupon).toHaveBeenCalledWith(couponId, userId);
      expect(couponService.issueCoupon).toHaveBeenCalledTimes(1);
    });

    it('만료된 쿠폰일 때 BadRequestException을 전달합니다.', async () => {
      const expiredError = new BadRequestException('만료된 쿠폰은 발급할 수 없습니다.');
      couponService.issueCoupon.mockRejectedValue(expiredError);

      await expect(facade.issueCoupon(couponId, userId)).rejects.toThrow(expiredError);
      expect(couponService.issueCoupon).toHaveBeenCalledWith(couponId, userId);
      expect(couponService.issueCoupon).toHaveBeenCalledTimes(1);
    });

    it('일시중단된 쿠폰일 때 BadRequestException을 전달합니다.', async () => {
      const suspendedError = new BadRequestException('일시중단된 쿠폰은 발급할 수 없습니다.');
      couponService.issueCoupon.mockRejectedValue(suspendedError);

      await expect(facade.issueCoupon(couponId, userId)).rejects.toThrow(suspendedError);
      expect(couponService.issueCoupon).toHaveBeenCalledWith(couponId, userId);
      expect(couponService.issueCoupon).toHaveBeenCalledTimes(1);
    });

    it('정상적인 경우 쿠폰을 발급하고 UserCouponDetailResponse를 반환합니다.', async () => {
      couponService.issueCoupon.mockResolvedValue(mockUserCouponDetailResponse);

      const result = await facade.issueCoupon(couponId, userId);

      expect(result).toEqual(mockUserCouponDetailResponse);
      expect(couponService.issueCoupon).toHaveBeenCalledWith(couponId, userId);
      expect(couponService.issueCoupon).toHaveBeenCalledTimes(1);
    });
  });

  describe('getCoupons', () => {
    const query: GetCouponsRequest = { page: 1, limit: 10, status: CouponStatus.AVAILABLE };

    it('쿠폰 목록을 페이지네이션으로 조회합니다.', async () => {
      couponService.getCoupons.mockResolvedValue(mockGetCouponsResponse);

      const result = await facade.getCoupons(query);

      expect(result).toEqual(mockGetCouponsResponse);
      expect(couponService.getCoupons).toHaveBeenCalledWith(query);
      expect(couponService.getCoupons).toHaveBeenCalledTimes(1);
    });
  });

  describe('getUserCoupons', () => {
    const userId = 1;
    const query: GetUserCouponsRequest = { page: 1, limit: 10 };

    it('사용자 쿠폰 목록을 페이지네이션으로 조회합니다.', async () => {
      couponService.getUserCoupons.mockResolvedValue(mockGetUserCouponsResponse);

      const result = await facade.getUserCoupons(userId, query);

      expect(result).toEqual(mockGetUserCouponsResponse);
      expect(couponService.getUserCoupons).toHaveBeenCalledWith(userId, query);
      expect(couponService.getUserCoupons).toHaveBeenCalledTimes(1);
    });
  });
});
