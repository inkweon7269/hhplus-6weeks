import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { getTestDatasource } from '../setup';
import { AppModule } from '../../../src/app.module';
import { IOrderRepository, ORDER_REPOSITORY } from '../../../src/order/domain/order.repository.interface';
import {
  IOrderCouponRepository,
  ORDER_COUPON_REPOSITORY,
} from '../../../src/order/domain/order-coupon.repository.interface';
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
import { getDataSourceToken } from '@nestjs/typeorm';
import { OrderStatus } from '../../../src/order/enum/order-status.enum';
import { CouponStatus, UserCouponStatus } from '../../../src/coupon/enum/coupon-status.enum';

describe('Order Integration Test (IT)', () => {
  let app: INestApplication;
  let orderRepository: IOrderRepository;
  let orderCouponRepository: IOrderCouponRepository;
  let productRepository: IProductRepository;
  let productOptionRepository: IProductOptionRepository;
  let balanceRepository: IBalanceRepository;
  let userRepository: IUserRepository;
  let couponRepository: ICouponRepository;
  let userCouponRepository: IUserCouponRepository;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(getDataSourceToken())
      .useValue(getTestDatasource())
      .compile();

    app = moduleFixture.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
        whitelist: true,
      }),
    );

    orderRepository = moduleFixture.get<IOrderRepository>(ORDER_REPOSITORY);
    orderCouponRepository = moduleFixture.get<IOrderCouponRepository>(ORDER_COUPON_REPOSITORY);
    productRepository = moduleFixture.get<IProductRepository>(PRODUCT_REPOSITORY);
    productOptionRepository = moduleFixture.get<IProductOptionRepository>(PRODUCT_OPTION_REPOSITORY);
    balanceRepository = moduleFixture.get<IBalanceRepository>(BALANCE_REPOSITORY);
    userRepository = moduleFixture.get<IUserRepository>(USER_REPOSITORY);
    couponRepository = moduleFixture.get<ICouponRepository>(COUPON_REPOSITORY);
    userCouponRepository = moduleFixture.get<IUserCouponRepository>(USER_COUPON_REPOSITORY);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /orders', () => {
    let testUser: any;
    let testProduct: any;
    let testProductOption1: any;
    let testProductOption2: any;
    let testBalance: any;
    let testCoupon: any;
    let testUserCoupon: any;

    beforeEach(async () => {
      // 테스트 사용자 생성
      testUser = await userRepository.save({ name: '주문테스트사용자' });

      // 테스트 상품 생성
      testProduct = await productRepository.saveProduct({
        name: '테스트 상품',
      });

      // 테스트 상품 옵션 생성
      testProductOption1 = await productOptionRepository.saveProductOption({
        name: '128GB',
        price: 800000,
        stock: 50,
        productId: testProduct.id,
      });

      testProductOption2 = await productOptionRepository.saveProductOption({
        name: '256GB',
        price: 900000,
        stock: 30,
        productId: testProduct.id,
      });

      // 테스트 잔액 생성 (기존 잔액이 있으면 업데이트)
      const existingBalance = await balanceRepository.findByUserId(testUser.id);
      if (existingBalance) {
        testBalance = await balanceRepository.save({
          ...existingBalance,
          amount: 5000000, // 충분한 잔액
        });
      } else {
        testBalance = await balanceRepository.save({
          userId: testUser.id,
          amount: 5000000, // 충분한 잔액
        });
      }

      // 테스트 쿠폰 생성
      testCoupon = await couponRepository.saveCoupon({
        couponCode: 'ORDER_TEST',
        name: '주문 테스트 쿠폰',
        discountAmount: 5000,
        remainingStock: 100,
        expiryDate: new Date('2025-12-31'),
        status: CouponStatus.AVAILABLE,
      });

      // 테스트 사용자 쿠폰 생성
      testUserCoupon = await userCouponRepository.saveUserCoupon({
        userId: testUser.id,
        couponId: testCoupon.id,
        status: UserCouponStatus.AVAILABLE,
      });
    });

    it('주문과 결제를 성공적으로 처리합니다', async () => {
      const orderRequest = {
        products: [
          {
            productId: testProduct.id,
            options: [
              { productOptionId: testProductOption1.id, quantity: 1 },
              { productOptionId: testProductOption2.id, quantity: 2 },
            ],
          },
        ],
        usedAmount: 2595000, // (800000 * 1) + (900000 * 2) - 5000
        couponCode: 'ORDER_TEST',
      };

      const response = await request(app.getHttpServer())
        .post('/orders')
        .set('id', testUser.id.toString())
        .send(orderRequest)
        .expect(201);

      expect(response.body).toMatchObject({
        orderId: expect.any(Number),
        createdAt: expect.any(String),
        items: [
          {
            productId: testProductOption1.id,
            name: '테스트 상품',
            price: 800000,
            quantity: 1,
          },
          {
            productId: testProductOption2.id,
            name: '테스트 상품',
            price: 900000,
            quantity: 2,
          },
        ],
        totalAmount: 2600000, // (800000 * 1) + (900000 * 2)
        discountAmount: 5000,
        finalAmount: 2595000, // 2600000 - 5000
        status: OrderStatus.CONFIRMED,
        couponCode: 'ORDER_TEST',
      });

      // DB에서 실제 저장된 주문 확인
      const orderFromDb = await orderRepository.findById(response.body.orderId);
      expect(orderFromDb).not.toBeNull();
      expect(orderFromDb!.userId).toBe(testUser.id);
      expect(orderFromDb!.totalPrice).toBe(2595000);
      expect(orderFromDb!.status).toBe(OrderStatus.CONFIRMED);

      // 잔액이 차감되었는지 확인
      const balanceFromDb = await balanceRepository.findByUserId(testUser.id);
      expect(balanceFromDb!.amount).toBe(5000000 - 2595000);

      // 재고가 차감되었는지 확인
      const productOption1FromDb = await productOptionRepository.findById(testProductOption1.id);
      expect(productOption1FromDb!.stock).toBe(50 - 1);

      const productOption2FromDb = await productOptionRepository.findById(testProductOption2.id);
      expect(productOption2FromDb!.stock).toBe(30 - 2);

      // 쿠폰이 사용되었는지 확인
      const userCouponFromDb = await userCouponRepository.findUserCouponByUserIdAndCouponId(testUser.id, testCoupon.id);
      expect(userCouponFromDb!.status).toBe(UserCouponStatus.USED);
      expect(userCouponFromDb!.usedDate).not.toBeNull();
    });

    it('쿠폰 없이 주문을 성공적으로 처리합니다', async () => {
      const orderRequest = {
        products: [
          {
            productId: testProduct.id,
            options: [{ productOptionId: testProductOption1.id, quantity: 1 }],
          },
        ],
        usedAmount: 800000, // 800000 * 1
      };

      const response = await request(app.getHttpServer())
        .post('/orders')
        .set('id', testUser.id.toString())
        .send(orderRequest)
        .expect(201);

      expect(response.body).toMatchObject({
        orderId: expect.any(Number),
        totalAmount: 800000,
        discountAmount: 0,
        finalAmount: 800000,
        status: OrderStatus.CONFIRMED,
        couponCode: null,
      });

      // 잔액이 차감되었는지 확인
      const balanceFromDb = await balanceRepository.findByUserId(testUser.id);
      expect(balanceFromDb!.amount).toBe(5000000 - 800000);
    });

    it('잔액이 부족한 경우 400 에러를 반환합니다', async () => {
      // 잔액을 부족하게 설정
      await balanceRepository.save({
        ...testBalance,
        amount: 100000, // 부족한 잔액
      });

      const orderRequest = {
        products: [
          {
            productId: testProduct.id,
            options: [{ productOptionId: testProductOption1.id, quantity: 1 }],
          },
        ],
        usedAmount: 800000,
      };

      const response = await request(app.getHttpServer())
        .post('/orders')
        .set('id', testUser.id.toString())
        .send(orderRequest)
        .expect(400);

      expect(response.body.message).toContain('잔액이 부족합니다');
    });

    it('재고가 부족한 경우 400 에러를 반환합니다', async () => {
      // 재고를 부족하게 설정
      await productOptionRepository.saveProductOption({
        id: testProductOption1.id,
        name: '128GB',
        price: 800000,
        stock: 0, // 재고 없음
        productId: testProduct.id,
      });

      const orderRequest = {
        products: [
          {
            productId: testProduct.id,
            options: [{ productOptionId: testProductOption1.id, quantity: 1 }],
          },
        ],
        usedAmount: 800000,
      };

      const response = await request(app.getHttpServer())
        .post('/orders')
        .set('id', testUser.id.toString())
        .send(orderRequest)
        .expect(400);

      expect(response.body.message).toContain('재고가 부족합니다');
    });

    it('존재하지 않는 상품 옵션으로 주문 시 400 에러를 반환합니다', async () => {
      const orderRequest = {
        products: [
          {
            productId: testProduct.id,
            options: [
              { productOptionId: 999, quantity: 1 }, // 존재하지 않는 옵션
            ],
          },
        ],
        usedAmount: 800000,
      };

      const response = await request(app.getHttpServer())
        .post('/orders')
        .set('id', testUser.id.toString())
        .send(orderRequest)
        .expect(400);

      expect(response.body.message).toContain('상품 검증 실패');
    });

    it('사용할 수 없는 쿠폰으로 주문 시 400 에러를 반환합니다', async () => {
      const orderRequest = {
        products: [
          {
            productId: testProduct.id,
            options: [{ productOptionId: testProductOption1.id, quantity: 1 }],
          },
        ],
        usedAmount: 795000, // 800000 - 5000
        couponCode: 'INVALID_COUPON',
      };

      const response = await request(app.getHttpServer())
        .post('/orders')
        .set('id', testUser.id.toString())
        .send(orderRequest)
        .expect(400);

      expect(response.body.message).toContain('사용할 수 없는 쿠폰입니다');
    });

    it('사용 금액이 주문 금액과 일치하지 않을 때 400 에러를 반환합니다', async () => {
      const orderRequest = {
        products: [
          {
            productId: testProduct.id,
            options: [{ productOptionId: testProductOption1.id, quantity: 1 }],
          },
        ],
        usedAmount: 700000, // 잘못된 금액
        couponCode: 'ORDER_TEST',
      };

      const response = await request(app.getHttpServer())
        .post('/orders')
        .set('id', testUser.id.toString())
        .send(orderRequest)
        .expect(400);

      expect(response.body.message).toContain('사용 금액이 주문 금액과 일치하지 않습니다');
    });

    it('할인 금액이 주문 금액보다 클 때 400 에러를 반환합니다', async () => {
      // 큰 할인 금액의 쿠폰 생성
      const bigDiscountCoupon = await couponRepository.saveCoupon({
        couponCode: 'BIG_DISC',
        name: '큰 할인 쿠폰',
        discountAmount: 1000000, // 큰 할인
        remainingStock: 100,
        expiryDate: new Date('2025-12-31'),
        status: CouponStatus.AVAILABLE,
      });

      await userCouponRepository.saveUserCoupon({
        userId: testUser.id,
        couponId: bigDiscountCoupon.id,
        status: UserCouponStatus.AVAILABLE,
      });

      const orderRequest = {
        products: [
          {
            productId: testProduct.id,
            options: [{ productOptionId: testProductOption1.id, quantity: 1 }],
          },
        ],
        usedAmount: 100, // 최소 금액
        couponCode: 'BIG_DISC',
      };

      const response = await request(app.getHttpServer())
        .post('/orders')
        .set('id', testUser.id.toString())
        .send(orderRequest)
        .expect(400);

      expect(response.body.message).toBe('할인 금액이 주문 금액보다 클 수 없습니다.');
    });

    it('쿠폰 사용 시 userCouponId가 올바르게 저장됩니다', async () => {
      const orderRequest = {
        products: [
          {
            productId: testProduct.id,
            options: [{ productOptionId: testProductOption1.id, quantity: 1 }],
          },
        ],
        usedAmount: 795000, // 800000 - 5000
        couponCode: 'ORDER_TEST',
      };

      const response = await request(app.getHttpServer())
        .post('/orders')
        .set('id', testUser.id.toString())
        .send(orderRequest)
        .expect(201);

      expect(response.body).toMatchObject({
        orderId: expect.any(Number),
        totalAmount: 800000,
        discountAmount: 5000,
        finalAmount: 795000,
        status: OrderStatus.CONFIRMED,
        couponCode: 'ORDER_TEST',
      });

      // DB에서 실제 저장된 주문과 쿠폰 정보 확인
      const orderFromDb = await orderRepository.findById(response.body.orderId);
      expect(orderFromDb).not.toBeNull();

      const orderCouponFromDb = await orderCouponRepository.findByOrderId(response.body.orderId);
      expect(orderCouponFromDb).not.toBeNull();
      expect(orderCouponFromDb!.userCouponId).toBe(testUserCoupon.id);
      expect(orderCouponFromDb!.couponId).toBe(testCoupon.id);
      expect(orderCouponFromDb!.discountAmount).toBe(5000);

      // 쿠폰이 사용되었는지 확인
      const userCouponFromDb = await userCouponRepository.findUserCouponByUserIdAndCouponId(testUser.id, testCoupon.id);
      expect(userCouponFromDb!.status).toBe(UserCouponStatus.USED);
      expect(userCouponFromDb!.usedDate).not.toBeNull();
    });

    it('쿠폰 없이 주문 시 userCouponId가 null로 저장됩니다', async () => {
      const orderRequest = {
        products: [
          {
            productId: testProduct.id,
            options: [{ productOptionId: testProductOption1.id, quantity: 1 }],
          },
        ],
        usedAmount: 800000,
      };

      const response = await request(app.getHttpServer())
        .post('/orders')
        .set('id', testUser.id.toString())
        .send(orderRequest)
        .expect(201);

      expect(response.body).toMatchObject({
        orderId: expect.any(Number),
        totalAmount: 800000,
        discountAmount: 0,
        finalAmount: 800000,
        status: OrderStatus.CONFIRMED,
        couponCode: null,
      });

      // DB에서 실제 저장된 주문 확인 (쿠폰 정보 없어야 함)
      const orderFromDb = await orderRepository.findById(response.body.orderId);
      expect(orderFromDb).not.toBeNull();

      const orderCouponFromDb = await orderCouponRepository.findByOrderId(response.body.orderId);
      expect(orderCouponFromDb).toBeNull(); // 쿠폰 없이 주문했으므로 OrderCoupon 레코드가 없어야 함
    });

    it('쿠폰을 찾을 수 없을 때 주문이 실패합니다', async () => {
      // 존재하지 않는 쿠폰 코드로 주문
      const orderRequest = {
        products: [
          {
            productId: testProduct.id,
            options: [{ productOptionId: testProductOption1.id, quantity: 1 }],
          },
        ],
        usedAmount: 800000, // 쿠폰 할인 없음
        couponCode: 'NON_EXISTENT_COUPON',
      };

      const response = await request(app.getHttpServer())
        .post('/orders')
        .set('id', testUser.id.toString())
        .send(orderRequest)
        .expect(400);

      expect(response.body.message).toContain('사용할 수 없는 쿠폰입니다');
    });
  });
});
