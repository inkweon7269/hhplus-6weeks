import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderCouponEntity } from './order-coupon.entity';
import { IOrderCouponRepository } from './order-coupon.repository.interface';

@Injectable()
export class OrderCouponRepository implements IOrderCouponRepository {
  constructor(
    @InjectRepository(OrderCouponEntity)
    private readonly orderCouponRepository: Repository<OrderCouponEntity>,
  ) {}

  async saveOrderCoupon(data: {
    orderId: number;
    couponId: number;
    userCouponId: number;
    discountAmount: number;
  }): Promise<OrderCouponEntity> {
    const orderCoupon = this.orderCouponRepository.create(data);
    return await this.orderCouponRepository.save(orderCoupon);
  }

  async findByOrderId(orderId: number): Promise<OrderCouponEntity | null> {
    return await this.orderCouponRepository.findOne({
      where: { orderId },
      relations: ['coupon', 'userCoupon'],
    });
  }
}
