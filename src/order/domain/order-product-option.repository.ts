import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { OrderProductOptionEntity } from './order-product-option.entity';
import { IOrderProductOptionRepository } from './order-product-option.repository.interface';

@Injectable()
export class OrderProductOptionRepository implements IOrderProductOptionRepository {
  constructor(
    @InjectRepository(OrderProductOptionEntity)
    private readonly orderProductOptionRepository: Repository<OrderProductOptionEntity>,
  ) {}

  async saveOrderProductOption(
    orderProductOption: Partial<OrderProductOptionEntity>,
  ): Promise<OrderProductOptionEntity> {
    return await this.orderProductOptionRepository.save(orderProductOption);
  }

  async findById(id: number): Promise<OrderProductOptionEntity | null> {
    return await this.orderProductOptionRepository.findOne({
      where: { id },
      relations: {
        orderProduct: true,
        productOption: true,
      },
    });
  }

  async findByOrderProductId(orderProductId: number): Promise<OrderProductOptionEntity[]> {
    return await this.orderProductOptionRepository.find({
      where: { orderProductId },
      relations: {
        orderProduct: true,
        productOption: true,
      },
      order: {
        id: 'ASC',
      },
    });
  }
}
