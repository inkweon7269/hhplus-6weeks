import { CouponEntity } from './coupon.entity';
import { CouponStatus } from '../enum/coupon-status.enum';

export interface ICouponRepository {
  findCoupons(page: number, limit: number, status?: CouponStatus): Promise<[CouponEntity[], number]>;
  findCouponById(couponId: number): Promise<CouponEntity | null>;
  saveCoupon(coupon: Partial<CouponEntity>): Promise<CouponEntity>;
  updateCouponStock(couponId: number, remainingStock: number): Promise<CouponEntity>;
  /**
   * 비관적 락을 사용하여 재고를 원자적으로 1 감소시킵니다.
   * - 트랜잭션 내에서 해당 쿠폰 행을 잠근 뒤 상태/만료/재고를 검증하고 차감합니다.
   * - 성공 시 최신 쿠폰 엔티티를 반환합니다.
   */
  decrementStockWithPessimisticLock(couponId: number): Promise<CouponEntity>;
}

export const COUPON_REPOSITORY = Symbol('COUPON_REPOSITORY');
