import { Injectable, BadRequestException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { ICouponRepository } from './coupon.repository.interface';
import { CouponEntity } from './coupon.entity';
import { CouponStatus } from '../enum/coupon-status.enum';

@Injectable()
export class CouponRepository implements ICouponRepository {
  constructor(
    @InjectRepository(CouponEntity)
    private readonly couponRepo: Repository<CouponEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async findCoupons(page: number, limit: number, status?: CouponStatus): Promise<[CouponEntity[], number]> {
    const whereCondition = status ? { status } : {};
    const skip = (page - 1) * limit;

    return await this.couponRepo.findAndCount({
      where: whereCondition,
      skip,
      take: limit,
    });
  }

  async findCouponById(couponId: number): Promise<CouponEntity | null> {
    return await this.couponRepo.findOne({ where: { id: couponId } });
  }

  async saveCoupon(coupon: Partial<CouponEntity>): Promise<CouponEntity> {
    const entity = this.couponRepo.create(coupon);
    return await this.couponRepo.save(entity);
  }

  async updateCouponStock(couponId: number, remainingStock: number): Promise<CouponEntity> {
    await this.couponRepo.update({ id: couponId }, { remainingStock });
    const updatedCoupon = await this.findCouponById(couponId);
    if (!updatedCoupon) {
      throw new Error(`쿠폰을 찾을 수 없습니다. ID: ${couponId}`);
    }
    return updatedCoupon;
  }

  /**
   * 비관적 락(pessimistic_write)으로 쿠폰 행을 잠그고 재고를 1 감소시킵니다.
   * - 트랜잭션 내 SELECT ... FOR UPDATE로 행 잠금
   * - 잠금 이후 상태/만료/재고 검증
   * - 재고 차감 및 업데이트
   */
  async decrementStockWithPessimisticLock(couponId: number): Promise<CouponEntity> {
    return await this.dataSource.transaction('READ COMMITTED', async (manager) => {
      // 1) 쿠폰 행 잠금
      const lockedCoupon = await manager
        .createQueryBuilder(CouponEntity, 'coupon')
        .setLock('pessimistic_write')
        .where('coupon.id = :couponId', { couponId })
        .getOne();

      if (!lockedCoupon) {
        throw new BadRequestException('존재하지 않는 쿠폰입니다.');
      }

      // 2) 잠금 후 상태/만료/재고 검증
      if (lockedCoupon.status === CouponStatus.EXPIRED) {
        throw new BadRequestException('만료된 쿠폰은 발급할 수 없습니다.');
      }
      if (lockedCoupon.status === CouponStatus.SUSPENDED) {
        throw new BadRequestException('일시중단된 쿠폰은 발급할 수 없습니다.');
      }
      if (lockedCoupon.expiryDate && lockedCoupon.expiryDate < new Date()) {
        throw new BadRequestException('만료된 쿠폰은 발급할 수 없습니다.');
      }
      if (lockedCoupon.remainingStock < 1) {
        throw new BadRequestException('쿠폰 재고가 부족합니다.');
      }

      // 3) 재고 차감 (추가 안전장치로 remainingStock > 0 조건 유지)
      const updateResult = await manager
        .createQueryBuilder()
        .update(CouponEntity)
        .set({
          remainingStock: () => '"remainingStock" - 1',
          updatedAt: () => 'NOW()',
        })
        .where('id = :couponId', { couponId })
        .andWhere('"remainingStock" > 0')
        .execute();

      if (updateResult.affected !== 1) {
        throw new BadRequestException('쿠폰 재고가 부족합니다.');
      }

      const updatedCoupon = await manager.findOne(CouponEntity, { where: { id: couponId } });
      if (!updatedCoupon) {
        throw new BadRequestException('쿠폰 정보를 조회할 수 없습니다.');
      }
      return updatedCoupon;
    });
  }
}
