import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { UserCouponStatus } from '../enum/coupon-status.enum';
import { UserEntity } from '../../user/domain/user.entity';
import { CouponEntity } from './coupon.entity';

@Entity('user_coupons')
export class UserCouponEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn({ comment: '생성일시 (발급일)' })
  createdAt: Date;

  @UpdateDateColumn({ comment: '수정일시' })
  updatedAt: Date;

  @Column({ type: 'int', comment: '사용자 ID' })
  userId: number;

  @Column({ type: 'int', comment: '쿠폰 ID' })
  couponId: number;

  @Column({
    type: 'varchar',
    length: 20,
    default: UserCouponStatus.AVAILABLE,
    comment: '사용자 쿠폰 상태 (AVAILABLE: 사용 가능, USED: 사용됨, EXPIRED: 만료됨)',
  })
  status: UserCouponStatus;

  @Column({ type: 'timestamp', nullable: true, comment: '사용일' })
  usedDate: Date | null;

  // 관계 설정 (FK 제약조건 없이 조인으로만 조회)
  @ManyToOne(() => UserEntity, { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'userId' })
  user: UserEntity;

  @ManyToOne(() => CouponEntity, { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'couponId' })
  coupon: CouponEntity;
}
