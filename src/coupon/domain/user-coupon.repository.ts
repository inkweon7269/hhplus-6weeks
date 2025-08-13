import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { IUserCouponRepository } from './user-coupon.repository.interface';
import { UserCouponEntity } from './user-coupon.entity';
import { UserCouponStatus } from '../enum/coupon-status.enum';

@Injectable()
export class UserCouponRepository implements IUserCouponRepository {
  constructor(
    @InjectRepository(UserCouponEntity)
    private readonly userCouponRepo: Repository<UserCouponEntity>,
  ) {}

  async findUserCoupons(
    userId: number,
    page: number,
    limit: number,
    status?: UserCouponStatus,
  ): Promise<[UserCouponEntity[], number]> {
    const whereCondition: any = { userId };
    if (status) {
      whereCondition.status = status;
    }

    const skip = (page - 1) * limit;

    return await this.userCouponRepo.findAndCount({
      where: whereCondition,
      relations: {
        user: true,
        coupon: true,
      },
      skip,
      take: limit,
    });
  }

  async findAvailableUserCouponByCode(userId: number, couponCode: string): Promise<UserCouponEntity | null> {
    return await this.userCouponRepo
      .createQueryBuilder('userCoupon')
      .innerJoinAndSelect('userCoupon.coupon', 'coupon')
      .leftJoinAndSelect('userCoupon.user', 'user')
      .where('userCoupon.userId = :userId', { userId })
      .andWhere('coupon.couponCode = :couponCode', { couponCode })
      .andWhere('userCoupon.status = :status', { status: UserCouponStatus.AVAILABLE })
      .getOne();
  }

  async findUserCouponByUserIdAndCouponId(userId: number, couponId: number): Promise<UserCouponEntity | null> {
    return await this.userCouponRepo.findOne({
      where: {
        userId,
        couponId,
      },
      relations: {
        user: true,
        coupon: true,
      },
    });
  }

  async saveUserCoupon(userCoupon: Partial<UserCouponEntity>): Promise<UserCouponEntity> {
    const entity = this.userCouponRepo.create(userCoupon);
    return await this.userCouponRepo.save(entity);
  }

  async markUserCouponAsUsed(userCouponId: number, usedDate: Date): Promise<UserCouponEntity> {
    return await this.userCouponRepo.save({
      id: userCouponId,
      status: UserCouponStatus.USED,
      usedDate,
    });
  }
}
