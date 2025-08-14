# Redis 기반 락 패턴 완전 가이드

Redis를 중심으로 다양한 락 패턴을 이해하고 실무에 적용하는 방법을 입문자도 쉽게 배울 수 있도록 정리한 문서입니다.

## 📋 목차
1. [Redis가 락에 적합한 이유](#redis가-락에-적합한-이유)
2. [Redis Distributed Lock](#redis-distributed-lock)
3. [Redis Simple Lock](#redis-simple-lock)  
4. [Redis Spin Lock](#redis-spin-lock)
5. [Redis Pub/Sub Lock](#redis-pubsub-lock)
6. [Redis와 트랜잭션 순서 보장](#redis와-트랜잭션-순서-보장)
7. [실무 적용 가이드](#실무-적용-가이드)

---

## Redis가 락에 적합한 이유

### 🎯 Redis의 핵심 특징

**🏢 중앙 집중식 관리소 비유**
- 여러 지점(서버)이 있는 대기업에서 중앙 본사(Redis)가 모든 자원을 관리
- 각 지점은 본사에 허가를 받아야만 작업 수행 가능
- 실시간으로 소통하며 중복 작업 방지

#### 1. 원자적 연산 (Atomic Operations)
```bash
# SET NX PX: 한 번에 설정하고 만료시간까지 지정
SET lock:user:123 "server-1" NX PX 5000
# NX: key가 없을 때만 설정
# PX: 밀리초 단위 만료시간 (5초)
```

#### 2. 고성능 메모리 저장소
- **응답속도**: 1ms 이하의 초고속 응답
- **처리량**: 초당 10만+ 연산 처리 가능
- **지연시간**: 네트워크 지연 최소화

#### 3. 다양한 자료구조 지원
```bash
# String: 단순 락
SET lock:resource:123 "locked"

# Hash: 복합 락 정보
HSET lock:order:456 owner "server-1" timestamp 1640995200 ttl 5000

# List: 대기열 기반 락
LPUSH lock:queue:789 "server-1"

# Pub/Sub: 이벤트 기반 락
PUBLISH lock:release:123 "unlocked"
```

---

## Redis Distributed Lock

### 🌍 분산 락이란?

**🏪 프랜차이즈 매장 관리 시스템 비유**
- 전국에 100개 매장이 있는데, 한정판 상품 1개만 남음
- 모든 매장이 동시에 "마지막 1개 판매"하려고 시도
- 본사 시스템(Redis)에서 중앙 관리로 딱 1개만 판매 허용

### 🔧 기본 구현: SET NX PX 방식

#### 핵심 명령어 이해
```bash
# 락 획득 시도
SET lock:coupon:123 "server-id-abc" NX PX 10000
# 성공 시: OK 반환 (락 획득)
# 실패 시: (nil) 반환 (다른 서버가 이미 락 보유)

# 락 해제 (Lua 스크립트로 안전하게)
local lockValue = redis.call("GET", KEYS[1])
if lockValue == ARGV[1] then
    return redis.call("DEL", KEYS[1])
else
    return 0
end
```

#### NestJS 구현 예시
```typescript
@Injectable()
export class RedisDistributedLockService {
  constructor(
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async acquireLock(
    lockKey: string,
    lockValue: string = `${Date.now()}-${Math.random()}`,
    ttlMs: number = 10000
  ): Promise<string | null> {
    try {
      // SET NX PX를 이용한 원자적 락 획득
      const result = await this.redis.set(
        lockKey,
        lockValue,
        'PX', ttlMs,  // 밀리초 단위 TTL
        'NX'          // key가 없을 때만 설정
      );
      
      return result === 'OK' ? lockValue : null;
    } catch (error) {
      this.logger.error(`락 획득 실패: ${lockKey}`, error);
      return null;
    }
  }

  async releaseLock(lockKey: string, lockValue: string): Promise<boolean> {
    // Lua 스크립트로 원자적 해제 (자신의 락인지 확인 후 해제)
    const luaScript = `
      if redis.call("GET", KEYS[1]) == ARGV[1] then
        return redis.call("DEL", KEYS[1])
      else
        return 0
      end
    `;

    try {
      const result = await this.redis.eval(luaScript, 1, lockKey, lockValue);
      return result === 1;
    } catch (error) {
      this.logger.error(`락 해제 실패: ${lockKey}`, error);
      return false;
    }
  }
}
```

#### 실제 사용 예시
```typescript
@Injectable()
export class CouponService {
  constructor(
    private lockService: RedisDistributedLockService,
  ) {}

  async issueLimitedCoupon(couponId: number, userId: number): Promise<boolean> {
    const lockKey = `coupon:issue:${couponId}`;
    const lockValue = await this.lockService.acquireLock(lockKey, undefined, 5000);
    
    if (!lockValue) {
      throw new ConflictException('쿠폰 발급이 진행 중입니다. 잠시 후 다시 시도해주세요.');
    }

    try {
      // 🎯 이 구간에서는 전 세계 어느 서버도 같은 쿠폰을 발급할 수 없음
      const coupon = await this.couponRepository.findById(couponId);
      
      if (coupon.remainingStock <= 0) {
        throw new BadRequestException('쿠폰이 모두 소진되었습니다.');
      }

      // 쿠폰 발급 처리
      await this.couponRepository.updateStock(couponId, -1);
      await this.userCouponRepository.create({ userId, couponId });
      
      return true;
      
    } finally {
      // 반드시 락 해제
      await this.lockService.releaseLock(lockKey, lockValue);
    }
  }
}
```

### ⚠️ 단일 Redis 방식의 한계점

#### 1. 단일 장애점 (Single Point of Failure)
```typescript
// 🚨 위험한 상황
try {
  const lockValue = await this.redis.set(lockKey, value, 'NX', 'PX', 5000);
} catch (RedisConnectionError) {
  // Redis가 다운되면 모든 락 기능 중단!
  // 해결: Redis 클러스터 또는 Sentinel 구성
}
```

#### 2. 네트워크 분할 상황
```
서버A ────X──── Redis ────✓──── 서버B
(연결 끊김)              (정상 연결)

서버A: "락이 없나보다" (잘못 판단)
서버B: "락 있음" (정확한 상태)
```

### 🛡️ Redlock 알고리즘

**다중 Redis 인스턴스로 안전성 확보**

#### Redlock 동작 원리
```typescript
@Injectable()
export class RedlockService {
  private redisInstances: Redis[] = [
    new Redis({ host: 'redis1.example.com' }),
    new Redis({ host: 'redis2.example.com' }),
    new Redis({ host: 'redis3.example.com' }),
    new Redis({ host: 'redis4.example.com' }),
    new Redis({ host: 'redis5.example.com' }),
  ];

  async acquireRedlock(
    resource: string,
    ttlMs: number = 10000
  ): Promise<{ success: boolean; lockValue?: string }> {
    const lockValue = `${Date.now()}-${Math.random()}`;
    const startTime = Date.now();
    const drift = Math.round(ttlMs * 0.01) + 2; // 클럭 드리프트 보정
    
    let successCount = 0;
    const promises = this.redisInstances.map(async (redis, index) => {
      try {
        const result = await redis.set(resource, lockValue, 'PX', ttlMs, 'NX');
        return result === 'OK';
      } catch (error) {
        this.logger.warn(`Redis ${index} 락 획득 실패:`, error);
        return false;
      }
    });

    const results = await Promise.allSettled(promises);
    successCount = results.filter(
      result => result.status === 'fulfilled' && result.value === true
    ).length;

    const elapsedTime = Date.now() - startTime;
    const validityTime = ttlMs - elapsedTime - drift;

    // 과반수 이상 성공 && 유효시간 남음
    if (successCount >= Math.floor(this.redisInstances.length / 2) + 1 && validityTime > 0) {
      return { success: true, lockValue };
    } else {
      // 실패 시 획득한 락들 모두 해제
      await this.releaseRedlock(resource, lockValue);
      return { success: false };
    }
  }

  async releaseRedlock(resource: string, lockValue: string): Promise<void> {
    const luaScript = `
      if redis.call("GET", KEYS[1]) == ARGV[1] then
        return redis.call("DEL", KEYS[1])
      else
        return 0
      end
    `;

    const promises = this.redisInstances.map(redis =>
      redis.eval(luaScript, 1, resource, lockValue).catch(error => {
        this.logger.warn('Redlock 해제 중 에러:', error);
        return 0;
      })
    );

    await Promise.allSettled(promises);
  }
}
```

---

## Redis Simple Lock

### 🔒 기본 뮤텍스 패턴

**🚗 주차 공간 예약 시스템 비유**
- 주차장에 "예약됨" 팻말을 세우는 것
- 간단하고 직관적이지만 기본적인 기능만 제공

#### 기본 구현
```typescript
@Injectable()
export class RedisSimpleLockService {
  constructor(
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async lock(key: string, ttlSeconds: number = 30): Promise<boolean> {
    // 단순히 키 존재 여부로 락 판단
    const result = await this.redis.setex(key, ttlSeconds, 'locked');
    return result === 'OK';
  }

  async unlock(key: string): Promise<boolean> {
    const result = await this.redis.del(key);
    return result === 1;
  }

  async isLocked(key: string): Promise<boolean> {
    const exists = await this.redis.exists(key);
    return exists === 1;
  }

  async extendLock(key: string, additionalSeconds: number): Promise<boolean> {
    // 락이 존재할 때만 연장
    const luaScript = `
      if redis.call("EXISTS", KEYS[1]) == 1 then
        local currentTtl = redis.call("TTL", KEYS[1])
        if currentTtl > 0 then
          return redis.call("EXPIRE", KEYS[1], currentTtl + ARGV[1])
        end
      end
      return 0
    `;

    const result = await this.redis.eval(luaScript, 1, key, additionalSeconds);
    return result === 1;
  }
}
```

#### 실무 활용 예시
```typescript
@Injectable()
export class FileProcessingService {
  constructor(private lockService: RedisSimpleLockService) {}

  async processLargeFile(fileId: string): Promise<void> {
    const lockKey = `file:processing:${fileId}`;
    
    // 중복 처리 방지
    if (await this.lockService.isLocked(lockKey)) {
      throw new ConflictException('파일이 이미 처리 중입니다.');
    }

    const locked = await this.lockService.lock(lockKey, 300); // 5분
    if (!locked) {
      throw new ConflictException('락 획득에 실패했습니다.');
    }

    try {
      // 긴 작업 수행
      await this.performFileProcessing(fileId);
      
      // 중간에 락 연장이 필요한 경우
      if (await this.needMoreTime()) {
        await this.lockService.extendLock(lockKey, 180); // 3분 추가
      }
      
    } finally {
      await this.lockService.unlock(lockKey);
    }
  }
}
```

### 🔄 자동 갱신 락 (Auto-Renewal Lock)

```typescript
@Injectable()
export class AutoRenewalLockService {
  private renewalIntervals = new Map<string, NodeJS.Timeout>();

  async lockWithAutoRenewal(
    key: string,
    initialTtlSeconds: number = 30,
    renewalIntervalMs: number = 15000 // 15초마다 갱신
  ): Promise<boolean> {
    const locked = await this.redis.setex(key, initialTtlSeconds, 'auto-locked');
    
    if (locked === 'OK') {
      // 자동 갱신 타이머 설정
      const intervalId = setInterval(async () => {
        try {
          await this.redis.expire(key, initialTtlSeconds);
          this.logger.debug(`락 자동 갱신: ${key}`);
        } catch (error) {
          this.logger.error(`락 갱신 실패: ${key}`, error);
          this.stopAutoRenewal(key);
        }
      }, renewalIntervalMs);

      this.renewalIntervals.set(key, intervalId);
      return true;
    }
    
    return false;
  }

  async unlockWithAutoRenewal(key: string): Promise<boolean> {
    // 자동 갱신 중지
    this.stopAutoRenewal(key);
    
    // 락 해제
    const result = await this.redis.del(key);
    return result === 1;
  }

  private stopAutoRenewal(key: string): void {
    const intervalId = this.renewalIntervals.get(key);
    if (intervalId) {
      clearInterval(intervalId);
      this.renewalIntervals.delete(key);
    }
  }
}
```

---

## Redis Spin Lock

### 🔄 폴링 방식 락

**🚪 화장실 문 계속 확인하기 비유**
- 문이 잠겨있으면 계속 손잡이를 돌려보기
- 즉시 반응하지만 CPU를 많이 사용

#### 기본 구현
```typescript
@Injectable()
export class RedisSpinLockService {
  constructor(
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async spinLock(
    lockKey: string,
    timeoutMs: number = 5000,
    spinIntervalMs: number = 50
  ): Promise<string | null> {
    const lockValue = `${Date.now()}-${Math.random()}`;
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      try {
        // 락 획득 시도
        const result = await this.redis.set(
          lockKey,
          lockValue,
          'PX', timeoutMs,
          'NX'
        );
        
        if (result === 'OK') {
          return lockValue; // 성공!
        }
        
        // 잠시 대기 후 재시도
        await this.sleep(spinIntervalMs);
        
      } catch (error) {
        this.logger.error('Spin lock 에러:', error);
        await this.sleep(spinIntervalMs * 2); // 에러 시 더 길게 대기
      }
    }
    
    return null; // 타임아웃
  }

  async adaptiveSpinLock(
    lockKey: string,
    timeoutMs: number = 5000
  ): Promise<string | null> {
    const lockValue = `${Date.now()}-${Math.random()}`;
    const startTime = Date.now();
    let spinInterval = 10; // 10ms부터 시작
    let attempt = 0;
    
    while (Date.now() - startTime < timeoutMs) {
      try {
        const result = await this.redis.set(
          lockKey,
          lockValue,
          'PX', timeoutMs,
          'NX'
        );
        
        if (result === 'OK') {
          this.logger.debug(`Spin lock 성공: ${attempt}번 시도 후`);
          return lockValue;
        }
        
        // 적응형 백오프: 시도할수록 대기 시간 증가
        attempt++;
        if (attempt % 10 === 0) {
          spinInterval = Math.min(spinInterval * 1.5, 200); // 최대 200ms
        }
        
        await this.sleep(spinInterval);
        
      } catch (error) {
        this.logger.error('Adaptive spin lock 에러:', error);
        await this.sleep(spinInterval * 3);
      }
    }
    
    return null;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

#### 언제 사용하는가?

**✅ Spin Lock이 적합한 상황:**
```typescript
// 1. 매우 짧은 임계 구역 (< 100ms)
async updateCounterQuickly(key: string): Promise<void> {
  const lockKey = `counter:${key}`;
  const lockValue = await this.spinLockService.spinLock(lockKey, 1000, 10);
  
  if (lockValue) {
    try {
      // 매우 빠른 작업 (50ms 이내)
      await this.redis.incr(`counter:value:${key}`);
    } finally {
      await this.redis.eval(unlockScript, 1, lockKey, lockValue);
    }
  }
}

// 2. 락 경합이 낮은 상황
async updateUserLastSeen(userId: number): Promise<void> {
  // 한 사용자가 동시에 여러 곳에서 접속할 확률 낮음
  const lockKey = `user:last_seen:${userId}`;
  // ... spin lock 사용
}
```

**❌ Spin Lock을 피해야 하는 상황:**
```typescript
// 1. 긴 작업 (> 1초)
async processLargeOrder(): Promise<void> {
  // 🚫 Spin Lock 사용하면 CPU 낭비!
  // ✅ 대신 일반 락 + 대기 큐 사용
}

// 2. 높은 경합 상황
async handleFlashSale(): Promise<void> {
  // 🚫 1000명이 동시에 spin하면 Redis 서버 부하!
  // ✅ 대신 distributed lock + 재시도 제한
}
```

---

## Redis Pub/Sub Lock

### 📢 이벤트 기반 락

**🎫 대기번호 시스템 비유**
- 은행에서 번호표 뽑고 기다리다가 "123번 고객님" 호출되면 창구로 가기
- 계속 확인하지 않고 호출될 때까지 편안히 대기

#### 기본 구현
```typescript
@Injectable()
export class RedisPubSubLockService {
  private subscribers = new Map<string, (message: string) => void>();
  
  constructor(
    @InjectRedis() private readonly redis: Redis,
    @InjectRedis() private readonly pubRedis: Redis, // Pub용 별도 연결
    @InjectRedis() private readonly subRedis: Redis, // Sub용 별도 연결
  ) {}

  async waitForLock(
    lockKey: string,
    timeoutMs: number = 10000
  ): Promise<string | null> {
    const lockValue = `${Date.now()}-${Math.random()}`;
    const channelKey = `lock:channel:${lockKey}`;
    
    // 1. 먼저 락 획득 시도
    const immediate = await this.redis.set(
      lockKey,
      lockValue,
      'PX', timeoutMs,
      'NX'
    );
    
    if (immediate === 'OK') {
      return lockValue; // 즉시 획득 성공!
    }
    
    // 2. 실패하면 Pub/Sub으로 대기
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.unsubscribe(channelKey);
        resolve(null); // 타임아웃
      }, timeoutMs);

      // 락 해제 알림 구독
      this.subscribe(channelKey, async (message) => {
        if (message === 'released') {
          // 락 해제 알림 받으면 즉시 획득 시도
          const acquired = await this.redis.set(
            lockKey,
            lockValue,
            'PX', timeoutMs,
            'NX'
          );
          
          if (acquired === 'OK') {
            clearTimeout(timeout);
            this.unsubscribe(channelKey);
            resolve(lockValue); // 획득 성공!
          }
          // 실패하면 계속 대기
        }
      });
    });
  }

  async releaseLockWithNotification(
    lockKey: string,
    lockValue: string
  ): Promise<boolean> {
    const channelKey = `lock:channel:${lockKey}`;
    
    // Lua 스크립트로 원자적 해제 + 알림
    const luaScript = `
      if redis.call("GET", KEYS[1]) == ARGV[1] then
        redis.call("DEL", KEYS[1])
        redis.call("PUBLISH", KEYS[2], "released")
        return 1
      else
        return 0
      end
    `;

    try {
      const result = await this.redis.eval(
        luaScript,
        2,
        lockKey,
        channelKey,
        lockValue
      );
      return result === 1;
    } catch (error) {
      this.logger.error('락 해제 + 알림 실패:', error);
      return false;
    }
  }

  private subscribe(channel: string, callback: (message: string) => void): void {
    this.subscribers.set(channel, callback);
    this.subRedis.subscribe(channel);
    this.subRedis.on('message', (receivedChannel, message) => {
      if (receivedChannel === channel) {
        callback(message);
      }
    });
  }

  private unsubscribe(channel: string): void {
    if (this.subscribers.has(channel)) {
      this.subRedis.unsubscribe(channel);
      this.subscribers.delete(channel);
    }
  }
}
```

#### 고급 패턴: 우선순위 기반 락
```typescript
@Injectable()
export class PriorityPubSubLockService {
  async waitForLockWithPriority(
    lockKey: string,
    priority: number = 5, // 1(높음) ~ 10(낮음)
    timeoutMs: number = 30000
  ): Promise<string | null> {
    const lockValue = `${Date.now()}-${Math.random()}-p${priority}`;
    const queueKey = `lock:queue:${lockKey}`;
    const channelKey = `lock:channel:${lockKey}`;
    
    // 1. 대기열에 등록 (우선순위 기반)
    await this.redis.zadd(queueKey, priority, lockValue);
    
    // 2. 현재 내 순서 확인
    const myRank = await this.redis.zrank(queueKey, lockValue);
    
    if (myRank === 0) {
      // 내가 첫 번째면 락 획득 시도
      const acquired = await this.tryAcquireLock(lockKey, lockValue, timeoutMs);
      if (acquired) {
        await this.redis.zrem(queueKey, lockValue); // 대기열에서 제거
        return lockValue;
      }
    }
    
    // 3. 대기 중인 동안 알림 구독
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.redis.zrem(queueKey, lockValue); // 대기열에서 제거
        this.unsubscribe(channelKey);
        resolve(null);
      }, timeoutMs);

      this.subscribe(channelKey, async (message) => {
        if (message === 'released') {
          // 내 차례인지 확인
          const currentRank = await this.redis.zrank(queueKey, lockValue);
          
          if (currentRank === 0) {
            const acquired = await this.tryAcquireLock(lockKey, lockValue, timeoutMs);
            
            if (acquired) {
              clearTimeout(timeout);
              await this.redis.zrem(queueKey, lockValue);
              this.unsubscribe(channelKey);
              resolve(lockValue);
            }
          }
        }
      });
    });
  }

  private async tryAcquireLock(
    lockKey: string,
    lockValue: string,
    ttlMs: number
  ): Promise<boolean> {
    const result = await this.redis.set(lockKey, lockValue, 'PX', ttlMs, 'NX');
    return result === 'OK';
  }
}
```

#### 실무 활용: 작업 큐 시스템
```typescript
@Injectable()
export class WorkerQueueService {
  constructor(
    private pubSubLockService: RedisPubSubLockService,
  ) {}

