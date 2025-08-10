import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CouponController } from './coupon.controller';
import { CouponService } from './coupon.service';
import { CouponFacade } from './coupon.facade';
import { CouponEntity } from './domain/coupon.entity';
import { UserCouponEntity } from './domain/user-coupon.entity';
import { CouponRepository } from './domain/coupon.repository';
import { UserCouponRepository } from './domain/user-coupon.repository';
import { COUPON_REPOSITORY } from './domain/coupon.repository.interface';
import { USER_COUPON_REPOSITORY } from './domain/user-coupon.repository.interface';

@Module({
  imports: [TypeOrmModule.forFeature([CouponEntity, UserCouponEntity])],
  controllers: [CouponController],
  providers: [
    {
      provide: COUPON_REPOSITORY,
      useClass: CouponRepository,
    },
    {
      provide: USER_COUPON_REPOSITORY,
      useClass: UserCouponRepository,
    },
    CouponService,
    CouponFacade,
  ],
  exports: [CouponFacade, CouponService],
})
export class CouponModule {}
