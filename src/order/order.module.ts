import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { OrderFacade } from './order.facade';
import { OrderRepository } from './domain/order.repository';
import { IOrderRepository, ORDER_REPOSITORY } from './domain/order.repository.interface';
import { OrderProductRepository } from './domain/order-product.repository';
import { IOrderProductRepository, ORDER_PRODUCT_REPOSITORY } from './domain/order-product.repository.interface';
import { OrderProductOptionRepository } from './domain/order-product-option.repository';
import {
  IOrderProductOptionRepository,
  ORDER_PRODUCT_OPTION_REPOSITORY,
} from './domain/order-product-option.repository.interface';
import { OrderCouponRepository } from './domain/order-coupon.repository';
import { IOrderCouponRepository, ORDER_COUPON_REPOSITORY } from './domain/order-coupon.repository.interface';
import { OrderEntity } from './domain/order.entity';
import { OrderProductEntity } from './domain/order-product.entity';
import { OrderProductOptionEntity } from './domain/order-product-option.entity';
import { OrderCouponEntity } from './domain/order-coupon.entity';
import { BalanceModule } from '../balance/balance.module';
import { ProductModule } from '../product/product.module';
import { CouponModule } from '../coupon/coupon.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([OrderEntity, OrderProductEntity, OrderProductOptionEntity, OrderCouponEntity]),
    BalanceModule,
    ProductModule,
    CouponModule,
  ],
  controllers: [OrderController],
  providers: [
    {
      provide: ORDER_REPOSITORY,
      useClass: OrderRepository,
    },
    {
      provide: ORDER_PRODUCT_REPOSITORY,
      useClass: OrderProductRepository,
    },
    {
      provide: ORDER_PRODUCT_OPTION_REPOSITORY,
      useClass: OrderProductOptionRepository,
    },
    {
      provide: ORDER_COUPON_REPOSITORY,
      useClass: OrderCouponRepository,
    },
    OrderService,
    OrderFacade,
  ],
  exports: [OrderService, OrderFacade],
})
export class OrderModule {}