  async processJobWithQueue(jobId: string): Promise<void> {
    const lockKey = `job:processing:${jobId}`;
    
    this.logger.log(`작업 대기열에 등록: ${jobId}`);
    
    // Pub/Sub 방식으로 락 대기 (CPU 효율적)
    const lockValue = await this.pubSubLockService.waitForLock(lockKey, 60000);
    
    if (!lockValue) {
      throw new TimeoutException('작업 대기 시간 초과');
    }

    try {
      this.logger.log(`작업 시작: ${jobId}`);
      await this.performJob(jobId);
      this.logger.log(`작업 완료: ${jobId}`);
      
    } finally {
      // 다음 대기자에게 알림과 함께 락 해제
      await this.pubSubLockService.releaseLockWithNotification(lockKey, lockValue);
    }
  }
}
```

---

## Redis와 트랜잭션 순서 보장

### 🔄 분산 트랜잭션의 도전과제

**🏦 은행 송금 시스템 비유**
- A계좌에서 돈 빼기 → B계좌에 돈 넣기
- 둘 다 성공하거나 둘 다 실패해야 함
- 중간에 시스템이 다운되면?

#### 1. Redis를 이용한 2PC (Two-Phase Commit)

```typescript
@Injectable()
export class Redis2PCService {
  constructor(
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async executeDistributedTransaction(
    transactionId: string,
    operations: TransactionOperation[]
  ): Promise<boolean> {
    const prepareKey = `tx:prepare:${transactionId}`;
    const commitKey = `tx:commit:${transactionId}`;
    
    try {
      // Phase 1: Prepare (준비 단계)
      const prepareSuccess = await this.preparePhase(prepareKey, operations);
      
      if (!prepareSuccess) {
        await this.abortTransaction(transactionId);
        return false;
      }
      
      // Phase 2: Commit (커밋 단계)
      const commitSuccess = await this.commitPhase(commitKey, operations);
      
      if (!commitSuccess) {
        await this.abortTransaction(transactionId);
        return false;
      }
      
      // 트랜잭션 완료 처리
      await this.cleanupTransaction(transactionId);
      return true;
      
    } catch (error) {
      this.logger.error(`2PC 트랜잭션 실패: ${transactionId}`, error);
      await this.abortTransaction(transactionId);
      return false;
    }
  }

  private async preparePhase(
    prepareKey: string,
    operations: TransactionOperation[]
  ): Promise<boolean> {
    // 모든 참여자에게 준비 요청
    const preparePromises = operations.map(async (op, index) => {
      const participantKey = `${prepareKey}:participant:${index}`;
      
      try {
        // 각 연산이 실행 가능한지 확인
        const canExecute = await this.validateOperation(op);
        
        if (canExecute) {
          await this.redis.setex(participantKey, 300, 'prepared'); // 5분
          return true;
        }
        return false;
        
      } catch (error) {
        this.logger.error(`Prepare 실패: ${participantKey}`, error);
        return false;
      }
    });

    const results = await Promise.all(preparePromises);
    return results.every(result => result === true);
  }

  private async commitPhase(
    commitKey: string,
    operations: TransactionOperation[]
  ): Promise<boolean> {
    // Redis 트랜잭션으로 원자적 실행
    const multi = this.redis.multi();
    
    operations.forEach((op, index) => {
      switch (op.type) {
        case 'SET':
          multi.set(op.key, op.value);
          break;
        case 'INCR':
          multi.incrby(op.key, op.amount);
          break;
        case 'DECR':
          multi.decrby(op.key, op.amount);
          break;
        // ... 다른 연산들
      }
    });

    try {
      const results = await multi.exec();
      return results !== null && results.every(([error]) => error === null);
    } catch (error) {
      this.logger.error('Commit phase 실패:', error);
      return false;
    }
  }
}
```

#### 2. Redis Streams를 이용한 이벤트 소싱

```typescript
@Injectable()
export class RedisEventSourcingService {
  constructor(
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async processOrderWithEventSourcing(orderData: CreateOrderRequest): Promise<void> {
    const streamKey = `events:order:${orderData.orderId}`;
    const checkpointKey = `checkpoint:order:${orderData.orderId}`;
    
    try {
      // 1. 이벤트 스트림에 이벤트들을 순서대로 추가
      await this.addEvent(streamKey, 'OrderCreated', orderData);
      
      // 2. 잔액 차감 이벤트
      await this.addEvent(streamKey, 'BalanceDeducted', {
        userId: orderData.userId,
        amount: orderData.totalAmount
      });
      
      // 3. 재고 차감 이벤트
      await this.addEvent(streamKey, 'StockDeducted', {
        productId: orderData.productId,
        quantity: orderData.quantity
      });
      
      // 4. 쿠폰 사용 이벤트
      if (orderData.couponId) {
        await this.addEvent(streamKey, 'CouponUsed', {
          userId: orderData.userId,
          couponId: orderData.couponId
        });
      }
      
      // 5. 주문 완료 이벤트
      await this.addEvent(streamKey, 'OrderCompleted', {
        orderId: orderData.orderId,
        completedAt: new Date()
      });
      
      // 6. 체크포인트 설정 (처리 완료 지점)
      await this.redis.set(checkpointKey, 'completed');
      
    } catch (error) {
      // 실패 시 보상 이벤트 추가
      await this.addEvent(streamKey, 'OrderFailed', {
        orderId: orderData.orderId,
        error: error.message,
        failedAt: new Date()
      });
      
      // 보상 트랜잭션 실행
      await this.executeCompensation(streamKey);
      throw error;
    }
  }

  private async addEvent(
    streamKey: string,
    eventType: string,
    eventData: any
  ): Promise<string> {
    const eventId = await this.redis.xadd(
      streamKey,
      '*', // 자동 ID 생성
      'type', eventType,
      'data', JSON.stringify(eventData),
      'timestamp', Date.now()
    );
    
    this.logger.debug(`이벤트 추가: ${streamKey} - ${eventType} - ${eventId}`);
    return eventId;
  }

  async replayEvents(streamKey: string, fromId: string = '0'): Promise<void> {
    // 특정 지점부터 이벤트 재생
    const events = await this.redis.xrange(streamKey, fromId, '+');
    
    for (const [eventId, fields] of events) {
      const eventType = fields[fields.indexOf('type') + 1];
      const eventData = JSON.parse(fields[fields.indexOf('data') + 1]);
      
      // 이벤트 타입별 처리
      await this.processEvent(eventType, eventData);
    }
  }
}
```

#### 3. Saga 패턴 with Redis

```typescript
@Injectable()
export class RedisSagaService {
  constructor(
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async executeOrderSaga(orderData: CreateOrderRequest): Promise<void> {
    const sagaId = `saga:order:${orderData.orderId}`;
    const sagaState = new Map<string, any>();
    
    try {
      // Saga 시작
      await this.setSagaState(sagaId, 'status', 'started');
      
      // Step 1: 잔액 예약
      const balanceReserved = await this.reserveBalance(orderData);
      sagaState.set('balanceReserved', balanceReserved);
      await this.setSagaState(sagaId, 'balanceReserved', balanceReserved);
      
      // Step 2: 재고 예약
      const stockReserved = await this.reserveStock(orderData);
      sagaState.set('stockReserved', stockReserved);
      await this.setSagaState(sagaId, 'stockReserved', stockReserved);
      
      // Step 3: 쿠폰 사용
      if (orderData.couponId) {
        const couponUsed = await this.useCoupon(orderData);
        sagaState.set('couponUsed', couponUsed);
        await this.setSagaState(sagaId, 'couponUsed', couponUsed);
      }
      
      // Step 4: 주문 확정
      await this.confirmOrder(orderData);
      await this.setSagaState(sagaId, 'status', 'completed');
      
    } catch (error) {
      // 보상 트랜잭션 실행 (역순으로)
      await this.setSagaState(sagaId, 'status', 'compensating');
      await this.executeCompensation(sagaId, sagaState);
      await this.setSagaState(sagaId, 'status', 'failed');
      throw error;
    }
  }

  private async executeCompensation(
    sagaId: string,
    sagaState: Map<string, any>
  ): Promise<void> {
    // 역순으로 보상 실행
    if (sagaState.get('couponUsed')) {
      await this.compensateUseCoupon(sagaState.get('couponUsed'));
    }
    
    if (sagaState.get('stockReserved')) {
      await this.compensateReserveStock(sagaState.get('stockReserved'));
    }
    
    if (sagaState.get('balanceReserved')) {
      await this.compensateReserveBalance(sagaState.get('balanceReserved'));
    }
  }

  private async setSagaState(sagaId: string, key: string, value: any): Promise<void> {
    await this.redis.hset(sagaId, key, JSON.stringify(value));
    await this.redis.expire(sagaId, 3600); // 1시간 TTL
  }
}
```

---

## 실무 적용 가이드

### 🎯 패턴 선택 가이드

#### 상황별 최적 패턴
| 상황 | 권장 패턴 | 이유 |
|------|----------|------|
| 단일 서버 환경 | Redis Simple Lock | 오버헤드 최소, 구현 간단 |
| 마이크로서비스 환경 | Redis Distributed Lock | 서버 간 동기화 필요 |
| 매우 짧은 작업 (< 100ms) | Redis Spin Lock | 즉시 응답, 낮은 지연시간 |
| 긴 작업 대기 | Redis Pub/Sub Lock | CPU 효율적, 즉시 알림 |
| 분산 트랜잭션 | Redis Streams + Saga | 복잡한 비즈니스 로직 |

#### 현재 e-커머스 프로젝트 적용 방안

**1. 쿠폰 발급 시스템**
```typescript
// 현재: 낙관적 락만 사용
// 개선: Redis Distributed Lock + Pub/Sub 조합

@Injectable()
export class EnhancedCouponService {
  async issueLimitedCoupon(couponId: number, userId: number): Promise<boolean> {
    const lockKey = `coupon:issue:${couponId}`;
    
    // 높은 동시성: Distributed Lock
    const lockValue = await this.distributedLockService.acquireLock(lockKey);
    
    if (!lockValue) {
      // 대기열 방식으로 순서 보장
      return await this.pubSubLockService.waitForLock(lockKey, 30000);
    }
    
    try {
      return await this.processCouponIssuance(couponId, userId);
    } finally {
      await this.distributedLockService.releaseLockWithNotification(lockKey, lockValue);
    }
  }
}
```

**2. 주문 처리 시스템**
```typescript
// 현재: 단순 트랜잭션
// 개선: Saga 패턴으로 신뢰성 향상

@Injectable()
export class EnhancedOrderService {
  async processOrder(orderData: CreateOrderRequest): Promise<void> {
    // Redis Saga로 분산 트랜잭션 관리
    await this.sagaService.executeOrderSaga(orderData);
  }
}
```

### 📊 성능 비교 및 모니터링

#### 패턴별 성능 특성
```typescript
@Injectable()
export class LockPerformanceMonitor {
  async benchmarkLockPatterns(): Promise<PerformanceBenchmark> {
    const results = {
      simpleLock: await this.benchmarkSimpleLock(),
      distributedLock: await this.benchmarkDistributedLock(),
      spinLock: await this.benchmarkSpinLock(),
      pubSubLock: await this.benchmarkPubSubLock(),
    };
    
    return {
      throughput: {
        simpleLock: results.simpleLock.opsPerSecond,      // ~10,000 ops/sec
        distributedLock: results.distributedLock.opsPerSecond, // ~2,000 ops/sec
        spinLock: results.spinLock.opsPerSecond,          // ~15,000 ops/sec
        pubSubLock: results.pubSubLock.opsPerSecond,      // ~5,000 ops/sec
      },
      latency: {
        simpleLock: results.simpleLock.avgLatencyMs,      // ~1ms
        distributedLock: results.distributedLock.avgLatencyMs, // ~5ms
        spinLock: results.spinLock.avgLatencyMs,          // ~0.5ms
        pubSubLock: results.pubSubLock.avgLatencyMs,      // ~3ms
      },
      cpuUsage: {
        simpleLock: 'Low',
        distributedLock: 'Medium',
        spinLock: 'High',
        pubSubLock: 'Low',
      }
    };
  }
}
```

### 🚨 장애 상황 대응

#### 1. Redis 서버 장애
```typescript
@Injectable()
export class FallbackLockService {
  async lockWithFallback(lockKey: string): Promise<string | null> {
    try {
      // 1차: Redis Distributed Lock
      return await this.redisDistributedLock.acquire(lockKey);
    } catch (RedisConnectionError) {
      this.logger.warn('Redis 연결 실패, 로컬 락으로 대체');
      
      try {
        // 2차: Database Pessimistic Lock
        return await this.databaseLock.acquire(lockKey);
      } catch (DatabaseError) {
        this.logger.error('모든 락 방식 실패');
        
        // 3차: 메모리 기반 락 (단일 인스턴스만)
        return await this.memoryLock.acquire(lockKey);
      }
    }
  }
}
```

#### 2. 네트워크 분할 상황
```typescript
@Injectable()
export class NetworkPartitionHandler {
  async handlePartition(lockKey: string): Promise<void> {
    // Redlock 알고리즘으로 과반수 노드 확인
    const redlockResult = await this.redlockService.acquireRedlock(lockKey);
    
    if (!redlockResult.success) {
      // 과반수 획득 실패 시 안전 모드
      await this.enterSafeMode(lockKey);
    }
  }
  
