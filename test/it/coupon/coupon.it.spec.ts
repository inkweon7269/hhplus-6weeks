import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { getTestDatasource } from '../setup';
import { AppModule } from '../../../src/app.module';
import { ICouponRepository, COUPON_REPOSITORY } from '../../../src/coupon/domain/coupon.repository.interface';
import {
  IUserCouponRepository,
  USER_COUPON_REPOSITORY,
} from '../../../src/coupon/domain/user-coupon.repository.interface';
import { IUserRepository, USER_REPOSITORY } from '../../../src/user/domain/user.repository.interface';
import { getDataSourceToken } from '@nestjs/typeorm';
import { CouponStatus, UserCouponStatus } from '../../../src/coupon/enum/coupon-status.enum';

describe('Coupon Integration Test (IT)', () => {
  let app: INestApplication;
  let couponRepository: ICouponRepository;
  let userCouponRepository: IUserCouponRepository;
  let userRepository: IUserRepository;

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

    couponRepository = moduleFixture.get<ICouponRepository>(COUPON_REPOSITORY);
    userCouponRepository = moduleFixture.get<IUserCouponRepository>(USER_COUPON_REPOSITORY);
    userRepository = moduleFixture.get<IUserRepository>(USER_REPOSITORY);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /coupons', () => {
    it('쿠폰 목록을 페이지네이션으로 조회합니다', async () => {
      const testCoupon1 = await couponRepository.saveCoupon({
        couponCode: 'TEST001',
        name: '테스트 쿠폰 1',
        discountAmount: 5000,
        remainingStock: 100,
        expiryDate: new Date('2025-12-31'),
        status: CouponStatus.AVAILABLE,
      });

      const testCoupon2 = await couponRepository.saveCoupon({
        couponCode: 'TEST002',
        name: '테스트 쿠폰 2',
        discountAmount: 10000,
        remainingStock: 50,
        expiryDate: new Date('2025-12-31'),
        status: CouponStatus.SUSPENDED,
      });

      const response = await request(app.getHttpServer()).get('/coupons?page=1&limit=10').expect(200);

      expect(response.body.list).toHaveLength(2);
      expect(response.body.totalCount).toBe(2);
      expect(response.body.currentPage).toBe(1);
      expect(response.body.totalPages).toBe(1);

      const coupon1 = response.body.list.find((c: any) => c.couponCode === 'TEST001');
      expect(coupon1).toMatchObject({
        id: testCoupon1.id,
        name: '테스트 쿠폰 1',
        couponCode: 'TEST001',
        discountAmount: 5000,
        remainingStock: 100,
        status: CouponStatus.AVAILABLE,
      });
    });

    it('상태별로 쿠폰을 필터링하여 조회합니다', async () => {
      await couponRepository.saveCoupon({
        couponCode: 'FILTER001',
        name: '필터 테스트 쿠폰',
        discountAmount: 3000,
        remainingStock: 80,
        expiryDate: new Date('2025-12-31'),
        status: CouponStatus.AVAILABLE,
      });

      await couponRepository.saveCoupon({
        couponCode: 'FILTER002',
        name: '필터 테스트 쿠폰 2',
        discountAmount: 5000,
        remainingStock: 40,
        expiryDate: new Date('2025-12-31'),
        status: CouponStatus.SUSPENDED,
      });

      const response = await request(app.getHttpServer())
        .get(`/coupons?page=1&limit=10&status=${CouponStatus.AVAILABLE}`)
        .expect(200);

      expect(response.body.list).toHaveLength(1);
      expect(response.body.list[0].status).toBe(CouponStatus.AVAILABLE);
    });
  });

  describe('POST /coupons/:couponId/issue', () => {
    let testUser: any;
    let testCoupon: any;

    beforeEach(async () => {
      testUser = await userRepository.save({ name: '김철수' });
      testCoupon = await couponRepository.saveCoupon({
        couponCode: 'ISSUE001',
        name: '발급 테스트 쿠폰',
        discountAmount: 7000,
        remainingStock: 10,
        expiryDate: new Date('2025-12-31'),
        status: CouponStatus.AVAILABLE,
      });
    });

    it('존재하지 않는 쿠폰 발급 시 400 에러를 반환합니다', async () => {
      const nonExistentCouponId = 999;
      const response = await request(app.getHttpServer())
        .post(`/coupons/${nonExistentCouponId}/issue`)
        .set('id', testUser.id.toString())
        .expect(400);

      expect(response.body.message).toBe('존재하지 않는 쿠폰입니다.');
    });

    it('재고가 부족한 쿠폰 발급 시 400 에러를 반환합니다', async () => {
      const outOfStockCoupon = await couponRepository.saveCoupon({
        couponCode: 'OUTSTOCK',
        name: '재고없음 쿠폰',
        discountAmount: 3000,
        remainingStock: 0,
        expiryDate: new Date('2025-12-31'),
        status: CouponStatus.AVAILABLE,
      });

      const response = await request(app.getHttpServer())
        .post(`/coupons/${outOfStockCoupon.id}/issue`)
        .set('id', testUser.id.toString())
        .expect(400);

      expect(response.body.message).toBe('쿠폰 재고가 부족합니다.');
    });

    it('만료된 쿠폰 발급 시 400 에러를 반환합니다', async () => {
      const expiredCoupon = await couponRepository.saveCoupon({
        couponCode: 'EXPIRED',
        name: '만료된 쿠폰',
        discountAmount: 5000,
        remainingStock: 50,
        expiryDate: new Date('2025-12-31'),
        status: CouponStatus.EXPIRED,
      });

      const response = await request(app.getHttpServer())
        .post(`/coupons/${expiredCoupon.id}/issue`)
        .set('id', testUser.id.toString())
        .expect(400);

      expect(response.body.message).toBe('만료된 쿠폰은 발급할 수 없습니다.');
    });

    it('일시중단된 쿠폰 발급 시 400 에러를 반환합니다', async () => {
      const suspendedCoupon = await couponRepository.saveCoupon({
        couponCode: 'SUSPEND',
        name: '중단된 쿠폰',
        discountAmount: 8000,
        remainingStock: 30,
        expiryDate: new Date('2025-12-31'),
        status: CouponStatus.SUSPENDED,
      });

      const response = await request(app.getHttpServer())
        .post(`/coupons/${suspendedCoupon.id}/issue`)
        .set('id', testUser.id.toString())
        .expect(400);

      expect(response.body.message).toBe('일시중단된 쿠폰은 발급할 수 없습니다.');
    });

    it('이미 발급받은 쿠폰 중복 발급 시 400 에러를 반환합니다', async () => {
      await userCouponRepository.saveUserCoupon({
        userId: testUser.id,
        couponId: testCoupon.id,
        status: UserCouponStatus.AVAILABLE,
      });

      const response = await request(app.getHttpServer())
        .post(`/coupons/${testCoupon.id}/issue`)
        .set('id', testUser.id.toString())
        .expect(400);

      expect(response.body.message).toBe('이미 발급받은 쿠폰입니다.');
    });

    it('쿠폰을 발급합니다', async () => {
      const response = await request(app.getHttpServer())
        .post(`/coupons/${testCoupon.id}/issue`)
        .set('id', testUser.id.toString())
        .expect(201);

      expect(response.body).toMatchObject({
        userId: testUser.id,
        couponCode: 'ISSUE001',
        couponName: '발급 테스트 쿠폰',
        discountAmount: 7000,
        status: UserCouponStatus.AVAILABLE,
        usedDate: null,
      });
      expect(response.body.id).toBeDefined();
      expect(response.body.issuedDate).toBeDefined();
      expect(response.body.expiryDate).toBeDefined();

      // DB에서 실제 저장된 데이터 확인
      const userCouponFromDb = await userCouponRepository.findUserCouponByUserIdAndCouponId(testUser.id, testCoupon.id);
      expect(userCouponFromDb).not.toBeNull();
      expect(userCouponFromDb!.userId).toBe(testUser.id);
      expect(userCouponFromDb!.couponId).toBe(testCoupon.id);
      expect(userCouponFromDb!.status).toBe(UserCouponStatus.AVAILABLE);

      // 쿠폰 재고가 감소했는지 확인
      const couponFromDb = await couponRepository.findCouponById(testCoupon.id);
      expect(couponFromDb!.remainingStock).toBe(testCoupon.remainingStock - 1);
    });
  });

  describe('GET /coupons/users/me', () => {
    let testUser: any;
    let testCoupon: any;

    beforeEach(async () => {
      testUser = await userRepository.save({ name: '박민수' });
      testCoupon = await couponRepository.saveCoupon({
        couponCode: 'MYCP001',
        name: '내 쿠폰 테스트',
        discountAmount: 12000,
        remainingStock: 100,
        expiryDate: new Date('2025-12-31'),
        status: CouponStatus.AVAILABLE,
      });
    });

    it('사용자가 보유한 쿠폰 목록을 페이지네이션으로 조회합니다', async () => {
      const userCoupon = await userCouponRepository.saveUserCoupon({
        userId: testUser.id,
        couponId: testCoupon.id,
        status: UserCouponStatus.AVAILABLE,
      });

      const response = await request(app.getHttpServer())
        .get('/coupons/users/me?page=1&limit=10')
        .set('id', testUser.id.toString())
        .expect(200);

      expect(response.body.list).toHaveLength(1);
      expect(response.body.totalCount).toBe(1);
      expect(response.body.currentPage).toBe(1);
      expect(response.body.totalPages).toBe(1);

      const myCoupon = response.body.list[0];
      expect(myCoupon).toMatchObject({
        id: userCoupon.id,
        userId: testUser.id,
        couponCode: 'MYCP001',
        couponName: '내 쿠폰 테스트',
        discountAmount: 12000,
        status: UserCouponStatus.AVAILABLE,
        usedDate: null,
      });
      expect(myCoupon.issuedDate).toBeDefined();
      expect(myCoupon.expiryDate).toBeDefined();
    });
  });
});
