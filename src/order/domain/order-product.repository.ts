import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { OrderProductEntity } from './order-product.entity';
import { IOrderProductRepository } from './order-product.repository.interface';

@Injectable()
export class OrderProductRepository implements IOrderProductRepository {
  constructor(
    @InjectRepository(OrderProductEntity)
    private readonly orderProductRepository: Repository<OrderProductEntity>,
  ) {}

  async saveOrderProduct(orderProduct: Partial<OrderProductEntity>): Promise<OrderProductEntity> {
    return await this.orderProductRepository.save(orderProduct);
  }

  async findById(id: number): Promise<OrderProductEntity | null> {
    return await this.orderProductRepository.findOne({
      where: { id },
      relations: {
        orderProductOptions: true,
        order: true,
        product: true,
      },
    });
  }

  async findByOrderId(orderId: number): Promise<OrderProductEntity[]> {
    return await this.orderProductRepository.find({
      where: { orderId },
      relations: {
        orderProductOptions: true,
        order: true,
        product: true,
      },
      order: {
        id: 'ASC',
      },
    });
  }
}
