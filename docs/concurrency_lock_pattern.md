# 동시성 제어를 위한 Lock 패턴

## 개요

동시성 제어는 여러 사용자나 프로세스가 동시에 같은 데이터에 접근할 때 데이터 일관성을 보장하기 위한 핵심 기술입니다. 이 문서에서는 **Optimistic Lock**, **Pessimistic Lock**, **Distributed Lock** 세 가지 주요 Lock 패턴에 대해 자세히 설명합니다.

---

## 1. Optimistic Lock (낙관적 잠금)

### 작동 원리

**"충돌이 거의 일어나지 않을 것이다"**라는 낙관적인 가정 하에 작동하는 잠금 방식입니다.

#### 비유
도서관에서 책을 빌릴 때, 여러 사람이 같은 책을 동시에 빌리려고 할 가능성이 낮다고 생각하고 특별한 예약 시스템 없이 운영하는 것과 같습니다. 만약 충돌이 발생하면 그때 처리합니다.

#### 동작 과정
1. 데이터 읽기 시 **버전 정보**를 함께 저장
2. 업데이트 시 저장된 버전과 현재 버전을 비교
3. 버전이 같으면 업데이트 수행하고 버전 증가
4. 버전이 다르면 충돌로 판단하고 실패 처리

### NestJS 예시 코드

```typescript
// User Entity with Version
@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  balance: number;

  @VersionColumn()
  version: number; // Optimistic Lock을 위한 버전 컬럼
}

// UserService with Optimistic Lock
@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async updateBalance(userId: number, amount: number): Promise<User> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. 현재 사용자 정보 조회 (버전 포함)
      const user = await queryRunner.manager.findOne(User, {
        where: { id: userId },
      });

      if (!user) {
        throw new Error('사용자를 찾을 수 없습니다');
      }

      // 2. 잔액 업데이트
      user.balance += amount;

      // 3. 저장 시 버전 체크 (TypeORM이 자동으로 처리)
      const updatedUser = await queryRunner.manager.save(user);
      
      await queryRunner.commitTransaction();
      return updatedUser;

    } catch (error) {
      await queryRunner.rollbackTransaction();
      
      // OptimisticLockVersionMismatchError 처리
      if (error.name === 'OptimisticLockVersionMismatchError') {
        throw new ConflictException('다른 사용자가 먼저 수정했습니다. 다시 시도해주세요.');
      }
      throw error;
      
    } finally {
      await queryRunner.release();
    }
  }
}

// Controller with Retry Logic
@Controller('users')
export class UserController {
  constructor(private userService: UserService) {}

  @Put(':id/balance')
  async updateBalance(
    @Param('id') userId: number,
    @Body() updateDto: { amount: number },
  ) {
    const maxRetries = 3;
    let retryCount = 0;

    while (retryCount < maxRetries) {
      try {
        return await this.userService.updateBalance(userId, updateDto.amount);
      } catch (error) {
        if (error instanceof ConflictException && retryCount < maxRetries - 1) {
          retryCount++;
          // 짧은 지연 후 재시도
          await new Promise(resolve => setTimeout(resolve, 100 * retryCount));
          continue;
        }
        throw error;
      }
    }
  }
}
```

### 활용 사례

1. **사용자 프로필 업데이트**: 사용자가 자신의 프로필을 수정하는 경우
2. **재고 관리**: 재고 수량이 충분하고 동시 주문이 많지 않은 상품
3. **게시글 수정**: 블로그 글이나 댓글 수정
4. **설정 정보 업데이트**: 시스템 설정이나 사용자 환경설정

### 장점
- **성능 우수**: 실제 잠금을 사용하지 않아 성능 오버헤드가 적음
- **데드락 없음**: 잠금을 걸지 않아 데드락 발생 위험이 없음
- **확장성 좋음**: 읽기 작업이 차단되지 않아 동시성이 높음

