import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ProductEntity } from './product.entity';

@Entity('product_sales_daily')
export class ProductSalesDailyEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', comment: '상품 ID' })
  productId: number;

  @Column({ type: 'date', comment: '판매 날짜' })
  salesDate: Date;

  @Column({ type: 'int', default: 0, comment: '판매 수량' })
  salesCount: number;

  @CreateDateColumn({ comment: '생성일시' })
  createdAt: Date;

  @UpdateDateColumn({ comment: '수정일시' })
  updatedAt: Date;

  @ManyToOne(() => ProductEntity, (product) => product.salesDaily, {
    createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'productId' })
  product: ProductEntity;
}
