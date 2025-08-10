import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { ICouponRepository } from './coupon.repository.interface';
import { CouponEntity } from './coupon.entity';
import { CouponStatus } from '../enum/coupon-status.enum';

@Injectable()
export class CouponRepository implements ICouponRepository {
  constructor(
    @InjectRepository(CouponEntity)
    private readonly couponRepo: Repository<CouponEntity>,
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
}
