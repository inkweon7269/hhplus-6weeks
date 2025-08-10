import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateProductSalesDailyTable1753889044733 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create product_sales_daily table
    await queryRunner.createTable(
      new Table({
        name: 'product_sales_daily',
        columns: [
          {
            name: 'id',
            type: 'serial',
            isPrimary: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'now()',
            comment: '생성일시',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'now()',
            comment: '수정일시',
          },
          {
            name: 'productId',
            type: 'int',
            comment: '상품 ID',
          },
          {
            name: 'salesDate',
            type: 'date',
            comment: '판매 날짜',
          },
          {
            name: 'salesCount',
            type: 'int',
            default: '0',
            comment: '판매 수량',
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('product_sales_daily');
  }
}
