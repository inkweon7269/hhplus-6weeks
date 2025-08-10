import { Injectable, Logger, Inject } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import * as dayjs from 'dayjs';
import {
  IProductSalesDailyRepository,
  PRODUCT_SALES_DAILY_REPOSITORY,
} from './domain/product-sales-daily.repository.interface';

export interface OrderCreatedEvent {
  orderId: number;
  orderProducts: Array<{
    productId: number;
  }>;
  createdAt: Date;
}

@Injectable()
export class ProductSalesEventService {
  private readonly logger = new Logger(ProductSalesEventService.name);

  constructor(
    @Inject(PRODUCT_SALES_DAILY_REPOSITORY)
    private readonly productSalesDailyRepository: IProductSalesDailyRepository,
  ) {}

  /**
   * 주문 생성 이벤트 처리 - 실시간 집계
   */
  @OnEvent('order.created')
  async handleOrderCreated(event: OrderCreatedEvent): Promise<void> {
    try {
      this.logger.log(`Processing order created event for order ${event.orderId}`);

      // 주문 데이터를 일별 집계 데이터로 변환
      const dailyAggregations = this.calculateDailyAggregations(event);

      if (dailyAggregations.length === 0) {
        this.logger.log('No sales data to aggregate');
        return;
      }

      // 집계 테이블 업데이트 (비즈니스 로직 처리)
      await this.processDailyAggregations(dailyAggregations);

      this.logger.log(`Successfully aggregated sales data for order ${event.orderId}`);
    } catch (error) {
      this.logger.error(`Failed to process order created event for order ${event.orderId}`, error);
      // 실제 운영에서는 알림 서비스로 에러 전송
    }
  }

  /**
   * 주문 데이터를 일별 집계 데이터로 변환
   */
  private calculateDailyAggregations(event: OrderCreatedEvent): Array<{
    productId: number;
    salesDate: string;
    salesCount: number;
  }> {
    const aggregations = new Map<
      string,
      {
        productId: number;
        salesDate: string;
        salesCount: number;
      }
    >();

    const orderDate = dayjs(event.createdAt).format('YYYY-MM-DD');

    for (const orderProduct of event.orderProducts) {
      // 상품별로 집계 (주문 건수 기준)
      const key = `${orderProduct.productId}-${orderDate}`;
      const existing = aggregations.get(key) || {
        productId: orderProduct.productId,
        salesDate: orderDate,
        salesCount: 0,
      };

      // 주문 건수로 집계 (수량이 아닌 주문 횟수)
      existing.salesCount += 1;
      aggregations.set(key, existing);
    }

    return Array.from(aggregations.values());
  }

  /**
   * 일별 집계 데이터 처리 (비즈니스 로직)
   */
  private async processDailyAggregations(
    aggregations: Array<{
      productId: number;
      salesDate: string;
      salesCount: number;
    }>,
  ): Promise<void> {
    for (const agg of aggregations) {
      // 기존 데이터 조회
      const existing = await this.productSalesDailyRepository.findDailySales(agg.productId, agg.salesDate);

      if (existing) {
        // 기존 데이터 업데이트
        const newSalesCount = existing.salesCount + agg.salesCount;
        await this.productSalesDailyRepository.saveDailySales(agg.productId, agg.salesDate, newSalesCount);
      } else {
        // 새 데이터 생성
        await this.productSalesDailyRepository.saveDailySales(agg.productId, agg.salesDate, agg.salesCount);
      }
    }
  }
}
