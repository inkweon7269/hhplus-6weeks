import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateOrderCouponTable1754399649000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create order_coupons table
    await queryRunner.createTable(
      new Table({
        name: 'order_coupons',
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
            name: 'orderId',
            type: 'int',
            comment: '주문 ID',
          },
          {
            name: 'couponId',
            type: 'int',
            comment: '쿠폰 ID',
          },
          {
            name: 'userCouponId',
            type: 'int',
            comment: '사용자 쿠폰 ID',
          },
          {
            name: 'discountAmount',
            type: 'int',
            comment: '할인 금액',
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('order_coupons');
  }
}