import { OrderProductOptionEntity } from './order-product-option.entity';

export interface IOrderProductOptionRepository {
  saveOrderProductOption(orderProductOption: Partial<OrderProductOptionEntity>): Promise<OrderProductOptionEntity>;
  findById(id: number): Promise<OrderProductOptionEntity | null>;
  findByOrderProductId(orderProductId: number): Promise<OrderProductOptionEntity[]>;
}

export const ORDER_PRODUCT_OPTION_REPOSITORY = Symbol('ORDER_PRODUCT_OPTION_REPOSITORY');
