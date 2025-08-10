import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBalancesTable1734567890123 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS balances (
                id SERIAL PRIMARY KEY,
                "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
                "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
                "userId" INTEGER UNIQUE NOT NULL,
                amount INTEGER NOT NULL
            );
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS balances;');
  }
}
