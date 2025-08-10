import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateOrderTables1753889044732 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create orders table
    await queryRunner.createTable(
      new Table({
        name: 'orders',
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
            name: 'deletedAt',
            type: 'timestamp',
            isNullable: true,
            comment: '삭제일시',
          },
          {
            name: 'userId',
            type: 'int',
            comment: '사용자 ID',
          },
          {
            name: 'totalPrice',
            type: 'int',
            comment: '총 결제 금액',
          },
          {
            name: 'status',
            type: 'varchar',
            length: '20',
            default: "'CONFIRMED'",
            comment: '주문 상태',
          },
          {
            name: 'userCouponId',
            type: 'int',
            isNullable: true,
            comment: '사용자 쿠폰 ID',
          },
        ],
      }),
      true,
    );

    // Create order_products table
    await queryRunner.createTable(
      new Table({
        name: 'order_products',
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
            name: 'deletedAt',
            type: 'timestamp',
            isNullable: true,
            comment: '삭제일시',
          },
          {
            name: 'orderId',
            type: 'int',
            comment: '주문 ID',
          },
          {
            name: 'productId',
            type: 'int',
            comment: '상품 ID',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
            comment: '상품명',
          },
        ],
      }),
      true,
    );

    // Create order_product_options table
    await queryRunner.createTable(
      new Table({
        name: 'order_product_options',
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
            name: 'deletedAt',
            type: 'timestamp',
            isNullable: true,
            comment: '삭제일시',
          },
          {
            name: 'orderProductId',
            type: 'int',
            comment: '주문 상품 ID',
          },
          {
            name: 'productOptionId',
            type: 'int',
            comment: '상품 옵션 ID',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
            comment: '옵션명',
          },
          {
            name: 'price',
            type: 'int',
            comment: '가격',
          },
          {
            name: 'quantity',
            type: 'int',
            comment: '수량',
          },
        ],
      }),
      true,
    );

    // Note: Foreign key constraints are not created due to createForeignKeyConstraints: false in entities
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables (no foreign key constraints to drop due to createForeignKeyConstraints: false)
    await queryRunner.dropTable('order_product_options');
    await queryRunner.dropTable('order_products');
    await queryRunner.dropTable('orders');
  }
}
