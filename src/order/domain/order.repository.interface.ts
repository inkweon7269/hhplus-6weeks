import { OrderEntity } from './order.entity';

export interface IOrderRepository {
  saveOrder(order: Partial<OrderEntity>): Promise<OrderEntity>;
  findById(id: number): Promise<OrderEntity | null>;
}

export const ORDER_REPOSITORY = Symbol('ORDER_REPOSITORY');
