import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { CouponStatus } from '../enum/coupon-status.enum';
import { UserCouponEntity } from './user-coupon.entity';

@Entity('coupons')
export class CouponEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn({ comment: '생성일시' })
  createdAt: Date;

  @UpdateDateColumn({ comment: '수정일시' })
  updatedAt: Date;

  @Column({ type: 'varchar', length: 10, unique: true, comment: '쿠폰 코드' })
  couponCode: string;

  @Column({ type: 'varchar', length: 20, comment: '쿠폰명' })
  name: string;

  @Column({ type: 'int', comment: '할인 금액' })
  discountAmount: number;

  @Column({ type: 'int', comment: '남은 재고' })
  remainingStock: number;

  @Column({ type: 'timestamp', comment: '만료일' })
  expiryDate: Date;

  @Column({
    type: 'varchar',
    length: 20,
    default: CouponStatus.AVAILABLE,
    comment: '쿠폰 상태 (AVAILABLE: 발급 가능, SUSPENDED: 발급 중단, EXPIRED: 발급 기간 만료)',
  })
  status: CouponStatus;

  @OneToMany(() => UserCouponEntity, (userCoupon) => userCoupon.coupon)
  userCoupons: UserCouponEntity[];
}
