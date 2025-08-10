import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class RemoveUserCouponIdFromOrders1754399650000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Remove userCouponId column from orders table
    await queryRunner.dropColumn('orders', 'userCouponId');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Add userCouponId column back to orders table
    await queryRunner.addColumn('orders', new TableColumn({
      name: 'userCouponId',
      type: 'int',
      isNullable: true,
      comment: '사용자 쿠폰 ID',
    }));
  }
}