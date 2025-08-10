import { OrderProductEntity } from './order-product.entity';

export interface IOrderProductRepository {
  saveOrderProduct(orderProduct: Partial<OrderProductEntity>): Promise<OrderProductEntity>;
  findById(id: number): Promise<OrderProductEntity | null>;
  findByOrderId(orderId: number): Promise<OrderProductEntity[]>;
}

export const ORDER_PRODUCT_REPOSITORY = Symbol('ORDER_PRODUCT_REPOSITORY');
