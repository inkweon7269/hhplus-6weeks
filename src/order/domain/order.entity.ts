import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
  OneToOne,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { UserEntity } from '../../user/domain/user.entity';
import { OrderProductEntity } from './order-product.entity';
import { OrderCouponEntity } from './order-coupon.entity';

@Entity('orders')
export class OrderEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn({ comment: '생성일시' })
  createdAt: Date;

  @UpdateDateColumn({ comment: '수정일시' })
  updatedAt: Date;

  @DeleteDateColumn({ comment: '삭제일시' })
  deletedAt: Date | null;

  @Column({ type: 'int', comment: '사용자 ID' })
  userId: number;

  @Column({ type: 'int', comment: '총 결제 금액' })
  totalPrice: number;

  @Column({
    type: 'varchar',
    length: 20,
    comment: '주문 상태',
    default: 'CONFIRMED',
  })
  status: string;

  @ManyToOne(() => UserEntity, (user) => user.orders)
  @JoinColumn({ name: 'userId' })
  user: UserEntity;

  @OneToMany(() => OrderProductEntity, (orderProduct) => orderProduct.order)
  orderProducts: OrderProductEntity[];

  @OneToOne(() => OrderCouponEntity, (orderCoupon) => orderCoupon.order)
  orderCoupon?: OrderCouponEntity;
}
