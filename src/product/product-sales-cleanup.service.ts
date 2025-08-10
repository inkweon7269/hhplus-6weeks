import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as dayjs from 'dayjs';
import {
  IProductSalesDailyRepository,
  PRODUCT_SALES_DAILY_REPOSITORY,
} from './domain/product-sales-daily.repository.interface';

@Injectable()
export class ProductSalesCleanupService {
  private readonly logger = new Logger(ProductSalesCleanupService.name);

  constructor(
    @Inject(PRODUCT_SALES_DAILY_REPOSITORY)
    private readonly productSalesDailyRepository: IProductSalesDailyRepository,
  ) {}

  /**
   * 3일 이전 데이터 정리 (매일 자정 실행)
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupOldData(): Promise<void> {
    try {
      const cutoffDate = dayjs().subtract(3, 'day'); // 3일 이전

      await this.productSalesDailyRepository.deleteOldData(cutoffDate.toDate());
      this.logger.log(`Cleaned up sales data older than ${cutoffDate.format('YYYY-MM-DD')}`);
    } catch (error) {
      this.logger.error('Failed to cleanup old sales data', error);
    }
  }
}