### 단점
- **충돌 시 재시도**: 충돌 발생 시 클라이언트에서 재시도 로직 필요
- **충돌률 높으면 비효율**: 동시 수정이 빈번한 경우 성능 저하
- **복잡한 에러 처리**: 버전 충돌 상황에 대한 적절한 처리 필요

---

## 2. Pessimistic Lock (비관적 잠금)

### 작동 원리

**"충돌이 자주 일어날 것이다"**라는 비관적인 가정 하에 미리 잠금을 걸어두는 방식입니다.

#### 비유
은행 창구에서 계좌 업무를 볼 때, 한 번에 한 사람만 특정 계좌에 대한 작업을 할 수 있도록 "이 계좌는 현재 사용 중"이라는 표시를 해두는 것과 같습니다.

#### 동작 과정
1. 데이터 읽기 시 **배타적 잠금(Exclusive Lock)** 설정
2. 다른 트랜잭션은 해당 데이터에 접근 불가 (대기)
3. 작업 완료 후 잠금 해제
4. 대기 중인 다른 트랜잭션이 순차적으로 실행

### NestJS 예시 코드

```typescript
// UserService with Pessimistic Lock
@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private dataSource: DataSource,
  ) {}

  async updateBalanceWithLock(userId: number, amount: number): Promise<User> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. 비관적 잠금으로 사용자 조회
      const user = await queryRunner.manager.findOne(User, {
        where: { id: userId },
        lock: { mode: 'pessimistic_write' }, // 배타적 잠금
      });

      if (!user) {
        throw new Error('사용자를 찾을 수 없습니다');
      }

      // 2. 잔액 검증
      if (user.balance + amount < 0) {
        throw new Error('잔액이 부족합니다');
      }

      // 3. 잔액 업데이트 (이 시점에 다른 트랜잭션은 대기 중)
      user.balance += amount;
      const updatedUser = await queryRunner.manager.save(user);

      await queryRunner.commitTransaction();
      return updatedUser;

    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // 여러 사용자의 잔액을 원자적으로 업데이트
  async transferBalance(fromUserId: number, toUserId: number, amount: number): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 데드락 방지를 위해 ID 순서로 정렬하여 잠금
      const [smallerId, largerId] = [fromUserId, toUserId].sort((a, b) => a - b);
      
      const user1 = await queryRunner.manager.findOne(User, {
        where: { id: smallerId },
        lock: { mode: 'pessimistic_write' },
      });

      const user2 = await queryRunner.manager.findOne(User, {
        where: { id: largerId },
        lock: { mode: 'pessimistic_write' },
      });

      const fromUser = fromUserId === smallerId ? user1 : user2;
      const toUser = fromUserId === smallerId ? user2 : user1;

      if (!fromUser || !toUser) {
        throw new Error('사용자를 찾을 수 없습니다');
      }

      if (fromUser.balance < amount) {
        throw new Error('송금할 잔액이 부족합니다');
      }

      // 송금 처리
      fromUser.balance -= amount;
      toUser.balance += amount;

      await queryRunner.manager.save([fromUser, toUser]);
      await queryRunner.commitTransaction();

    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}

// 타임아웃을 고려한 서비스
@Injectable()
export class OrderService {
  async processOrderWithStock(productId: number, quantity: number): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 재고에 대한 비관적 잠금 (타임아웃 5초)
      const product = await queryRunner.manager
        .createQueryBuilder(Product, 'product')
        .setLock('pessimistic_write')
        .where('product.id = :id', { id: productId })
        .getOne();

      if (!product) {
        throw new Error('상품을 찾을 수 없습니다');
      }

      if (product.stock < quantity) {
        throw new Error('재고가 부족합니다');
      }

      // 재고 차감
      product.stock -= quantity;
      await queryRunner.manager.save(product);

      // 주문 생성 로직...
      await this.createOrder(queryRunner, productId, quantity);

      await queryRunner.commitTransaction();

    } catch (error) {
      await queryRunner.rollbackTransaction();
      
      if (error.message.includes('timeout')) {
        throw new Error('시스템이 바쁩니다. 잠시 후 다시 시도해주세요.');
      }
      throw error;
      
    } finally {
      await queryRunner.release();
    }
  }
}
```

