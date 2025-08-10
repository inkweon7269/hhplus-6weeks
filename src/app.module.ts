import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { ProductModule } from './product/product.module';
import { BalanceModule } from './balance/balance.module';
import { CouponModule } from './coupon/coupon.module';
import { OrderModule } from './order/order.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';

@Module({
  imports: [DatabaseModule, ProductModule, BalanceModule, CouponModule, OrderModule, AuthModule, UserModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
