import { ProductOptionEntity } from './product-option.entity';

export interface IProductOptionRepository {
  saveMultipleStock(productOptions: ProductOptionEntity[]): Promise<void>;
  saveProductOption(productOption: Partial<ProductOptionEntity>): Promise<ProductOptionEntity>;
  findByIds(ids: number[]): Promise<ProductOptionEntity[]>;
  findById(id: number): Promise<ProductOptionEntity | null>;
  
  // 비관적 락을 사용한 재고 차감 메서드들
  deductStockWithPessimisticLock(productOptionId: number, quantity: number): Promise<ProductOptionEntity>;
  deductMultipleStockWithPessimisticLock(
    items: { productOptionId: number; quantity: number }[]
  ): Promise<ProductOptionEntity[]>;
}

export const PRODUCT_OPTION_REPOSITORY = Symbol('PRODUCT_OPTION_REPOSITORY');
