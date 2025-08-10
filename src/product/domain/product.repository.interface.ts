import { ProductEntity } from './product.entity';

export interface IProductRepository {
  findProducts(page: number, limit: number): Promise<[ProductEntity[], number]>;
  findByIdWithOptions(id: number): Promise<ProductEntity | null>;
  findByProductOptionIds(productOptionIds: number[]): Promise<ProductEntity[]>;
  saveProduct(product: Partial<ProductEntity>): Promise<ProductEntity>;
}

export const PRODUCT_REPOSITORY = Symbol('PRODUCT_REPOSITORY');