### 활용 사례

1. **은행 거래**: 계좌 잔액 변경, 송금 처리
2. **재고 관리**: 한정된 수량의 상품 주문 처리
3. **좌석 예약**: 콘서트, 영화관 좌석 예약
4. **순번 관리**: 대기번호 발급, 카운터 증가

### 장점
- **데이터 일관성 보장**: 충돌 상황을 원천적으로 방지
- **단순한 로직**: 복잡한 재시도 로직이 불필요
- **확실한 동시성 제어**: 임계 구역에서 완전한 배타적 접근 보장

### 단점
- **성능 저하**: 잠금 대기로 인한 처리량 감소
- **데드락 위험**: 여러 리소스에 대한 잠금 시 데드락 가능성
- **확장성 제한**: 읽기 작업도 차단될 수 있어 동시성 저하

---

## 3. Distributed Lock (분산 잠금)

### 작동 원리

**여러 서버나 프로세스가 분산된 환경**에서 전역적으로 잠금을 관리하는 방식입니다.

#### 비유
여러 지점을 가진 프랜차이즈 매장에서 "오늘의 한정 메뉴"를 관리할 때, 본사에서 중앙 집중식으로 재고를 관리하여 모든 지점에서 일관된 서비스를 제공하는 것과 같습니다.

#### 동작 과정
1. **중앙 저장소**(Redis, ZooKeeper 등)에 잠금 키 설정
2. TTL(Time To Live)을 설정하여 자동 만료 보장
3. 작업 완료 후 명시적으로 잠금 해제
4. 다른 인스턴스는 잠금이 해제될 때까지 대기

### NestJS 예시 코드

```typescript
// Redis를 이용한 Distributed Lock 구현
@Injectable()
export class DistributedLockService {
  constructor(
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async acquireLock(
    lockKey: string,
    timeout: number = 10000,
    retryDelay: number = 100,
  ): Promise<string | null> {
    const lockValue = `${Date.now()}-${Math.random()}`;
    const endTime = Date.now() + timeout;

    while (Date.now() < endTime) {
      // NX: key가 존재하지 않을 때만 설정, PX: 밀리초 단위 TTL
      const result = await this.redis.set(
        lockKey,
        lockValue,
        'PX',
        timeout,
        'NX',
      );

      if (result === 'OK') {
        return lockValue; // 잠금 획득 성공
      }

      // 잠시 대기 후 재시도
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }

    return null; // 잠금 획득 실패
  }

  async releaseLock(lockKey: string, lockValue: string): Promise<boolean> {
    // Lua 스크립트로 원자적 해제 (자신의 잠금인지 확인 후 해제)
    const luaScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    const result = await this.redis.eval(luaScript, 1, lockKey, lockValue);
    return result === 1;
  }

  async extendLock(lockKey: string, lockValue: string, ttl: number): Promise<boolean> {
    const luaScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("pexpire", KEYS[1], ARGV[2])
      else
        return 0
      end
    `;

    const result = await this.redis.eval(luaScript, 1, lockKey, lockValue, ttl);
    return result === 1;
  }
}

// 분산 잠금을 활용한 비즈니스 서비스
@Injectable()
export class CouponService {
  constructor(
    private distributedLockService: DistributedLockService,
    private couponRepository: CouponRepository,
  ) {}

