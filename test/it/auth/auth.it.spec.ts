import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { getTestDatasource } from '../setup';
import { AppModule } from '../../../src/app.module';
import { IBalanceRepository, BALANCE_REPOSITORY } from '../../../src/balance/domain/balance.repository.interface';
import { IUserRepository, USER_REPOSITORY } from '../../../src/user/domain/user.repository.interface';
import { getDataSourceToken } from '@nestjs/typeorm';
import { RegisterRequest } from '../../../src/auth/dto/register-request';

describe('Auth Integration Test (IT)', () => {
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

  describe('POST /auth/register', () => {
    it('회원가입 시 사용자 생성과 잔액 0원 초기화가 트랜잭션으로 처리됩니다', async () => {
      const registerRequest: RegisterRequest = { name: '김철수' };

      await request(app.getHttpServer()).post('/auth/register').send(registerRequest).expect(201);

      const createdUser = await userRepository.findByName(registerRequest.name);
      expect(createdUser).not.toBeNull();
      expect(createdUser!.name).toBe(registerRequest.name);

      const userBalance = await balanceRepository.findByUserId(createdUser!.id);
      expect(userBalance).not.toBeNull();
      expect(userBalance!.amount).toBe(0);
      expect(userBalance!.userId).toBe(createdUser!.id);
    });

    it('이미 존재하는 사용자명으로 회원가입 시 400 에러를 반환합니다', async () => {
      const duplicateName = '이영희';

      await userRepository.save({ name: duplicateName });

      const registerRequest: RegisterRequest = { name: duplicateName };

      const response = await request(app.getHttpServer()).post('/auth/register').send(registerRequest).expect(400);

      expect(response.body.message).toBe(`이름이 '${duplicateName}'인 사용자가 이미 존재합니다.`);
    });

    it('잘못된 이름으로 회원가입 시 400 에러를 반환합니다', async () => {
      const invalidRequest = { name: '' }; // 빈 문자열

      const response = await request(app.getHttpServer()).post('/auth/register').send(invalidRequest).expect(400);

      expect(response.body.message).toContain('이름은 필수 입력값입니다.');
    });

    it('이름이 너무 짧을 때 400 에러를 반환합니다', async () => {
      const invalidRequest = { name: '김' }; // 1글자

      const response = await request(app.getHttpServer()).post('/auth/register').send(invalidRequest).expect(400);

      expect(response.body.message).toContain('이름은 최소 2글자 이상이어야 합니다.');
    });

    it('이름이 너무 길 때 400 에러를 반환합니다', async () => {
      const longName = 'a'.repeat(31); // 31글자
      const invalidRequest = { name: longName };

      const response = await request(app.getHttpServer()).post('/auth/register').send(invalidRequest).expect(400);

      expect(response.body.message).toContain('이름은 최대 30글자까지 입력 가능합니다.');
    });
  });
});
