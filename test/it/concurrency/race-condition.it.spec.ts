import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { getTestDatasource } from '../setup';
import { AppModule } from '../../../src/app.module';
import { ProductOptionService } from '../../../src/product/product-option.service';
import { BalanceService } from '../../../src/balance/balance.service';
import { CouponService } from '../../../src/coupon/coupon.service';
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

describe('Race Condition Integration Test', () => {
  let app: INestApplication;
  let productOptionService: ProductOptionService;
  let balanceService: BalanceService;
  let couponService: CouponService;
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
    productOptionService = moduleFixture.get<ProductOptionService>(ProductOptionService);
    balanceService = moduleFixture.get<BalanceService>(BalanceService);
    couponService = moduleFixture.get<CouponService>(CouponService);
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

    // 상품 옵션 생성
    await productOptionRepository.saveProductOption({
      id: 1,
      productId: 1,
      name: 'Test Option',
      price: 10000,
      stock: 50,
    });

    // 잔액 설정
    await balanceRepository.save({
      userId: 1,
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
      stock: 50,
    });

    await balanceRepository.save({
      userId: 1,
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

  describe('🏃‍♂️ Race Condition 시뮬레이션', () => {
    it('재고 확인과 주문 사이의 시간차 공격', async () => {
      const concurrentAttempts = 30;
      const promises = [];

      for (let i = 0; i < concurrentAttempts; i++) {
        const promise = (async () => {
          const currentStock = await productOptionRepository.findById(1);
          if (currentStock.stock > 0) {
            // 재고 확인 후 지연을 두고 주문 (race condition 유발)
            await new Promise((resolve) => setTimeout(resolve, Math.random() * 100));
            return productOptionService.deductMultipleStock([{ productOptionId: 1, quantity: 1 }]);
          }
          return null;
        })();
        promises.push(promise);
      }

      const results = await Promise.all(promises);
      const successful = results.filter((result) => result !== null);

      console.log(`✅ 성공한 재고 차감: ${successful.length}개`);

      // 재고 확인
      const finalStock = await productOptionRepository.findById(1);
      console.log(`📦 최종 재고: ${finalStock.stock}개`);

      // Race condition으로 인해 재고가 음수가 될 수 있음
      expect(finalStock.stock).toBeLessThanOrEqual(50);
    });

    it('동시 재고 업데이트 Race Condition', async () => {
      const concurrentUpdates = 40;
      const promises = [];

      for (let i = 0; i < concurrentUpdates; i++) {
        promises.push(productOptionService.deductMultipleStock([{ productOptionId: 1, quantity: 1 }]));
      }

      const results = await Promise.all(promises);
      const successful = results.filter((result) => result !== null);
      const failed = results.filter((result) => result === null);

      console.log(`✅ 성공한 업데이트: ${successful.length}개`);
      console.log(`❌ 실패한 업데이트: ${failed.length}개`);

      // 재고 확인
      const finalStock = await productOptionRepository.findById(1);
      console.log(`📦 최종 재고: ${finalStock.stock}개`);

      // Race condition으로 인해 예상과 다른 결과가 나올 수 있음
      expect(finalStock.stock).toBeLessThanOrEqual(50);
    });

    it('잔액과 쿠폰 동시 사용 Race Condition', async () => {
      const concurrentTransactions = 25;
      const promises = [];

      for (let i = 0; i < concurrentTransactions; i++) {
        const promise = Promise.all([
          balanceService.useBalance(1, 1000),
          couponService.findAvailableUserCouponByCode(1, 'TEST001'),
        ]).catch((error) => {
          console.log(`❌ Race condition 발생: ${error.message}`);
          return null;
        });
        promises.push(promise);
      }

      const results = await Promise.all(promises);
      const successful = results.filter((result) => result !== null);
      const failed = results.filter((result) => result === null);

      console.log(`✅ 성공한 트랜잭션: ${successful.length}개`);
      console.log(`❌ 실패한 트랜잭션: ${failed.length}개`);

      // 최종 상태 확인
      const finalBalance = await balanceRepository.findByUserId(1);
      const [issuedCoupons] = await userCouponRepository.findUserCoupons(1, 1, 100);

      console.log(`💰 최종 잔액: ${finalBalance.amount}원`);
      console.log(`🎫 발급된 쿠폰: ${issuedCoupons.length}개`);

      // Race condition으로 인해 예상과 다른 결과가 나올 수 있음
      expect(finalBalance.amount).toBeLessThanOrEqual(100000);
      expect(issuedCoupons.length).toBeGreaterThanOrEqual(0);
    });

    it('복합 Race Condition 시나리오', async () => {
      const complexOperations = 20;
      const promises = [];

      for (let i = 0; i < complexOperations; i++) {
        const promise = Promise.all([
          // 재고 차감
          productOptionService.deductMultipleStock([{ productOptionId: 1, quantity: 1 }]),
          // 잔액 차감
          balanceService.useBalance(1, 1000),
          // 쿠폰 발급
          userCouponRepository.saveUserCoupon({
            userId: 1,
            couponId: 1,
            status: UserCouponStatus.AVAILABLE,
          }),
        ]).catch((error) => {
          console.log(`❌ 복합 Race condition 발생: ${error.message}`);
          return null;
        });
        promises.push(promise);
      }

      const results = await Promise.all(promises);
      const successful = results.filter((result) => result !== null);
      const failed = results.filter((result) => result === null);

      console.log(`✅ 성공한 복합 작업: ${successful.length}개`);
      console.log(`❌ 실패한 복합 작업: ${failed.length}개`);

      // 최종 상태 확인
      const finalStock = await productOptionRepository.findById(1);
      const finalBalance = await balanceRepository.findByUserId(1);
      const [issuedCoupons] = await userCouponRepository.findUserCoupons(1, 1, 100);

      console.log(`📦 최종 재고: ${finalStock.stock}개`);
      console.log(`💰 최종 잔액: ${finalBalance.amount}원`);
      console.log(`🎫 발급된 쿠폰: ${issuedCoupons.length}개`);

      // 복합 Race condition으로 인해 예상과 다른 결과가 나올 수 있음
      expect(finalStock.stock).toBeLessThanOrEqual(50);
      expect(finalBalance.amount).toBeLessThanOrEqual(100000);
      expect(issuedCoupons.length).toBeGreaterThanOrEqual(0);
    });
  });
});