  async issueLimitedCoupon(couponId: number, userId: number): Promise<boolean> {
    const lockKey = `coupon:${couponId}:issue`;
    const lockTimeout = 5000; // 5초

    // 1. 분산 잠금 획득
    const lockValue = await this.distributedLockService.acquireLock(
      lockKey,
      lockTimeout,
    );

    if (!lockValue) {
      throw new Error('시스템이 바쁩니다. 잠시 후 다시 시도해주세요.');
    }

    try {
      // 2. 쿠폰 정보 조회
      const coupon = await this.couponRepository.findById(couponId);
      if (!coupon) {
        throw new Error('쿠폰을 찾을 수 없습니다.');
      }

      // 3. 발급 가능 여부 확인
      if (coupon.issuedCount >= coupon.limitCount) {
        throw new Error('쿠폰이 모두 소진되었습니다.');
      }

      // 4. 이미 발급받았는지 확인
      const existingIssue = await this.couponRepository.findUserCoupon(
        couponId,
        userId,
      );
      if (existingIssue) {
        throw new Error('이미 발급받은 쿠폰입니다.');
      }

      // 5. 쿠폰 발급 처리
      await this.couponRepository.issueCoupon(couponId, userId);
      
      return true;

    } finally {
      // 6. 잠금 해제 (반드시 실행)
      await this.distributedLockService.releaseLock(lockKey, lockValue);
    }
  }
}

// 데코레이터를 활용한 분산 잠금
export function DistributedLock(lockKeyGenerator: (args: any[]) => string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const lockService: DistributedLockService = this.distributedLockService;
      const lockKey = lockKeyGenerator(args);
      const lockValue = await lockService.acquireLock(lockKey, 10000);

      if (!lockValue) {
        throw new Error('분산 잠금 획득에 실패했습니다.');
      }

      try {
        return await method.apply(this, args);
      } finally {
        await lockService.releaseLock(lockKey, lockValue);
      }
    };
  };
}

// 데코레이터 사용 예시
@Injectable()
export class PaymentService {
  constructor(
    private distributedLockService: DistributedLockService,
  ) {}

  @DistributedLock((args) => `payment:user:${args[0]}`)
  async processPayment(userId: number, amount: number): Promise<boolean> {
    // 사용자별 결제 처리 (동시 결제 방지)
    console.log(`사용자 ${userId}의 ${amount}원 결제 처리 중...`);
    
    // 결제 로직 수행
    await this.performPayment(userId, amount);
    
    return true;
  }

