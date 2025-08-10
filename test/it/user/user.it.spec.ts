import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { getTestDatasource } from '../setup';
import { AppModule } from '../../../src/app.module';
import { IUserRepository, USER_REPOSITORY } from '../../../src/user/domain/user.repository.interface';
import { getDataSourceToken } from '@nestjs/typeorm';

describe('User Integration Test (IT)', () => {
  let app: INestApplication;
  let userRepository: IUserRepository;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(getDataSourceToken())
      .useValue(getTestDatasource())
      .compile();

    app = moduleFixture.createNestApplication();
    userRepository = moduleFixture.get<IUserRepository>(USER_REPOSITORY);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /user/profile', () => {
    it('존재하지 않는 사용자 조회 시 404 에러를 반환합니다', async () => {
      const nonExistentUserId = 999;

      const response = await request(app.getHttpServer())
        .get('/user/profile')
        .set('id', nonExistentUserId.toString())
        .expect(404);

      expect(response.body.message).toBe(`ID가 '${nonExistentUserId}'인 사용자를 찾을 수 없습니다.`);
    });

    it('존재하는 사용자의 프로필을 성공적으로 조회합니다', async () => {
      // 테스트용 사용자를 Repository를 통해 생성
      const testUserName = '김철수';
      const createdUser = await userRepository.save({ name: testUserName });
      const userId = createdUser.id;

      const response = await request(app.getHttpServer()).get('/user/profile').set('id', userId.toString()).expect(200);

      expect(response.body).toEqual({
        id: userId,
        name: testUserName,
      });

      // Repository를 통해 실제 저장된 사용자 검증
      const userFromDb = await userRepository.findById(userId);
      expect(userFromDb).not.toBeNull();
      expect(userFromDb!.name).toBe(testUserName);
      expect(userFromDb!.id).toBe(userId);
    });
  });
});
