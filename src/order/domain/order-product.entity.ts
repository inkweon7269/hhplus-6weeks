import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { OrderEntity } from './order.entity';
import { ProductEntity } from '../../product/domain/product.entity';
import { OrderProductOptionEntity } from './order-product-option.entity';

@Entity('order_products')
export class OrderProductEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn({ comment: '생성일시' })
  createdAt: Date;

  @UpdateDateColumn({ comment: '수정일시' })
  updatedAt: Date;

  @DeleteDateColumn({ comment: '삭제일시' })
  deletedAt: Date | null;

  @Column({ type: 'int', comment: '주문 ID' })
  orderId: number;

  @Column({ type: 'int', comment: '상품 ID' })
  productId: number;

  @Column({ type: 'varchar', length: 255, comment: '상품명' })
  name: string;

  @ManyToOne(() => OrderEntity, (order) => order.orderProducts, {
    createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'orderId' })
  order: OrderEntity;

  @ManyToOne(() => ProductEntity, (product) => product.orderProducts, {
    createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'productId' })
  product: ProductEntity;

  @OneToMany(() => OrderProductOptionEntity, (orderProductOption) => orderProductOption.orderProduct)
  orderProductOptions: OrderProductOptionEntity[];
}
