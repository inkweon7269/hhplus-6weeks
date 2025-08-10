import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVersionColumnToBalances1754729650000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE balances 
      ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN balances.version IS '낙관적 락을 위한 버전 컬럼';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE balances 
      DROP COLUMN IF EXISTS version;
    `);
  }
}