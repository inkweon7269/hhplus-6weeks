# 테스트 코드 작성 가이드

## 1. 현재 작성된 테스트 코드 작성 방식

### 테스트 구조

현재 프로젝트는 **테스트 피라미드(Test Pyramid)** 구조를 따르고 있습니다:

```
📁 프로젝트 구조
├── src/
│   └── [모듈명]/
│       └── __tests__/           # 유닛 테스트 (Mock 기반)
│           ├── [모듈명].service.spec.ts
│           └── [모듈명].facade.spec.ts
└── test/
    └── it/                      # 통합 테스트 (TestContainer 기반)
        ├── setup.ts
        ├── util.ts
        └── [모듈명]/
            └── [모듈명].it.spec.ts
```

### 테스트 분류

1. **유닛 테스트**: 개별 컴포넌트(Service, Facade)의 로직 검증
2. **통합 테스트**: 실제 데이터베이스 연동 및 API 엔드포인트 검증

## 2. Mock 기반 테스트 코드 작성 목적

### 목적

- **빠른 피드백**: 테스트 실행 시간 최소화 (~100ms)
- **격리된 테스트**: 외부 의존성 제거로 순수한 로직 검증
- **개발 효율성**: 코드 변경 시 즉시 검증 가능

### 사용 시기

- Service 레이어의 비즈니스 로직 검증
- Facade 레이어의 조합 로직 검증
- Repository 인터페이스 동작 검증

### Mock 대상

- Repository 인터페이스
- 외부 서비스 호출
- 데이터베이스 연결

## 3. TestContainer 작성 방식과 목적

### 목적

- **실제 환경 검증**: 실제 PostgreSQL 데이터베이스와의 연동 테스트
- **End-to-End 검증**: API 엔드포인트부터 데이터베이스까지 전체 플로우 검증
- **데이터 일관성 검증**: 실제 데이터 저장/조회 동작 확인

### 사용 시기

- API 엔드포인트 동작 검증
- 데이터베이스 스키마 및 마이그레이션 검증
- 실제 데이터 연동 시나리오 테스트

### TestContainer 설정

```typescript
// test/it/setup.ts
beforeAll(async () => {
  // PostgreSQL 컨테이너 시작
  postgres = await new PostgreSqlContainer('postgres:15')
    .withDatabase('dbname')
    .withUsername('postgres')
    .withPassword('pw')
    .start();

  // 환경 변수 설정
  process.env.DB_HOST = postgres.getHost();
  process.env.DB_PORT = postgres.getPort().toString();
  // ... 기타 설정

  // 데이터소스 생성 및 마이그레이션 실행
  datasource = await getDatasource();
  await datasource.runMigrations();
}, 30000);

beforeEach(async () => {
  // 테스트마다 테이블 초기화
  await datasource.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
}, 10000);
```

## 4. User 모듈 테스트 코드 분석

### 4.1 User Service 유닛 테스트 (Mock 기반)

**파일 위치**: `src/user/__tests__/user.service.spec.ts`

```typescript
describe('UserService', () => {
  let service: UserService;
  let userRepository: jest.Mocked<IUserRepository>;

  beforeEach(async () => {
    // Mock Repository 생성
    const mockUserRepository = {
      findById: jest.fn(),
      findByName: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: USER_REPOSITORY,
          useValue: mockUserRepository, // Mock 주입
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    userRepository = module.get(USER_REPOSITORY);
  });

  describe('getUserProfile', () => {
    it('사용자가 존재하지 않을 때 NotFoundException을 전달합니다.', async () => {
      const userId = 999;
      userRepository.findById.mockResolvedValue(null); // Mock 동작 설정

      await expect(service.getUserProfile(userId)).rejects.toThrow(
        new NotFoundException(`ID가 '${userId}'인 사용자를 찾을 수 없습니다.`),
      );
      expect(userRepository.findById).toHaveBeenCalledWith(userId);
    });
  });
});
```

**특징**:

- Repository를 Mock으로 대체하여 빠른 실행
- Service 로직만 순수하게 검증
- 외부 의존성 없이 격리된 테스트 환경

### 4.2 User Facade 유닛 테스트 (Mock 기반)

**파일 위치**: `src/user/__tests__/user.facade.spec.ts`

```typescript
describe('UserFacade', () => {
  let facade: UserFacade;
  let userService: jest.Mocked<UserService>;

  beforeEach(async () => {
    const mockUserService = {
      getUserProfile: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserFacade,
        {
          provide: UserService,
          useValue: mockUserService, // Service Mock 주입
        },
      ],
    }).compile();

    facade = module.get<UserFacade>(UserFacade);
    userService = module.get(UserService);
  });

  describe('getUserProfile', () => {
    it('사용자가 존재할 때 프로필 정보를 반환합니다.', async () => {
      const userId = 1;
      userService.getUserProfile.mockResolvedValue(mockUserProfile);

      const result: GetUserProfileResponse = await facade.getUserProfile(userId);

      expect(result).toEqual(mockUserProfile);
      expect(userService.getUserProfile).toHaveBeenCalledWith(userId);
    });
  });
});
```

