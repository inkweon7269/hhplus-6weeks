import { DataSource } from 'typeorm';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { getDatasource } from './util';
import { initializeTransactionalContext, addTransactionalDataSource } from 'typeorm-transactional';

let postgres: StartedPostgreSqlContainer;
let datasource: DataSource;

beforeAll(async () => {
  // typeorm-transactional 컨텍스트 초기화 (데이터소스 생성 전에 실행)
  initializeTransactionalContext();

  postgres = await new PostgreSqlContainer('postgres:15')
    .withDatabase('dbname')
    .withUsername('postgres')
    .withPassword('pw')
    .start();

  process.env.DB_HOST = postgres.getHost();
  process.env.DB_PORT = postgres.getPort().toString();
  process.env.DB_USERNAME = postgres.getUsername();
  process.env.DB_PASSWORD = postgres.getPassword();
  process.env.DB_DATABASE = postgres.getDatabase();
  process.env.DB_LOGGING_ENABLED = 'true';

  // 데이터소스 생성 및 마이그레이션 실행
  datasource = await getDatasource();
  await datasource.runMigrations();

  // typeorm-transactional에 데이터소스 등록
  addTransactionalDataSource(datasource);
}, 30000); // 30초 타임아웃

beforeEach(async () => {
  // 테스트마다 모든 테이블 초기화 (각 테스트에서 필요한 데이터를 직접 생성)
  await datasource.query('TRUNCATE TABLE user_coupons RESTART IDENTITY CASCADE');
  await datasource.query('TRUNCATE TABLE coupons RESTART IDENTITY CASCADE');
  await datasource.query('TRUNCATE TABLE balances RESTART IDENTITY CASCADE');
  await datasource.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
  await datasource.query('TRUNCATE TABLE product_options RESTART IDENTITY CASCADE');
  await datasource.query('TRUNCATE TABLE products RESTART IDENTITY CASCADE');
  await datasource.query('TRUNCATE TABLE product_sales_daily RESTART IDENTITY CASCADE');
  await datasource.query('TRUNCATE TABLE order_product_options RESTART IDENTITY CASCADE');
  await datasource.query('TRUNCATE TABLE order_products RESTART IDENTITY CASCADE');
  await datasource.query('TRUNCATE TABLE order_coupons RESTART IDENTITY CASCADE');
  await datasource.query('TRUNCATE TABLE orders RESTART IDENTITY CASCADE');
}, 10000);

// 모든 테스트 완료 후 컨테이너 정리
afterAll(async () => {
  if (datasource && datasource.isInitialized) {
    await datasource.destroy();
  }
  if (postgres) {
    await postgres.stop();
  }
}, 10000);

export const getTestDatasource = () => datasource;