  private async performPayment(userId: number, amount: number): Promise<void> {
    // 실제 결제 처리 로직
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}
```

### 활용 사례

1. **마이크로서비스 간 동기화**: 여러 서비스에서 공유 리소스 접근
2. **글로벌 카운터 관리**: 전체 시스템의 순번이나 ID 생성
3. **배치 작업 조정**: 여러 인스턴스에서 중복 실행 방지
4. **캐시 갱신**: 분산 환경에서 캐시 무효화 동기화
5. **한정 수량 이벤트**: 선착순 쿠폰 발급, 한정판 상품 판매

### 장점
- **확장성**: 분산 환경에서 글로벌 동시성 제어 가능
- **유연성**: 다양한 백엔드 스토리지 지원 (Redis, ZooKeeper, etcd)
- **장애 복구**: TTL을 통한 자동 잠금 해제로 데드락 방지

### 단점
- **네트워크 의존성**: 네트워크 지연이나 장애에 영향을 받음
- **복잡성**: 구현과 운영이 복잡함
- **성능 오버헤드**: 네트워크 통신으로 인한 지연 시간
- **단일 장애점**: 중앙 저장소가 장애 시 전체 시스템 영향

---

## 패턴 비교 및 선택 가이드

### 성능 비교

| 구분 | Optimistic Lock | Pessimistic Lock | Distributed Lock |
|------|-----------------|------------------|------------------|
| **읽기 성능** | 높음 | 보통 | 보통 |
| **쓰기 성능** | 높음 (충돌 없을 때) | 낮음 | 낮음 |
| **동시성** | 높음 | 낮음 | 낮음 |
| **확장성** | 높음 | 낮음 | 높음 |

### 상황별 권장 패턴

#### Optimistic Lock 권장 상황
- 읽기가 많고 쓰기가 적은 시스템
- 동시 수정 확률이 낮은 데이터
- 높은 성능과 확장성이 필요한 경우
- 단일 데이터베이스 환경

#### Pessimistic Lock 권장 상황
- 데이터 일관성이 매우 중요한 경우
- 동시 수정 확률이 높은 데이터
- 충돌 시 재시도 비용이 큰 경우
- 단일 데이터베이스 환경에서 확실한 제어 필요

#### Distributed Lock 권장 상황
- 마이크로서비스 분산 환경
- 여러 애플리케이션 인스턴스가 동일한 리소스에 접근
- 글로벌 동시성 제어가 필요한 경우
- 배치 작업의 중복 실행 방지

---

## 실제 운영 시 고려사항

### 1. 성능 최적화
- **잠금 범위 최소화**: 필요한 부분만 잠금 설정
- **잠금 시간 단축**: 빠른 처리로 대기 시간 감소
- **적절한 타임아웃**: 무한 대기 방지

### 2. 장애 대응
- **데드락 감지**: 모니터링 및 자동 해결 메커니즘
- **잠금 누수 방지**: TTL 설정으로 자동 해제
- **장애 복구**: 중앙 저장소 장애 시 대체 방안

### 3. 모니터링
- **잠금 획득/해제 로그**: 디버깅을 위한 상세 로깅
- **성능 지표**: 잠금 대기 시간, 처리량 모니터링
- **알림 시스템**: 비정상적인 잠금 상황 감지

---

## 4. Lock 패턴 결합 사용 (Hybrid Locking Strategies)

실제 운영 환경에서는 단일 Lock 패턴보다는 **여러 패턴을 결합**하여 사용하는 경우가 많습니다. 각 패턴의 장점을 살리고 단점을 보완하여 더 효율적이고 안정적인 동시성 제어를 구현할 수 있습니다.

### 4.1 Optimistic Lock + Distributed Lock 결합

#### 사용 상황
- **대용량 트래픽 이벤트**: 쿠폰 발급, 한정판 상품 주문
- **분산 환경에서의 재고 관리**: 여러 서버에서 동시 접근하는 상품 재고

#### 작동 원리
1. **Distributed Lock**으로 전역 접근 제어 (거친 잠금)
2. **Optimistic Lock**으로 세밀한 데이터 일관성 보장 (세밀한 제어)

#### 비유
백화점 세일 이벤트에서 **입장 제한**(Distributed Lock)을 걸어 혼잡을 방지하고, 각 매장에서는 **재고 확인표**(Optimistic Lock)로 정확한 판매를 관리하는 것과 같습니다.

```typescript
@Injectable()
export class HybridCouponService {
  constructor(
    private distributedLockService: DistributedLockService,
    private couponRepository: CouponRepository,
  ) {}

  async issueLimitedCouponHybrid(couponId: number, userId: number): Promise<boolean> {
    const distributedLockKey = `coupon:${couponId}:global`;
    const lockTimeout = 3000;
    
    // 1. 분산 잠금으로 전역 접근 제어
    const lockValue = await this.distributedLockService.acquireLock(
      distributedLockKey,
      lockTimeout,
    );

    if (!lockValue) {
      throw new ConflictException('시스템이 바쁩니다. 잠시 후 다시 시도해주세요.');
    }

    try {
      // 2. Optimistic Lock으로 세밀한 제어 (재시도 로직 포함)
      return await this.processWithOptimisticLock(couponId, userId);
      
    } finally {
      await this.distributedLockService.releaseLock(distributedLockKey, lockValue);
    }
  }

