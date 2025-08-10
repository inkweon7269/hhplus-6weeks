import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUniqueConstraintToOrderCoupons1754400863000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add unique constraint on orderId to enforce one-to-one relationship
    await queryRunner.query(`
      ALTER TABLE "order_coupons" 
      ADD CONSTRAINT "UQ_order_coupons_orderId" UNIQUE ("orderId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove unique constraint
    await queryRunner.query(`
      ALTER TABLE "order_coupons" 
      DROP CONSTRAINT "UQ_order_coupons_orderId"
    `);
  }
}