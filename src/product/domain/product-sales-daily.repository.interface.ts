export const PRODUCT_SALES_DAILY_REPOSITORY = 'PRODUCT_SALES_DAILY_REPOSITORY';

export interface IProductSalesDailyRepository {
  /**
   * 일별 판매 집계 데이터 저장
   */
  saveDailySales(productId: number, salesDate: string, salesCount: number): Promise<void>;

  /**
   * 일별 판매 집계 데이터 조회
   */
  findDailySales(productId: number, salesDate: string): Promise<any | null>;

  /**
   * 최근 N일간 판매 집계 데이터 조회
   */
  findDailySalesByDateRange(
    startDate: string,
    endDate: string,
  ): Promise<
    Array<{
      productId: number;
      productName: string;
      totalSales: number;
    }>
  >;

  /**
   * 오래된 집계 데이터 삭제
   */
  deleteOldData(cutoffDate: Date): Promise<void>;
}
