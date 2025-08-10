import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import * as dayjs from 'dayjs';
import { ProductSalesDailyEntity } from './product-sales-daily.entity';
import { IProductSalesDailyRepository } from './product-sales-daily.repository.interface';

@Injectable()
export class ProductSalesDailyRepository implements IProductSalesDailyRepository {
  constructor(
    @InjectRepository(ProductSalesDailyEntity)
    private readonly repository: Repository<ProductSalesDailyEntity>,
  ) {}

  async saveDailySales(productId: number, salesDate: string, salesCount: number): Promise<void> {
    // 기존 데이터 조회
    const existing = await this.findDailySales(productId, salesDate);

    if (existing) {
      // 기존 데이터 업데이트
      existing.salesCount = salesCount;
      await this.repository.save(existing);
    } else {
      // 새 데이터 생성
      const entity = this.repository.create({
        productId,
        salesDate: dayjs(salesDate).toDate(),
        salesCount,
      });
      await this.repository.save(entity);
    }
  }

  async findDailySales(productId: number, salesDate: string): Promise<any | null> {
    return this.repository.findOne({
      where: { productId, salesDate: dayjs(salesDate).toDate() },
    });
  }

  async findDailySalesByDateRange(startDate: string, endDate: string): Promise<any[]> {
    return this.repository
      .createQueryBuilder('psd')
      .select('psd.productId', 'productId')
      .addSelect('p.name', 'productName')
      .addSelect('SUM(psd.salesCount)', 'totalSales')
      .innerJoin('products', 'p', 'p.id = psd.productId')
      .where('psd.salesDate >= :startDate', { startDate })
      .andWhere('psd.salesDate <= :endDate', { endDate })
      .groupBy('psd.productId, p.name')
      .orderBy('"totalSales"', 'DESC')
      .getRawMany();
  }

  async deleteOldData(cutoffDate: Date): Promise<void> {
    await this.repository
      .createQueryBuilder()
      .delete()
      .from(ProductSalesDailyEntity)
      .where('salesDate < :cutoffDate', { cutoffDate })
      .execute();
  }
}
