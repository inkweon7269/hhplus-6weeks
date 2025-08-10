import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { OrderProductEntity } from './order-product.entity';
import { ProductOptionEntity } from '../../product/domain/product-option.entity';

@Entity('order_product_options')
export class OrderProductOptionEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn({ comment: '생성일시' })
  createdAt: Date;

  @UpdateDateColumn({ comment: '수정일시' })
  updatedAt: Date;

  @DeleteDateColumn({ comment: '삭제일시' })
  deletedAt: Date | null;

  @Column({ type: 'int', comment: '주문 상품 ID' })
  orderProductId: number;

  @Column({ type: 'int', comment: '상품 옵션 ID' })
  productOptionId: number;

  @Column({ type: 'varchar', length: 255, comment: '옵션명' })
  name: string;

  @Column({ type: 'int', comment: '가격' })
  price: number;

  @Column({ type: 'int', comment: '수량' })
  quantity: number;

  @ManyToOne(() => OrderProductEntity, (orderProduct) => orderProduct.orderProductOptions, {
    createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'orderProductId' })
  orderProduct: OrderProductEntity;

  @ManyToOne(() => ProductOptionEntity, (productOption) => productOption.orderProductOptions, {
    createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'productOptionId' })
  productOption: ProductOptionEntity;
}
