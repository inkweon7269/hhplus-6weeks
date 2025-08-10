import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateProductAndProductOptionTables1753889044731 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create products table
    await queryRunner.createTable(
      new Table({
        name: 'products',
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
            name: 'name',
            type: 'varchar',
            length: '255',
            comment: '상품명',
          },
        ],
      }),
      true,
    );

    // Create product_options table
    await queryRunner.createTable(
      new Table({
        name: 'product_options',
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
            name: 'stock',
            type: 'int',
            comment: '재고',
          },
          {
            name: 'productId',
            type: 'int',
            comment: '상품 ID',
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables
    await queryRunner.dropTable('product_options');
    await queryRunner.dropTable('products');
  }
}