  private async processWithOptimisticLock(
    couponId: number, 
    userId: number,
    maxRetries: number = 3,
  ): Promise<boolean> {
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
      try {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
          // Optimistic Lock으로 쿠폰 조회 (버전 포함)
          const coupon = await queryRunner.manager.findOne(Coupon, {
            where: { id: couponId },
          });

          if (!coupon) {
            throw new BadRequestException('쿠폰을 찾을 수 없습니다.');
          }

          // 발급 가능 여부 확인
          if (coupon.issuedCount >= coupon.limitCount) {
            throw new BadRequestException('쿠폰이 모두 소진되었습니다.');
          }

          // 중복 발급 확인
          const existingIssue = await queryRunner.manager.findOne(UserCoupon, {
            where: { couponId, userId },
          });

          if (existingIssue) {
            throw new BadRequestException('이미 발급받은 쿠폰입니다.');
          }

          // 쿠폰 발급 처리 (버전 자동 증가)
          coupon.issuedCount += 1;
          await queryRunner.manager.save(coupon);

          // 사용자 쿠폰 생성
          const userCoupon = queryRunner.manager.create(UserCoupon, {
            couponId,
            userId,
            issuedAt: new Date(),
          });
          await queryRunner.manager.save(userCoupon);

          await queryRunner.commitTransaction();
          return true;

        } catch (error) {
          await queryRunner.rollbackTransaction();
          throw error;
        } finally {
          await queryRunner.release();
        }

      } catch (error) {
        if (error.name === 'OptimisticLockVersionMismatchError' && retryCount < maxRetries - 1) {
          retryCount++;
          // 지수 백오프 적용
          await new Promise(resolve => 
            setTimeout(resolve, Math.pow(2, retryCount) * 50)
          );
          continue;
        }
        throw error;
      }
    }

    throw new ConflictException('쿠폰 발급에 실패했습니다. 다시 시도해주세요.');
  }
}
```

### 4.2 Pessimistic Lock + Distributed Lock 결합

#### 사용 상황
- **금융 거래**: 여러 서버에서 처리되는 계좌 이체
- **결제 처리**: 분산 환경에서의 중복 결제 방지

#### 작동 원리
1. **Distributed Lock**으로 서버 간 동기화
2. **Pessimistic Lock**으로 데이터베이스 레벨 잠금

```typescript
@Injectable()
export class HybridPaymentService {
  constructor(
    private distributedLockService: DistributedLockService,
    private dataSource: DataSource,
  ) {}

  async processPaymentWithHybridLock(
    userId: number, 
    paymentId: string, 
    amount: number,
  ): Promise<Payment> {
    const globalLockKey = `payment:${paymentId}`;
    const userLockKey = `user:balance:${userId}`;
    
    // 1. 결제 중복 처리 방지를 위한 분산 잠금
    const paymentLockValue = await this.distributedLockService.acquireLock(
      globalLockKey,
      5000,
    );

    if (!paymentLockValue) {
      throw new ConflictException('결제가 이미 처리 중입니다.');
    }

    // 2. 사용자 잔액 처리를 위한 분산 잠금
    const userLockValue = await this.distributedLockService.acquireLock(
      userLockKey,
      3000,
    );

    if (!userLockValue) {
      await this.distributedLockService.releaseLock(globalLockKey, paymentLockValue);
      throw new ConflictException('사용자 계정이 사용 중입니다.');
    }

    try {
      // 3. 데이터베이스 레벨에서 Pessimistic Lock 적용
      return await this.processWithPessimisticLock(userId, paymentId, amount);

    } finally {
      // 4. 분산 잠금 해제 (역순으로 해제)
      await this.distributedLockService.releaseLock(userLockKey, userLockValue);
      await this.distributedLockService.releaseLock(globalLockKey, paymentLockValue);
    }
  }

