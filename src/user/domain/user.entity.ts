import { Entity, PrimaryGeneratedColumn, Column, OneToOne, OneToMany } from 'typeorm';
import { BalanceEntity } from '../../balance/domain/balance.entity';
import { UserCouponEntity } from '../../coupon/domain/user-coupon.entity';
import { OrderEntity } from '../../order/domain/order.entity';

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  // BalanceEntity와 OneToOne 관계 (inverse side)
  @OneToOne(() => BalanceEntity, (balance) => balance.user)
  balance: BalanceEntity;

  // UserCouponEntity와 OneToMany 관계 (사용자가 발급받은 쿠폰들)
  @OneToMany(() => UserCouponEntity, (userCoupon) => userCoupon.user)
  userCoupons: UserCouponEntity[];

  // OrderEntity와 OneToMany 관계 (사용자의 주문들)
  @OneToMany(() => OrderEntity, (order) => order.user)
  orders: OrderEntity[];
}