**특징**:

- Service 레이어를 Mock으로 대체
- Facade의 조합 로직만 검증
- 계층 간 의존성 격리

### 4.3 User 통합 테스트 (TestContainer 기반)

**파일 위치**: `test/it/user/user.it.spec.ts`

```typescript
describe('User Integration Test (IT)', () => {
  let app: INestApplication;
  let userRepository: IUserRepository;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule], // 전체 모듈 로드
    })
      .overrideProvider(getDataSourceToken())
      .useValue(getTestDatasource()) // TestContainer 데이터소스 주입
      .compile();

    app = moduleFixture.createNestApplication();
    userRepository = moduleFixture.get<IUserRepository>(USER_REPOSITORY);

    await app.init();
  });

  describe('GET /user/profile', () => {
    it('존재하는 사용자의 프로필을 성공적으로 조회합니다', async () => {
      // 실제 데이터베이스에 테스트 데이터 생성
      const testUserName = '김철수';
      const createdUser = await userRepository.save({ name: testUserName });
      const userId = createdUser.id;

      // 실제 HTTP 요청으로 API 테스트
      const response = await request(app.getHttpServer()).get('/user/profile').set('id', userId.toString()).expect(200);

      expect(response.body).toEqual({
        id: userId,
        name: testUserName,
      });

      // Repository를 통해 실제 저장된 데이터 검증
      const userFromDb = await userRepository.findById(userId);
      expect(userFromDb).not.toBeNull();
      expect(userFromDb!.name).toBe(testUserName);
    });
  });
});
```

**특징**:

- 실제 PostgreSQL 컨테이너 사용
- 전체 애플리케이션 모듈 로드
- HTTP 요청을 통한 End-to-End 테스트
- 실제 데이터베이스 연동 검증

## 5. 테스트 작성 가이드라인

### 5.1 유닛 테스트 작성 시

1. **Mock 사용**: 외부 의존성은 Mock으로 대체
2. **빠른 실행**: 테스트 실행 시간 100ms 이하 유지
3. **격리된 환경**: 다른 테스트와 독립적으로 실행
4. **명확한 검증**: 각 테스트는 하나의 동작만 검증

### 5.2 통합 테스트 작성 시

1. **실제 환경**: TestContainer로 실제 데이터베이스 사용
2. **End-to-End**: API 엔드포인트부터 데이터베이스까지 전체 플로우
3. **데이터 검증**: 실제 저장/조회 동작 확인
4. **시나리오 기반**: 실제 사용 시나리오를 테스트

### 5.3 테스트 네이밍 컨벤션

```typescript
// 유닛 테스트
describe('[ServiceName]', () => {
  describe('[methodName]', () => {
    it('상황 설명 + 기대 결과', async () => {
      // 테스트 구현
    });
  });
});

// 통합 테스트
describe('[ModuleName] Integration Test (IT)', () => {
  describe('[HTTP_METHOD] [endpoint]', () => {
    it('시나리오 설명 + 기대 결과', async () => {
      // 테스트 구현
    });
  });
});
```

## 6. 테스트 실행 방법

### 유닛 테스트 실행

```bash
# 특정 모듈의 유닛 테스트만 실행
npm test src/user/__tests__/

# 전체 유닛 테스트 실행
npm test
```

### 통합 테스트 실행

```bash
# 통합 테스트 실행
npm run test:it

# 특정 통합 테스트만 실행
npm run test:it -- --testPathPattern=user
```

## 7. 결론

현재 프로젝트는 **테스트 피라미드** 구조를 잘 따르고 있습니다:

- **유닛 테스트**: 빠른 피드백과 격리된 환경으로 개발 효율성 확보
- **통합 테스트**: 실제 환경 검증으로 신뢰성 확보

이러한 구조를 통해 개발 속도와 코드 품질을 모두 확보할 수 있습니다.

## 8. 참고 자료

- [Node.js TestContainers + Jest로 유닛테스트 작성하기](https://velog.io/@toto9602/Nodejs-testcontainers-jest%EB%A1%9C-%EC%9C%A0%EB%8B%9B%ED%85%8C%EC%8A%A4%ED%8A%B8-%EC%9E%91%EC%84%B1%ED%95%98%EA%B8%B0) - TestContainers를 활용한 유닛 테스트 작성 방법
- [Improving Integration/E2E testing using NestJS and TestContainers](https://dev.to/medaymentn/improving-intergratione2e-testing-using-nestjs-and-testcontainers-3eh0) - NestJS와 TestContainers를 활용한 통합/E2E 테스트 개선 방법
