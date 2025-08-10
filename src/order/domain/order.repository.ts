import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { OrderEntity } from './order.entity';
import { IOrderRepository } from './order.repository.interface';

@Injectable()
export class OrderRepository implements IOrderRepository {
  constructor(
    @InjectRepository(OrderEntity)
    private readonly orderRepository: Repository<OrderEntity>,
  ) {}

  async saveOrder(order: Partial<OrderEntity>): Promise<OrderEntity> {
    return await this.orderRepository.save(order);
  }

  async findById(id: number): Promise<OrderEntity | null> {
    return await this.orderRepository.findOne({
      where: { id },
      relations: {
        orderProducts: {
          orderProductOptions: true,
        },
        user: true,
        orderCoupon: {
          coupon: true,
          userCoupon: true,
        },
      },
    });
  }
}
