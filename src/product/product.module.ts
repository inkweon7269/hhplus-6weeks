import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';
import { ProductOptionService } from './product-option.service';
import { ProductFacade } from './product.facade';
import { ProductSalesEventService } from './product-sales-event.service';
import { ProductSalesCleanupService } from './product-sales-cleanup.service';
import { ProductRepository } from './domain/product.repository';
import { ProductOptionRepository } from './domain/product-option.repository';
import { ProductSalesDailyRepository } from './domain/product-sales-daily.repository';
import { ProductEntity } from './domain/product.entity';
import { ProductOptionEntity } from './domain/product-option.entity';
import { ProductSalesDailyEntity } from './domain/product-sales-daily.entity';

import { PRODUCT_REPOSITORY } from './domain/product.repository.interface';
import { PRODUCT_OPTION_REPOSITORY } from './domain/product-option.repository.interface';
import { PRODUCT_SALES_DAILY_REPOSITORY } from './domain/product-sales-daily.repository.interface';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProductEntity, ProductOptionEntity, ProductSalesDailyEntity]),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
  ],
  controllers: [ProductController],
  providers: [
    {
      provide: PRODUCT_REPOSITORY,
      useClass: ProductRepository,
    },
    {
      provide: PRODUCT_OPTION_REPOSITORY,
      useClass: ProductOptionRepository,
    },
    {
      provide: PRODUCT_SALES_DAILY_REPOSITORY,
      useClass: ProductSalesDailyRepository,
    },
    ProductService,
    ProductOptionService,
    ProductSalesEventService,
    ProductSalesCleanupService,
    ProductFacade,
  ],
  exports: [
    PRODUCT_REPOSITORY,
    PRODUCT_OPTION_REPOSITORY,
    PRODUCT_SALES_DAILY_REPOSITORY,
    ProductService,
    ProductOptionService,
    ProductFacade,
  ],
})
export class ProductModule {}
