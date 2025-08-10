import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCouponTables1734567890124 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. coupons 테이블 생성
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS coupons (
        id SERIAL PRIMARY KEY,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        "couponCode" VARCHAR(10) UNIQUE NOT NULL,
        name VARCHAR(20) NOT NULL,
        "discountAmount" INTEGER NOT NULL,
        "remainingStock" INTEGER NOT NULL,
        "expiryDate" TIMESTAMP NOT NULL,
        status VARCHAR(20) DEFAULT 'AVAILABLE' NOT NULL -- 쿠폰 상태 (AVAILABLE: 발급 가능, SUSPENDED: 발급 중단, EXPIRED: 발급 기간 만료)
      );
    `);

    // 2. user_coupons 테이블 생성 (FK 제약조건 없음)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_coupons (
        id SERIAL PRIMARY KEY,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        "userId" INTEGER NOT NULL,
        "couponId" INTEGER NOT NULL,
        status VARCHAR(20) DEFAULT 'AVAILABLE' NOT NULL, -- 사용자 쿠폰 상태 (AVAILABLE: 사용 가능, USED: 사용됨, EXPIRED: 만료됨)
        "usedDate" TIMESTAMP NULL
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 테이블 삭제
    await queryRunner.query(`DROP TABLE IF EXISTS user_coupons;`);
    await queryRunner.query(`DROP TABLE IF EXISTS coupons;`);
  }
}
