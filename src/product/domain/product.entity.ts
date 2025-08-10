import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
} from 'typeorm';
import { ProductOptionEntity } from './product-option.entity';
import { OrderProductEntity } from '../../order/domain/order-product.entity';
import { ProductSalesDailyEntity } from './product-sales-daily.entity';

@Entity('products')
export class ProductEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn({ comment: '생성일시' })
  createdAt: Date;

  @UpdateDateColumn({ comment: '수정일시' })
  updatedAt: Date;

  @DeleteDateColumn({ comment: '삭제일시' })
  deletedAt: Date | null;

  @Column({ type: 'varchar', length: 255, comment: '상품명' })
  name: string;

  @OneToMany(() => ProductOptionEntity, (productOption) => productOption.product)
  productOptions: ProductOptionEntity[];

  @OneToMany(() => OrderProductEntity, (orderProduct) => orderProduct.product)
  orderProducts: OrderProductEntity[];

  @OneToMany(() => ProductSalesDailyEntity, (salesDaily) => salesDaily.product)
  salesDaily: ProductSalesDailyEntity[];
}