  private async processWithPessimisticLock(
    userId: number,
    paymentId: string,
    amount: number,
  ): Promise<Payment> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Pessimistic Lock으로 사용자 잔액 조회
      const user = await queryRunner.manager.findOne(User, {
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!user) {
        throw new BadRequestException('사용자를 찾을 수 없습니다.');
      }

      if (user.balance < amount) {
        throw new BadRequestException('잔액이 부족합니다.');
      }

      // 중복 결제 확인
      const existingPayment = await queryRunner.manager.findOne(Payment, {
        where: { paymentId },
      });

      if (existingPayment) {
        throw new ConflictException('이미 처리된 결제입니다.');
      }

      // 잔액 차감
      user.balance -= amount;
      await queryRunner.manager.save(user);

      // 결제 기록 생성
      const payment = queryRunner.manager.create(Payment, {
        paymentId,
        userId,
        amount,
        status: 'COMPLETED',
        processedAt: new Date(),
      });
      await queryRunner.manager.save(payment);

      await queryRunner.commitTransaction();
      return payment;

    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
```

### 4.3 단계적 Lock 적용 (Tiered Locking)

#### 사용 상황
- **대규모 재고 관리**: 전체 재고 → 카테고리별 → 개별 상품 순서로 점진적 잠금
- **계층적 데이터 구조**: 조직도, 카테고리 트리 등의 계층적 업데이트

```typescript
@Injectable()
export class TieredInventoryService {
  constructor(
    private distributedLockService: DistributedLockService,
    private dataSource: DataSource,
  ) {}

  async updateInventoryWithTieredLock(
    categoryId: number,
    productId: number,
    quantity: number,
  ): Promise<void> {
    // 1단계: 카테고리 레벨 분산 잠금 (거친 잠금)
    const categoryLockKey = `inventory:category:${categoryId}`;
    const categoryLockValue = await this.distributedLockService.acquireLock(
      categoryLockKey,
      5000,
    );

    if (!categoryLockValue) {
      throw new ConflictException('카테고리 재고가 업데이트 중입니다.');
    }

    try {
      // 2단계: 상품 레벨 분산 잠금 (세밀한 잠금)
      const productLockKey = `inventory:product:${productId}`;
      const productLockValue = await this.distributedLockService.acquireLock(
        productLockKey,
        3000,
      );

      if (!productLockValue) {
        throw new ConflictException('상품 재고가 업데이트 중입니다.');
      }

      try {
        // 3단계: 데이터베이스 레벨 Optimistic Lock
        await this.updateWithOptimisticLock(categoryId, productId, quantity);

      } finally {
        await this.distributedLockService.releaseLock(productLockKey, productLockValue);
      }

    } finally {
      await this.distributedLockService.releaseLock(categoryLockKey, categoryLockValue);
    }
  }

  private async updateWithOptimisticLock(
    categoryId: number,
    productId: number,
    quantity: number,
  ): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 카테고리 재고 확인 (Optimistic Lock)
      const category = await queryRunner.manager.findOne(Category, {
        where: { id: categoryId },
      });

      // 상품 재고 확인 (Optimistic Lock)
      const product = await queryRunner.manager.findOne(Product, {
        where: { id: productId },
      });

      if (!category || !product) {
        throw new BadRequestException('카테고리 또는 상품을 찾을 수 없습니다.');
      }

      if (product.stock < quantity) {
        throw new BadRequestException('재고가 부족합니다.');
      }

      // 재고 업데이트
      product.stock -= quantity;
      category.totalStock -= quantity;

      await queryRunner.manager.save([product, category]);
      await queryRunner.commitTransaction();

    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
```

### 4.4 Fallback Lock Strategy (대체 잠금 전략)

#### 사용 상황
- **고가용성 시스템**: 주 잠금 방식 실패 시 대체 방식 사용
- **네트워크 불안정 환경**: 분산 잠금 실패 시 로컬 잠금으로 대체

```typescript
@Injectable()
export class FallbackLockService {
  constructor(
    private distributedLockService: DistributedLockService,
    private dataSource: DataSource,
    private logger: Logger,
  ) {}

  async processWithFallbackStrategy(
    resourceId: string,
    operation: () => Promise<any>,
  ): Promise<any> {
    // 1차 시도: Distributed Lock
    try {
      return await this.processWithDistributedLock(resourceId, operation);
    } catch (error) {
      this.logger.warn(`분산 잠금 실패, 로컬 잠금으로 대체: ${error.message}`);
      
      // 2차 시도: Pessimistic Lock (로컬 DB)
      try {
        return await this.processWithPessimisticLock(resourceId, operation);
      } catch (fallbackError) {
        this.logger.warn(`비관적 잠금 실패, 낙관적 잠금으로 대체: ${fallbackError.message}`);
        
        // 3차 시도: Optimistic Lock (최후 수단)
        return await this.processWithOptimisticLock(resourceId, operation);
      }
    }
  }

  private async processWithDistributedLock(
    resourceId: string,
    operation: () => Promise<any>,
  ): Promise<any> {
    const lockKey = `resource:${resourceId}`;
    const lockValue = await this.distributedLockService.acquireLock(lockKey, 2000);
    
    if (!lockValue) {
      throw new Error('분산 잠금 획득 실패');
    }

    try {
      return await operation();
    } finally {
      await this.distributedLockService.releaseLock(lockKey, lockValue);
    }
  }

  private async processWithPessimisticLock(
    resourceId: string,
    operation: () => Promise<any>,
  ): Promise<any> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 리소스에 대한 더미 레코드로 잠금 구현
      await queryRunner.manager
        .createQueryBuilder()
        .select()
        .from('lock_table', 'lock')
        .where('resource_id = :resourceId', { resourceId })
        .setLock('pessimistic_write')
        .getRawOne();

      const result = await operation();
      await queryRunner.commitTransaction();
      return result;

    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async processWithOptimisticLock(
    resourceId: string,
    operation: () => Promise<any>,
    maxRetries: number = 3,
  ): Promise<any> {
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
      try {
        return await operation();
      } catch (error) {
        if (error.name === 'OptimisticLockVersionMismatchError' && retryCount < maxRetries - 1) {
          retryCount++;
          await new Promise(resolve => setTimeout(resolve, 100 * retryCount));
          continue;
        }
        throw error;
      }
    }
  }
}
```

### 결합 패턴 선택 가이드

| 결합 패턴 | 적용 상황 | 주요 이점 | 주의사항 |
|----------|-----------|-----------|----------|
| **Optimistic + Distributed** | 대용량 트래픽 이벤트 | 높은 성능 + 글로벌 제어 | 복잡한 재시도 로직 필요 |
| **Pessimistic + Distributed** | 금융/결제 시스템 | 확실한 일관성 보장 | 성능 오버헤드 고려 |
| **단계적 Lock** | 계층적 리소스 관리 | 세밀한 동시성 제어 | 데드락 방지 순서 중요 |
| **Fallback Strategy** | 고가용성 시스템 | 장애 복구력 향상 | 각 레벨별 일관성 정책 필요 |

---

## 5. Lock 패턴 결합 시 고려사항

### 5.1 성능 최적화
- **Lock 순서 정의**: 데드락 방지를 위한 일관된 잠금 순서
- **타임아웃 계층화**: 상위 Lock의 타임아웃 > 하위 Lock 타임아웃
- **Back-pressure 적용**: 과부하 시 요청 제한으로 시스템 보호

### 5.2 장애 복구 전략
- **Circuit Breaker 패턴**: 연속 실패 시 자동 차단
- **Health Check**: 각 잠금 메커니즘의 상태 모니터링
- **Graceful Degradation**: 일부 기능 제한으로 서비스 유지

### 5.3 모니터링 및 알림
- **Lock 계층별 메트릭**: 각 단계별 성능 지표 수집
- **예외 상황 알림**: 잠금 실패율, 대기 시간 임계값 모니터링
- **비즈니스 임팩트 추적**: 잠금으로 인한 비즈니스 지표 영향 분석

각 패턴은 고유한 특성과 적합한 사용 상황이 있으며, **실제 운영 환경에서는 여러 패턴을 조합하여 사용**하는 것이 일반적입니다. 시스템의 요구사항, 트래픽 패턴, 인프라 환경을 종합적으로 고려하여 최적의 조합을 선택해야 합니다.