  private async enterSafeMode(lockKey: string): Promise<void> {
    // 읽기 전용 모드 또는 작업 지연
    this.logger.warn(`네트워크 분할 감지, 안전 모드 진입: ${lockKey}`);
    await this.queueService.delayOperation(lockKey, 30000); // 30초 지연
  }
}
```

### 📈 최적화 팁

#### 1. 배치 락 획득
```typescript
async acquireMultipleLocks(lockKeys: string[]): Promise<Map<string, string>> {
  // 파이프라인으로 한 번에 여러 락 시도
  const pipeline = this.redis.pipeline();
  const lockValues = new Map<string, string>();
  
  for (const key of lockKeys) {
    const value = `${Date.now()}-${Math.random()}`;
    lockValues.set(key, value);
    pipeline.set(key, value, 'PX', 10000, 'NX');
  }
  
  const results = await pipeline.exec();
  const acquiredLocks = new Map<string, string>();
  
  results.forEach((result, index) => {
    if (result[1] === 'OK') {
      const key = lockKeys[index];
      acquiredLocks.set(key, lockValues.get(key)!);
    }
  });
  
  return acquiredLocks;
}
```

#### 2. 락 풀링
```typescript
@Injectable()
export class LockPoolService {
  private lockPool = new Map<string, RedisLock>();
  
  async getPooledLock(lockKey: string): Promise<RedisLock> {
    if (!this.lockPool.has(lockKey)) {
      const lock = new RedisLock(lockKey, this.redis);
      this.lockPool.set(lockKey, lock);
    }
    
    return this.lockPool.get(lockKey)!;
  }
}
```

이 가이드를 통해 Redis 기반의 다양한 락 패턴을 이해하고, 상황에 맞는 최적의 패턴을 선택하여 안정적인 분산 시스템을 구축하시기 바랍니다! 🚀