import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { OrderEntity } from './order.entity';
import { CouponEntity } from '../../coupon/domain/coupon.entity';
import { UserCouponEntity } from '../../coupon/domain/user-coupon.entity';

@Entity('order_coupons')
export class OrderCouponEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn({ comment: '생성일시' })
  createdAt: Date;

  @UpdateDateColumn({ comment: '수정일시' })
  updatedAt: Date;

  @Column({ type: 'int', comment: '주문 ID' })
  orderId: number;

  @Column({ type: 'int', comment: '쿠폰 ID' })
  couponId: number;

  @Column({ type: 'int', comment: '사용자 쿠폰 ID' })
  userCouponId: number;

  @Column({ type: 'int', comment: '할인 금액' })
  discountAmount: number;

  @OneToOne(() => OrderEntity, (order) => order.orderCoupon, { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'orderId' })
  order: OrderEntity;

  @ManyToOne(() => CouponEntity, { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'couponId' })
  coupon: CouponEntity;

  @ManyToOne(() => UserCouponEntity, { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'userCouponId' })
  userCoupon: UserCouponEntity;
}
