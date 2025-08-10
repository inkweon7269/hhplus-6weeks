import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { getTestDatasource } from '../setup';
import { AppModule } from '../../../src/app.module';
import { IBalanceRepository, BALANCE_REPOSITORY } from '../../../src/balance/domain/balance.repository.interface';
import { IUserRepository, USER_REPOSITORY } from '../../../src/user/domain/user.repository.interface';
import { getDataSourceToken } from '@nestjs/typeorm';
import { BalanceRechargeRequest } from '../../../src/balance/dto/request/balance-recharge-request';

describe('Balance Integration Test (IT)', () => {
  let app: INestApplication;
  let balanceRepository: IBalanceRepository;
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

    balanceRepository = moduleFixture.get<IBalanceRepository>(BALANCE_REPOSITORY);
    userRepository = moduleFixture.get<IUserRepository>(USER_REPOSITORY);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /balances', () => {
    it('존재하지 않는 사용자의 잔액 조회 시 404 에러를 반환합니다', async () => {
      const nonExistentUserId = 999;

      const response = await request(app.getHttpServer())
        .get('/balances')
        .set('id', nonExistentUserId.toString())
        .expect(404);

      expect(response.body.message).toBe(`ID가 '${nonExistentUserId}'인 사용자의 잔액 정보를 찾을 수 없습니다.`);
    });

    it('존재하는 사용자의 잔액을 성공적으로 조회합니다', async () => {
      const testUser = await userRepository.save({ name: '김철수' });
      const userId = testUser.id;

      const testBalance = 150000;
      const createdBalance = await balanceRepository.save({
        userId,
        amount: testBalance,
      });

      const response = await request(app.getHttpServer()).get('/balances').set('id', userId.toString()).expect(200);

      expect(response.body).toMatchObject({
        id: createdBalance.id,
        userId: userId,
        amount: testBalance,
      });
      expect(response.body.createdAt).toBeDefined();
      expect(response.body.updatedAt).toBeDefined();

      // Repository를 통해 실제 저장된 잔액 검증
      const balanceFromDb = await balanceRepository.findByUserId(userId);
      expect(balanceFromDb).not.toBeNull();
      expect(balanceFromDb!.amount).toBe(testBalance);
      expect(balanceFromDb!.userId).toBe(userId);
    });
  });

  describe('POST /balances/recharge', () => {
    it('잔액 정보가 없는 사용자에게 충전 요청 시 404 에러를 반환합니다', async () => {
      // 테스트용 사용자 생성 (잔액 없음 - 회원가입을 통하지 않은 경우)
      const testUser = await userRepository.save({ name: '이영희' });
      const userId = testUser.id;

      const rechargeRequest: BalanceRechargeRequest = { amount: 50000 };

      const response = await request(app.getHttpServer())
        .post('/balances/recharge')
        .set('id', userId.toString())
        .send(rechargeRequest)
        .expect(404);

      expect(response.body.message).toBe(`ID가 '${userId}'인 사용자의 잔액 정보를 찾을 수 없습니다.`);

      // 잔액이 생성되지 않았는지 확인
      const balanceFromDb = await balanceRepository.findByUserId(userId);
      expect(balanceFromDb).toBeNull();
    });

    it('기존 사용자의 경우 잔액을 추가로 충전합니다', async () => {
      const testUser = await userRepository.save({ name: '박민수' });
      const userId = testUser.id;

      const initialAmount = 100000;
      await balanceRepository.save({
        userId,
        amount: initialAmount,
      });

      const rechargeRequest: BalanceRechargeRequest = { amount: 30000 };
      const expectedAmount = initialAmount + rechargeRequest.amount;

      await request(app.getHttpServer())
        .post('/balances/recharge')
        .set('id', userId.toString())
        .send(rechargeRequest)
        .expect(201);

      const balanceFromDb = await balanceRepository.findByUserId(userId);
      expect(balanceFromDb).not.toBeNull();
      expect(balanceFromDb!.amount).toBe(expectedAmount);
      expect(balanceFromDb!.userId).toBe(userId);
    });

    it('잘못된 충전 금액으로 요청 시 400 에러를 반환합니다', async () => {
      const testUser = await userRepository.save({ name: '최지우' });
      const userId = testUser.id;
      const invalidRequest = { amount: 12345 };

      const response = await request(app.getHttpServer())
        .post('/balances/recharge')
        .set('id', userId.toString())
        .send(invalidRequest)
        .expect(400);

      expect(response.body.message).toContain('충전 금액은 100원 단위로만 입력 가능합니다.');
    });

    it('최소 금액 미만으로 요청 시 400 에러를 반환합니다', async () => {
      const testUser = await userRepository.save({ name: '강하늘' });
      const userId = testUser.id;

      const invalidRequest = { amount: 50 };

      const response = await request(app.getHttpServer())
        .post('/balances/recharge')
        .set('id', userId.toString())
        .send(invalidRequest)
        .expect(400);

      expect(response.body.message).toContain('충전 금액은 최소 100원 이상이어야 합니다.');
    });

    it('음수 금액으로 요청 시 400 에러를 반환합니다', async () => {
      const testUser = await userRepository.save({ name: '송혜교' });
      const userId = testUser.id;

      const invalidRequest = { amount: -1000 };

      const response = await request(app.getHttpServer())
        .post('/balances/recharge')
        .set('id', userId.toString())
        .send(invalidRequest)
        .expect(400);

      expect(response.body.message).toContain('amount must be a positive number');
    });

    it('여러 번 충전 시 잔액이 정확히 누적됩니다', async () => {
      const testUser = await userRepository.save({ name: '연속충전테스트' });
      const userId = testUser.id;

      // 초기 잔액 설정
      const initialAmount = 50000;
      await balanceRepository.save({
        userId,
        amount: initialAmount,
      });

      // 첫 번째 충전
      const firstRecharge = { amount: 20000 };
      await request(app.getHttpServer())
        .post('/balances/recharge')
        .set('id', userId.toString())
        .send(firstRecharge)
        .expect(201);

      // 첫 번째 충전 후 잔액 확인
      let balanceFromDb = await balanceRepository.findByUserId(userId);
      expect(balanceFromDb!.amount).toBe(initialAmount + firstRecharge.amount);

      // 두 번째 충전
      const secondRecharge = { amount: 30000 };
      await request(app.getHttpServer())
        .post('/balances/recharge')
        .set('id', userId.toString())
        .send(secondRecharge)
        .expect(201);

      // 두 번째 충전 후 최종 잔액 확인
      balanceFromDb = await balanceRepository.findByUserId(userId);
      const expectedFinalAmount = initialAmount + firstRecharge.amount + secondRecharge.amount;
      expect(balanceFromDb!.amount).toBe(expectedFinalAmount);
    });


  });
});
