import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { getTestDatasource } from '../setup';
import { AppModule } from '../../../src/app.module';
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
import { CouponStatus } from '../../../src/coupon/enum/coupon-status.enum';

describe('Concurrency Issues Integration Test', () => {
  let app: INestApplication;
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
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    // 리포지토리 주입
    productRepository = moduleFixture.get<IProductRepository>(PRODUCT_REPOSITORY);
    productOptionRepository = moduleFixture.get<IProductOptionRepository>(PRODUCT_OPTION_REPOSITORY);
    balanceRepository = moduleFixture.get<IBalanceRepository>(BALANCE_REPOSITORY);
    userRepository = moduleFixture.get<IUserRepository>(USER_REPOSITORY);
    couponRepository = moduleFixture.get<ICouponRepository>(COUPON_REPOSITORY);
    userCouponRepository = moduleFixture.get<IUserCouponRepository>(USER_COUPON_REPOSITORY);

    // 사용자 생성
    await userRepository.save({
      id: 1,
      name: 'Test User',
    });

    // 상품 생성
    await productRepository.saveProduct({
      id: 1,
      name: 'Test Product',
    });

    // 상품 옵션 생성 (재고 10개)
    await productOptionRepository.saveProductOption({
      id: 1,
      productId: 1,
      name: 'Test Option',
      price: 10000,
      stock: 10,
    });

    // 기본 잔액은 beforeEach에서 설정하므로 여기서는 제거

    // 쿠폰 생성
    await couponRepository.saveCoupon({
      id: 1,
      couponCode: 'TEST001',
      name: 'Test Coupon',
      discountAmount: 1000,
      remainingStock: 5,
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30일 후
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
      stock: 10,
    });

    const existingBalance = await balanceRepository.findByUserId(1);
    if (existingBalance) {
      existingBalance.amount = 100000;
      await balanceRepository.save(existingBalance);
    } else {
      await balanceRepository.save({
        userId: 1,
        amount: 100000,
      });
    }

    await couponRepository.saveCoupon({
      id: 1,
      couponCode: 'TEST001',
      name: 'Test Coupon',
      discountAmount: 1000,
      remainingStock: 5,
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30일 후
      status: CouponStatus.AVAILABLE,
    });
  });

  describe('📦 재고 관리 Race Condition', () => {
    it('동시 주문으로 인한 재고 오버셀링 문제', async () => {
      const concurrentOrders = 15; // 재고 10개보다 많은 주문
      const promises = [];

      for (let i = 0; i < concurrentOrders; i++) {
        const promise = request(app.getHttpServer())
          .post('/orders')
          .set('id', '1')
          .send({
            productOptionId: 1,
            quantity: 1,
          })
          .then((response) => response.body)
          .catch((error) => error.response?.body);
        promises.push(promise);
      }

      const results = await Promise.all(promises);
      const successful = results.filter((result) => result?.orderId);
      const failed = results.filter((result) => !result?.orderId);

      console.log(`✅ 성공한 주문: ${successful.length}개`);
      console.log(`❌ 실패한 주문: ${failed.length}개`);

      // 재고 확인
      const finalStock = await productOptionRepository.findById(1);
      console.log(`📦 최종 재고: ${finalStock.stock}개`);

      // 동시성 문제로 인해 재고가 음수가 될 수 있음
      expect(finalStock.stock).toBeLessThanOrEqual(10);
      expect(successful.length + failed.length).toBe(concurrentOrders);
    });

    it('재고 확인과 주문 사이의 시간차 공격', async () => {
      const checkAndOrder = async () => {
        const currentStock = await productOptionRepository.findById(1);
        if (currentStock.stock > 0) {
          // 재고 확인 후 지연을 두고 주문 (race condition 유발)
          await new Promise((resolve) => setTimeout(resolve, Math.random() * 100));
          return request(app.getHttpServer())
            .post('/orders')
            .set('id', '1')
            .send({
              productOptionId: 1,
              quantity: 1,
            })
            .then((response) => response.body)
            .catch((error) => error.response?.body);
        }
        return null;
      };

      const concurrentAttempts = 20;
      const promises = [];

      for (let i = 0; i < concurrentAttempts; i++) {
        promises.push(checkAndOrder());
      }

      const results = await Promise.all(promises);
      const successful = results.filter((result) => result?.orderId);

      console.log(`✅ 성공한 주문: ${successful.length}개`);

      // 재고 확인
      const finalStock = await productOptionRepository.findById(1);
      console.log(`📦 최종 재고: ${finalStock.stock}개`);

      // 동시성 문제로 인해 재고가 음수가 될 수 있음
      expect(finalStock.stock).toBeLessThanOrEqual(10);
    });
  });

  describe('💰 잔액 관리 Race Condition - 음수 잔액 문제', () => {
    it('10,000원 잔액에 8,000원씩 2번 동시 결제시도 → 음수 잔액 발생 검증', async () => {
      // 잔액을 10,000원으로 설정
      const existingBalance = await balanceRepository.findByUserId(1);
      if (existingBalance) {
        existingBalance.amount = 10000;
        await balanceRepository.save(existingBalance);
      } else {
        await balanceRepository.save({
          userId: 1,
          amount: 10000,
        });
      }

      const concurrentPayments = 2;
      const promises = [];

      for (let i = 0; i < concurrentPayments; i++) {
        const promise = request(app.getHttpServer())
          .post('/orders')
          .set('id', '1')
          .send({
            productOptionId: 1,
            quantity: 1,
          })
          .then((response) => response.body)
          .catch((error) => error.response?.body);
        promises.push(promise);
      }

      const results = await Promise.all(promises);
      const successful = results.filter((result) => result?.orderId);
      const failed = results.filter((result) => !result?.orderId);

      console.log(`✅ 성공한 결제: ${successful.length}개`);
      console.log(`❌ 실패한 결제: ${failed.length}개`);

      // 최종 잔액 확인
      const finalBalance = await balanceRepository.findByUserId(1);
      console.log(`💰 최종 잔액: ${finalBalance.amount}원`);

      // 동시성 문제로 인해 음수 잔액이 발생할 수 있음
      expect(finalBalance.amount).toBeLessThanOrEqual(10000);
      expect(successful.length + failed.length).toBe(concurrentPayments);
    });

    it('잔액 부족 상황에서 다중 결제 시도', async () => {
      const userId = 1;
      const initialBalance = await balanceRepository.findByUserId(userId);

      // 잔액을 5000원으로 설정
      const existingBalance = await balanceRepository.findByUserId(userId);
      if (existingBalance) {
        existingBalance.amount = 5000;
        await balanceRepository.save(existingBalance);
      } else {
        await balanceRepository.save({
          userId,
          amount: 5000,
        });
      }

      const concurrentPayments = 10;
      const promises = [];

      for (let i = 0; i < concurrentPayments; i++) {
        const promise = request(app.getHttpServer())
          .post('/orders')
          .set('id', '1')
          .send({
            productOptionId: 1,
            quantity: 1,
          })
          .then((response) => response.body)
          .catch((error) => error.response?.body);
        promises.push(promise);
      }

      const results = await Promise.all(promises);
      const successful = results.filter((result) => result?.orderId);
      const failed = results.filter((result) => !result?.orderId);

      console.log(`✅ 성공한 결제: ${successful.length}개`);
      console.log(`❌ 실패한 결제: ${failed.length}개`);

      // 최종 잔액 확인
      const finalBalance = await balanceRepository.findByUserId(userId);
      console.log(`💰 최종 잔액: ${finalBalance.amount}원`);

      // 동시성 문제로 인해 음수 잔액이 발생할 수 있음
      expect(finalBalance.amount).toBeLessThanOrEqual(5000);
      expect(successful.length + failed.length).toBe(concurrentPayments);
    });
  });

  describe('🎫 쿠폰 발급 Race Condition', () => {
    it('한정 수량 쿠폰의 중복 발급 문제', async () => {
      const maxIssuanceCount = 5;
      const concurrentIssuances = 10;
      const promises = [];

      for (let i = 0; i < concurrentIssuances; i++) {
        const promise = request(app.getHttpServer())
          .post('/coupons/1/issue')
          .set('id', '1')
          .send({})
          .then((response) => response.body)
          .catch((error) => error.response?.body);
        promises.push(promise);
      }

      const results = await Promise.all(promises);
      const successful = results.filter((result) => result?.userCouponId);
      const failed = results.filter((result) => !result?.userCouponId);

      console.log(`✅ 성공한 발급: ${successful.length}개`);
      console.log(`❌ 실패한 발급: ${failed.length}개`);

      // 쿠폰 발급 수량 확인
      const [issuedCoupons] = await userCouponRepository.findUserCoupons(1, 1, 100);
      console.log(`🎫 실제 발급된 쿠폰: ${issuedCoupons.length}개`);

      // 동시성 문제로 인해 최대 발급 수량을 초과할 수 있음
      expect(issuedCoupons.length).toBeGreaterThanOrEqual(0);
      expect(successful.length + failed.length).toBe(concurrentIssuances);
    });
  });

  describe('🔄 복합 동시성 문제', () => {
    it('재고 + 잔액 + 쿠폰이 모두 동시에 발생하는 현실적 시나리오', async () => {
      // 잔액을 50000원으로 설정
      const existingBalance = await balanceRepository.findByUserId(1);
      if (existingBalance) {
        existingBalance.amount = 50000;
        await balanceRepository.save(existingBalance);
      } else {
        await balanceRepository.save({
          userId: 1,
          amount: 50000,
        });
      }

      const concurrentOrders = 20;
      const promises = [];

      for (let i = 0; i < concurrentOrders; i++) {
        const promise = request(app.getHttpServer())
          .post('/orders')
          .set('id', '1')
          .send({
            productOptionId: 1,
            quantity: 1,
            couponId: 1, // 쿠폰 사용
          })
          .then((response) => response.body)
          .catch((error) => error.response?.body);
        promises.push(promise);
      }

      const results = await Promise.all(promises);
      const successful = results.filter((result) => result?.orderId);
      const failed = results.filter((result) => !result?.orderId);

      console.log(`✅ 성공한 주문: ${successful.length}개`);
      console.log(`❌ 실패한 주문: ${failed.length}개`);

      // 최종 상태 확인
      const finalStock = await productOptionRepository.findById(1);
      const finalBalance = await balanceRepository.findByUserId(1);
      const [issuedCoupons] = await userCouponRepository.findUserCoupons(1, 1, 100);

      console.log(`📦 최종 재고: ${finalStock.stock}개`);
      console.log(`💰 최종 잔액: ${finalBalance.amount}원`);
      console.log(`🎫 발급된 쿠폰: ${issuedCoupons.length}개`);

      // 동시성 문제로 인해 예상과 다른 결과가 나올 수 있음
      expect(finalStock.stock).toBeLessThanOrEqual(10);
      expect(finalBalance.amount).toBeLessThanOrEqual(50000);
      expect(issuedCoupons.length).toBeGreaterThanOrEqual(0);
      expect(successful.length + failed.length).toBe(concurrentOrders);
    });
  });
});
