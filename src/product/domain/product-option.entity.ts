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
import { ProductEntity } from './product.entity';
import { OrderProductOptionEntity } from '../../order/domain/order-product-option.entity';

@Entity('product_options')
export class ProductOptionEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn({ comment: '생성일시' })
  createdAt: Date;

  @UpdateDateColumn({ comment: '수정일시' })
  updatedAt: Date;

  @DeleteDateColumn({ comment: '삭제일시' })
  deletedAt: Date | null;

  @Column({ type: 'varchar', length: 255, comment: '옵션명' })
  name: string;

  @Column({ type: 'int', comment: '가격' })
  price: number;

  @Column({ type: 'int', comment: '재고' })
  stock: number;

  @Column({ type: 'int', comment: '상품 ID' })
  productId: number;

  @ManyToOne(() => ProductEntity, (product) => product.productOptions)
  @JoinColumn({ name: 'productId' })
  product: ProductEntity;

  @OneToMany(() => OrderProductOptionEntity, (orderProductOption) => orderProductOption.productOption)
  orderProductOptions: OrderProductOptionEntity[];
}
