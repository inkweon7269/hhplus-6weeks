import { ProductOptionEntity } from './product-option.entity';

export interface IProductOptionRepository {
  saveMultipleStock(productOptions: ProductOptionEntity[]): Promise<void>;
  saveProductOption(productOption: Partial<ProductOptionEntity>): Promise<ProductOptionEntity>;
  findByIds(ids: number[]): Promise<ProductOptionEntity[]>;
  findById(id: number): Promise<ProductOptionEntity | null>;
}

export const PRODUCT_OPTION_REPOSITORY = Symbol('PRODUCT_OPTION_REPOSITORY');
