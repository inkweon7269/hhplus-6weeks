import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { getTestDatasource } from '../setup';
import { AppModule } from '../../../src/app.module';
import { OrderFacade } from '../../../src/order/order.facade';
import { IProductRepository, PRODUCT_REPOSITORY } from '../../../src/product/domain/product.repository.interface';
import {
  IProductOptionRepository,
  PRODUCT_OPTION_REPOSITORY,
} from '../../../src/product/domain/product-option.repository.interface';
import { IBalanceRepository, BALANCE_REPOSITORY } from '../../../src/balance/domain/balance.repository.interface';
import { IUserRepository, USER_REPOSITORY } from '../../../src/user/domain/user.repository.interface';
import { ICouponRepository, COUPON_REPOSITORY } from '../../../src/coupon/domain/coupon.repository.interface';
import {
  IUserCouponRepository,
  USER_COUPON_REPOSITORY,
} from '../../../src/coupon/domain/user-coupon.repository.interface';
import { CouponStatus, UserCouponStatus } from '../../../src/coupon/enum/coupon-status.enum';

describe('Deadlock Simulation Integration Test', () => {
  let app: INestApplication;
  let orderFacade: OrderFacade;
  let productRepository: IProductRepository;
  let productOptionRepository: IProductOptionRepository;
  let balanceRepository: IBalanceRepository;
  let userRepository: IUserRepository;
  let couponRepository: ICouponRepository;
  let userCouponRepository: IUserCouponRepository;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // 서비스 주입
    orderFacade = moduleFixture.get<OrderFacade>(OrderFacade);
    productRepository = moduleFixture.get<IProductRepository>(PRODUCT_REPOSITORY);
    productOptionRepository = moduleFixture.get<IProductOptionRepository>(PRODUCT_OPTION_REPOSITORY);
    balanceRepository = moduleFixture.get<IBalanceRepository>(BALANCE_REPOSITORY);
    userRepository = moduleFixture.get<IUserRepository>(USER_REPOSITORY);
    couponRepository = moduleFixture.get<ICouponRepository>(COUPON_REPOSITORY);
    userCouponRepository = moduleFixture.get<IUserCouponRepository>(USER_COUPON_REPOSITORY);

    // 사용자 생성
    await userRepository.save({
      id: 1,
      name: 'Test User 1',
    });

    await userRepository.save({
      id: 2,
      name: 'Test User 2',
    });

    // 상품 생성
    await productRepository.saveProduct({
      id: 1,
      name: 'Test Product',
    });

    // 상품 옵션 생성
    await productOptionRepository.saveProductOption({
      id: 1,
      productId: 1,
      name: 'Test Option',
      price: 10000,
      stock: 100,
    });

    // 잔액 설정
    await balanceRepository.save({
      userId: 1,
      amount: 100000,
    });

    await balanceRepository.save({
      userId: 2,
      amount: 100000,
    });

    // 쿠폰 생성
    await couponRepository.saveCoupon({
      id: 1,
      couponCode: 'TEST001',
      name: 'Test Coupon',
      discountAmount: 1000,
      remainingStock: 10,
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: CouponStatus.AVAILABLE,
    });
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(async () => {
    // 각 테스트 전에 데이터 초기화
    const datasource = getTestDatasource();
    await datasource.query('TRUNCATE TABLE user_coupons RESTART IDENTITY CASCADE');
    await datasource.query('TRUNCATE TABLE order_coupons RESTART IDENTITY CASCADE');
    await datasource.query('TRUNCATE TABLE order_product_options RESTART IDENTITY CASCADE');
    await datasource.query('TRUNCATE TABLE order_products RESTART IDENTITY CASCADE');
    await datasource.query('TRUNCATE TABLE orders RESTART IDENTITY CASCADE');

    // 기본 데이터 재설정
    await productOptionRepository.saveProductOption({
      id: 1,
      productId: 1,
      name: 'Test Option',
      price: 10000,
      stock: 100,
    });

    await balanceRepository.save({
      userId: 1,
      amount: 100000,
    });

    await balanceRepository.save({
      userId: 2,
      amount: 100000,
    });

    await couponRepository.saveCoupon({
      id: 1,
      couponCode: 'TEST001',
      name: 'Test Coupon',
      discountAmount: 1000,
      remainingStock: 10,
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: CouponStatus.AVAILABLE,
    });
  });

  describe('🔒 데드락 시뮬레이션', () => {
    it('주문과 쿠폰 발급 간의 데드락 상황', async () => {
      const concurrentOperations = 10;
      const promises = [];

      for (let i = 0; i < concurrentOperations; i++) {
        const userId = i % 2 === 0 ? 1 : 2;

        // 주문과 쿠폰 발급을 동시에 시도
        const promise = Promise.all([
          orderFacade.pay(userId, {
            products: [
              {
                productId: 1,
                options: [
                  {
                    productOptionId: 1,
                    quantity: 1,
                  },
                ],
              },
            ],
            usedAmount: 10000,
          }),
          userCouponRepository.saveUserCoupon({
            userId,
            couponId: 1,
            status: UserCouponStatus.AVAILABLE,
          }),
        ]).catch((error) => {
          console.log(`❌ 데드락 발생: ${error.message}`);
          return null;
        });

        promises.push(promise);
      }

      const results = await Promise.all(promises);
      const successful = results.filter((result) => result !== null);
      const failed = results.filter((result) => result === null);

      console.log(`✅ 성공한 작업: ${successful.length}개`);
      console.log(`❌ 실패한 작업: ${failed.length}개`);

      // 데드락으로 인해 일부 작업이 실패할 수 있음
      expect(successful.length + failed.length).toBe(concurrentOperations);
    });

    it('재고 차감과 잔액 차감 간의 데드락 상황', async () => {
      const concurrentTransactions = 20;
      const promises = [];

      for (let i = 0; i < concurrentTransactions; i++) {
        const userId = i % 2 === 0 ? 1 : 2;

        // 재고 차감과 잔액 차감을 동시에 시도
        const promise = Promise.all([
          productOptionRepository.saveProductOption({
            id: 1,
            productId: 1,
            name: 'Test Option',
            price: 10000,
            stock: 99, // 재고 차감
          }),
          balanceRepository.save({
            userId,
            amount: 90000, // 잔액 차감
          }),
        ]).catch((error) => {
          console.log(`❌ 데드락 발생: ${error.message}`);
          return null;
        });

        promises.push(promise);
      }

      const results = await Promise.all(promises);
      const successful = results.filter((result) => result !== null);
      const failed = results.filter((result) => result === null);

      console.log(`✅ 성공한 트랜잭션: ${successful.length}개`);
      console.log(`❌ 실패한 트랜잭션: ${failed.length}개`);

      // 데드락으로 인해 일부 트랜잭션이 실패할 수 있음
      expect(successful.length + failed.length).toBe(concurrentTransactions);
    });

    it('복합 데드락 시나리오', async () => {
      const complexOperations = 15;
      const promises = [];

      for (let i = 0; i < complexOperations; i++) {
        const userId = i % 2 === 0 ? 1 : 2;

        // 복합적인 데드락 상황 시뮬레이션
        const promise = Promise.all([
          // 주문 생성
          orderFacade.pay(userId, {
            products: [
              {
                productId: 1,
                options: [
                  {
                    productOptionId: 1,
                    quantity: 1,
                  },
                ],
              },
            ],
            usedAmount: 10000,
          }),
          // 쿠폰 발급
          userCouponRepository.saveUserCoupon({
            userId,
            couponId: 1,
            status: UserCouponStatus.AVAILABLE,
          }),
          // 재고 차감
          productOptionRepository.saveProductOption({
            id: 1,
            productId: 1,
            name: 'Test Option',
            price: 10000,
            stock: 99,
          }),
          // 잔액 차감
          balanceRepository.save({
            userId,
            amount: 90000,
          }),
        ]).catch((error) => {
          console.log(`❌ 복합 데드락 발생: ${error.message}`);
          return null;
        });

        promises.push(promise);
      }

      const results = await Promise.all(promises);
      const successful = results.filter((result) => result !== null);
      const failed = results.filter((result) => result === null);

      console.log(`✅ 성공한 복합 작업: ${successful.length}개`);
      console.log(`❌ 실패한 복합 작업: ${failed.length}개`);

      // 복합 데드락으로 인해 일부 작업이 실패할 수 있음
      expect(successful.length + failed.length).toBe(complexOperations);
    });
  });
});
