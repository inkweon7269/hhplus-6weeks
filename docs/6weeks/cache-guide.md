# 캐시(Cache) 종합 가이드

## 목차
1. [캐시 개념과 아키텍처](#캐시-개념과-아키텍처)
2. [메모리 캐시 vs 외부 캐시](#메모리-캐시-vs-외부-캐시)
3. [Expiration vs Eviction](#expiration-vs-eviction)
4. [캐시 패턴](#캐시-패턴)
5. [NestJS 캐시 구현](#nestjs-캐시-구현)
6. [Redis 분산락과 캐시 통합 전략](#redis-분산락과-캐시-통합-전략)
7. [현재 프로젝트 적용 전략](#현재-프로젝트-적용-전략)

---

## 캐시 개념과 아키텍처

### 캐시란?
캐시는 **자주 사용되는 데이터를 빠르게 접근할 수 있는 임시 저장소**입니다. 원본 데이터보다 빠른 액세스 속도를 제공하여 시스템 전체 성능을 향상시킵니다.

### 캐시의 핵심 원리
- **지역성 원리(Locality of Reference)**: 최근 사용된 데이터가 다시 사용될 가능성이 높음
- **시간적 지역성**: 최근 접근한 데이터에 다시 접근할 가능성
- **공간적 지역성**: 접근한 데이터 근처의 데이터에 접근할 가능성

### 캐시 계층 구조

```
Application Layer
      ↓
┌─────────────────────────────────┐
│ L1 Cache (In-Memory/Local)      │  ← 가장 빠름, 작은 용량
│  - Node.js Map/Object           │
│  - Application Memory           │
└─────────────────────────────────┘
      ↓
┌─────────────────────────────────┐
│ L2 Cache (External/Distributed) │  ← 중간 속도, 중간 용량
│  - Redis                        │
│  - Memcached                    │
└─────────────────────────────────┘
      ↓
┌─────────────────────────────────┐
│ L3 Cache (Database)             │  ← 상대적으로 느림, 큰 용량
│  - Database Query Cache         │
│  - Connection Pool              │
└─────────────────────────────────┘
      ↓
Original Data Source (Database/API)
```

---

## 메모리 캐시 vs 외부 캐시

### 메모리 캐시 (In-Memory Cache)

**특징:**
- 애플리케이션 프로세스 내부 메모리에 저장
- 네트워크 통신 없이 직접 메모리 접근
- 프로세스와 생명주기를 함께 함

**장점:**
- **극도로 빠른 속도**: 네트워크 I/O 없음 (~1-10μs)
- **지연시간 최소화**: 메모리 직접 접근
- **네트워크 의존성 없음**: 네트워크 장애에 영향받지 않음
- **구현 간단**: Map, Object 등 간단한 자료구조 사용

**단점:**
- **제한된 메모리 용량**: 애플리케이션 힙 메모리 제약
- **데이터 휘발성**: 프로세스 재시작 시 모든 데이터 손실
- **확장성 부족**: 단일 인스턴스에 국한
- **데이터 일관성 문제**: 멀티 인스턴스 환경에서 동기화 어려움

**사용 시나리오:**
```typescript
// 적합한 경우
- 설정 정보, 상수 데이터
- 자주 조회되는 소량 데이터 (< 100MB)
- 단일 인스턴스 환경
- 실시간 응답이 중요한 경우

// 부적합한 경우  
- 대용량 데이터 (> 1GB)
- 멀티 인스턴스 환경
- 데이터 일관성이 중요한 경우
```

### 외부 캐시 (External Cache)

**특징:**
- 별도 서버/프로세스에서 운영 (Redis, Memcached)
- 네트워크를 통한 데이터 접근
- 여러 애플리케이션 인스턴스가 공유

**장점:**
- **대용량 처리**: 메모리 제약이 적음 (수 GB~TB)
- **데이터 지속성**: Redis의 경우 디스크 백업 지원
- **수평 확장**: 클러스터링을 통한 확장성
- **데이터 공유**: 여러 인스턴스 간 데이터 공유
- **고급 기능**: TTL, 다양한 자료구조, pub/sub 등

**단점:**
- **네트워크 지연**: 네트워크 I/O로 인한 지연 (~0.1-1ms)
- **네트워크 의존성**: 네트워크 장애 시 캐시 불가용
- **운영 복잡성**: 별도 서버 관리 필요
- **비용 증가**: 추가 인프라 비용

**사용 시나리오:**
```typescript
// 적합한 경우
- 대용량 데이터 캐싱 (> 100MB)
- 멀티 인스턴스 환경
- 데이터 공유가 필요한 경우
- 복잡한 캐시 정책이 필요한 경우

// 부적합한 경우
- 극도로 빠른 응답이 필요한 경우 (< 1μs)
- 소량 데이터 (< 10MB)
- 단순한 캐시 로직
```

### 성능 비교

| 구분 | 메모리 캐시 | 외부 캐시 (Redis) |
|------|-------------|-------------------|
| **응답 시간** | 1-10μs | 0.1-1ms |
| **처리량** | 매우 높음 | 높음 |
| **메모리 용량** | 제한적 (힙 크기) | 대용량 가능 |
| **확장성** | 수직 확장만 | 수평+수직 확장 |
| **일관성** | 인스턴스별 독립 | 전역 일관성 |
| **가용성** | 프로세스 의존 | 고가용성 구성 가능 |

---

## Expiration vs Eviction

### Expiration (만료)

**정의:** 시간 기반으로 캐시 데이터를 자동 제거하는 메커니즘

**동작 방식:**
- **TTL(Time To Live)** 설정으로 수명 관리
- 설정된 시간 후 자동 삭제
- 시간 기반의 예측 가능한 제거

**구현 예제:**
```typescript
// Redis TTL 설정
await redis.setex('user:123', 3600, JSON.stringify(userData)); // 1시간 후 만료

// Node.js 메모리 캐시 TTL
const cache = new Map();
const ttlMap = new Map();

function setWithTTL(key: string, value: any, ttlMs: number) {
  cache.set(key, value);
  ttlMap.set(key, Date.now() + ttlMs);
  
  setTimeout(() => {
    cache.delete(key);
    ttlMap.delete(key);
  }, ttlMs);
}
```

**Expiration 유형:**
- **Absolute Expiration**: 특정 시점에 만료 (예: 매일 자정)
- **Sliding Expiration**: 마지막 접근 후 일정 시간 후 만료
- **Refresh Ahead**: 만료 전 미리 갱신

**사용 시나리오:**
```typescript
// 적합한 경우
- 시간에 민감한 데이터 (주가, 환율)
- 정기적으로 갱신되는 데이터
- 데이터 일관성이 중요한 경우

// 설정 예시
'user:profile:123': 1시간 TTL        // 사용자 프로필
'product:price:456': 10분 TTL        // 상품 가격
'daily:stats:2024-01-01': 24시간 TTL // 일별 통계
```

### Eviction (축출)

**정의:** 메모리 공간 부족 시 정책에 따라 캐시 데이터를 제거하는 메커니즘

**동작 방식:**
- **메모리 압박** 상황에서 발생
- **사전 정의된 정책**에 따라 제거 대상 선정
- 공간 확보를 위한 능동적 제거

**주요 Eviction 정책:**

1. **LRU (Least Recently Used)**
   - 가장 오래전에 사용된 데이터 제거
   - 시간적 지역성 활용
   ```typescript
   // Redis LRU 설정
   maxmemory-policy: allkeys-lru
   ```

2. **LFU (Least Frequently Used)**
   - 사용 빈도가 가장 낮은 데이터 제거
   - 접근 패턴 기반
   ```typescript
   // Redis LFU 설정
   maxmemory-policy: allkeys-lfu
   ```

3. **FIFO (First In, First Out)**
   - 가장 먼저 저장된 데이터 제거
   - 단순한 구현
   ```typescript
   class FIFOCache {
     private queue: string[] = [];
     private cache = new Map();
     
     set(key: string, value: any) {
       if (this.cache.size >= this.maxSize) {
         const oldest = this.queue.shift();
         this.cache.delete(oldest);
       }
       this.queue.push(key);
       this.cache.set(key, value);
     }
   }
   ```

4. **Random**
   - 무작위로 데이터 제거
   - 구현 간단, 예측 불가능

**Redis Eviction 정책:**
```typescript
// Redis 메모리 정책 설정
maxmemory: 2gb
maxmemory-policy: allkeys-lru

// 정책 종류
'noeviction':    // 메모리 가득 시 에러 반환
'allkeys-lru':   // 모든 키에서 LRU 적용
'volatile-lru':  // TTL이 있는 키만 LRU 적용
'allkeys-lfu':   // 모든 키에서 LFU 적용
'volatile-lfu':  // TTL이 있는 키만 LFU 적용
'allkeys-random': // 모든 키에서 랜덤 제거
'volatile-random': // TTL이 있는 키만 랜덤 제거
'volatile-ttl':  // TTL이 짧은 키부터 제거
```

**사용 시나리오:**
```typescript
// Eviction이 필요한 경우
- 메모리 제한이 있는 환경
- 캐시 히트율 최적화가 필요한 경우  
- 예측하기 어려운 데이터 접근 패턴

// 정책별 적합한 시나리오
LRU: 시간적 지역성이 강한 데이터 (사용자 세션, 최근 조회 상품)
LFU: 인기도 기반 데이터 (인기 상품, 트렌드 콘텐츠)
FIFO: 단순한 순차 처리 (로그 데이터, 이벤트 스트림)
Random: 균등한 접근 패턴 (A/B 테스트 데이터)
```

### Expiration과 Eviction의 조합

**실제 프로덕션 환경**에서는 두 메커니즘을 함께 사용:

```typescript
// Redis 설정 예시
maxmemory: 4gb
maxmemory-policy: allkeys-lru  // Eviction 정책
default-ttl: 3600              // 기본 Expiration

// 데이터별 차별화 전략
await redis.setex('hot:product:123', 300, data);    // 5분 TTL (자주 변경)
await redis.setex('user:profile:456', 3600, data);  // 1시간 TTL (가끔 변경)
await redis.setex('config:system', 86400, data);    // 24시간 TTL (거의 불변)

// LRU에 의해 추가적인 Eviction 가능
```

---

## 캐시 패턴

### 1. Cache-Aside (Lazy Loading)
```typescript
async getUserById(id: number): Promise<User> {
  const cacheKey = `user:${id}`;
  
  // 1. 캐시에서 조회
  let user = await redis.get(cacheKey);
  if (user) {
    return JSON.parse(user);
  }
  
  // 2. 캐시 미스 시 DB 조회
  user = await this.userRepository.findById(id);
  
  // 3. 캐시에 저장
  await redis.setex(cacheKey, 3600, JSON.stringify(user));
  
  return user;
}
```

### 2. Write-Through
```typescript
async updateUser(id: number, userData: Partial<User>): Promise<User> {
  // 1. DB 업데이트
  const user = await this.userRepository.update(id, userData);
  
  // 2. 캐시 동시 업데이트
  const cacheKey = `user:${id}`;
  await redis.setex(cacheKey, 3600, JSON.stringify(user));
  
  return user;
}
```

### 3. Write-Behind (Write-Back)
```typescript
class WriteBehindCache {
  private writeBuffer = new Map();
  
  async updateUser(id: number, userData: Partial<User>) {
    const cacheKey = `user:${id}`;
    
    // 1. 캐시만 먼저 업데이트
    await redis.setex(cacheKey, 3600, JSON.stringify(userData));
    
    // 2. 나중에 DB 업데이트를 위해 버퍼에 저장
    this.writeBuffer.set(id, userData);
    
    // 3. 배치로 DB 업데이트 (별도 프로세스)
    this.scheduleWrite(id);
  }
}
```

---

## NestJS 캐시 구현

### 1. 기본 설정

```typescript
// app.module.ts
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';

@Module({
  imports: [
    CacheModule.registerAsync({
      useFactory: async () => ({
        store: await redisStore({
          socket: {
            host: 'localhost',
            port: 6379,
          },
          ttl: 60 * 1000, // 60초
        }),
      }),
    }),
  ],
})
export class AppModule {}
```

### 2. 서비스에서 캐시 사용

```typescript
// user.service.ts
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class UserService {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private userRepository: UserRepository,
  ) {}

  async getUserById(id: number): Promise<User> {
    const cacheKey = `user:${id}`;
    
    // 캐시 조회
    let user = await this.cacheManager.get<User>(cacheKey);
    if (user) {
      return user;
    }
    
    // DB 조회 및 캐시 저장
    user = await this.userRepository.findById(id);
    await this.cacheManager.set(cacheKey, user, 3600 * 1000); // 1시간
    
    return user;
  }

  async updateUser(id: number, userData: Partial<User>): Promise<User> {
    const user = await this.userRepository.update(id, userData);
    
    // 캐시 무효화
    await this.cacheManager.del(`user:${id}`);
    
    return user;
  }
}
```

### 3. 데코레이터를 활용한 캐시

```typescript
// cache.decorator.ts
export function Cacheable(ttl: number = 3600) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const cacheKey = `${target.constructor.name}:${propertyName}:${JSON.stringify(args)}`;
      const cacheManager = this.cacheManager;
      
      // 캐시 조회
      let result = await cacheManager.get(cacheKey);
      if (result) {
        return result;
      }
      
      // 원본 메소드 실행
      result = await method.apply(this, args);
      
      // 캐시 저장
      await cacheManager.set(cacheKey, result, ttl * 1000);
      
      return result;
    };
  };
}

// 사용 예시
@Injectable()
export class ProductService {
  @Cacheable(1800) // 30분
  async getPopularProducts(): Promise<Product[]> {
    return this.productRepository.findPopularProducts();
  }
}
```

---

## 현재 프로젝트 적용 전략

### 분석된 현재 상태
- Redis 분산락 시스템은 구현됨
- 캐시 시스템은 미구현 상태
- 이미 Redis 인프라 존재

### 1. 상품(Product) 캐시 전략

```typescript
// product.service.ts
@Injectable()
export class ProductService {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private productRepository: IProductRepository,
  ) {}

  async getProductById(id: number): Promise<Product> {
    const cacheKey = `product:${id}`;
    
    let product = await this.cacheManager.get<Product>(cacheKey);
    if (product) return product;
    
    product = await this.productRepository.findById(id);
    // 상품 정보는 자주 변경되지 않으므로 긴 TTL
    await this.cacheManager.set(cacheKey, product, 24 * 3600 * 1000); // 24시간
    
    return product;
  }

  async getPopularProducts(limit: number = 10): Promise<Product[]> {
    const cacheKey = `products:popular:${limit}`;
    
    let products = await this.cacheManager.get<Product[]>(cacheKey);
    if (products) return products;
    
    products = await this.productRepository.findPopularProducts(limit);
    // 인기 상품은 자주 변경될 수 있으므로 짧은 TTL
    await this.cacheManager.set(cacheKey, products, 10 * 60 * 1000); // 10분
    
    return products;
  }
}
```

### 2. 사용자 잔액(Balance) 캐시 전략

```typescript
// balance.service.ts  
@Injectable()
export class BalanceService {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private balanceRepository: IBalanceRepository,
  ) {}

  async getUserBalance(userId: number): Promise<Balance> {
    const cacheKey = `balance:${userId}`;
    
    let balance = await this.cacheManager.get<Balance>(cacheKey);
    if (balance) return balance;
    
    balance = await this.balanceRepository.findByUserId(userId);
    // 잔액은 자주 변경되므로 짧은 TTL
    await this.cacheManager.set(cacheKey, balance, 5 * 60 * 1000); // 5분
    
    return balance;
  }

  async updateBalance(userId: number, amount: number): Promise<Balance> {
    const balance = await this.balanceRepository.updateBalance(userId, amount);
    
    // 잔액 변경 시 캐시 무효화
    await this.cacheManager.del(`balance:${userId}`);
    
    return balance;
  }
}
```

### 3. 쿠폰(Coupon) 캐시 전략

```typescript
// coupon.service.ts
@Injectable() 
export class CouponService {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private couponRepository: ICouponRepository,
  ) {}

  async getAvailableCoupons(userId: number): Promise<UserCoupon[]> {
    const cacheKey = `coupons:user:${userId}`;
    
    let coupons = await this.cacheManager.get<UserCoupon[]>(cacheKey);
    if (coupons) return coupons;
    
    coupons = await this.couponRepository.findAvailableByUserId(userId);
    // 사용 가능한 쿠폰은 비교적 안정적이므로 중간 TTL
    await this.cacheManager.set(cacheKey, coupons, 30 * 60 * 1000); // 30분
    
    return coupons;
  }

  async getCouponInfo(couponId: number): Promise<Coupon> {
    const cacheKey = `coupon:info:${couponId}`;
    
    let coupon = await this.cacheManager.get<Coupon>(cacheKey);
    if (coupon) return coupon;
    
    coupon = await this.couponRepository.findById(couponId);
    // 쿠폰 기본 정보는 거의 변경되지 않으므로 긴 TTL
    await this.cacheManager.set(cacheKey, coupon, 12 * 3600 * 1000); // 12시간
    
    return coupon;
  }
}
```

### 4. 주문 통계 캐시 전략

```typescript
// order.service.ts
@Injectable()
export class OrderService {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private orderRepository: IOrderRepository,
  ) {}

  async getDailyOrderStats(date: string): Promise<OrderStats> {
    const cacheKey = `stats:daily:${date}`;
    
    let stats = await this.cacheManager.get<OrderStats>(cacheKey);
    if (stats) return stats;
    
    stats = await this.orderRepository.getDailyStats(date);
    
    const now = new Date();
    const targetDate = new Date(date);
    const isToday = now.toDateString() === targetDate.toDateString();
    
    // 오늘 데이터는 짧은 TTL, 과거 데이터는 긴 TTL
    const ttl = isToday ? 5 * 60 * 1000 : 24 * 3600 * 1000;
    await this.cacheManager.set(cacheKey, stats, ttl);
    
    return stats;
  }
}
```

### 5. 캐시 모듈 설정

```typescript
// cache.module.ts
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';

@Global()
@Module({
  imports: [
    CacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        store: await redisStore({
          socket: {
            host: configService.get('REDIS_HOST', 'localhost'),
            port: configService.get('REDIS_PORT', 6380),
            password: configService.get('REDIS_PASSWORD'),
          },
          db: 1, // 분산락(db:0)과 다른 DB 사용
          ttl: 60 * 1000, // 기본 1분
          max: 10000, // 최대 캐시 항목 수
        }),
      }),
    }),
  ],
  exports: [CacheModule],
})
export class CustomCacheModule {}
```

### 6. 캐시 키 설계 원칙

```typescript
// cache-key.constants.ts
export const CACHE_KEYS = {
  // 엔티티별 패턴
  USER: (id: number) => `user:${id}`,
  PRODUCT: (id: number) => `product:${id}`,
  BALANCE: (userId: number) => `balance:${userId}`,
  
  // 컬렉션 패턴  
  POPULAR_PRODUCTS: (limit: number) => `products:popular:${limit}`,
  USER_COUPONS: (userId: number) => `coupons:user:${userId}`,
  
  // 통계 패턴
  DAILY_STATS: (date: string) => `stats:daily:${date}`,
  HOURLY_STATS: (datetime: string) => `stats:hourly:${datetime}`,
  
  // 세션 패턴
  USER_SESSION: (sessionId: string) => `session:${sessionId}`,
} as const;

// 캐시 TTL 상수
export const CACHE_TTL = {
  SHORT: 5 * 60, // 5분 
  MEDIUM: 30 * 60, // 30분
  LONG: 12 * 3600, // 12시간
  VERY_LONG: 24 * 3600, // 24시간
} as const;
```

### 7. 성능 모니터링

```typescript
// cache.interceptor.ts
@Injectable()
export class CacheInterceptor implements NestInterceptor {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const startTime = Date.now();
    const request = context.switchToHttp().getRequest();
    
    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        // 캐시 히트/미스 로깅
        console.log(`Cache operation: ${request.url} - ${duration}ms`);
      }),
    );
  }
}
```

### 추천 구현 순서
1. **캐시 모듈 설정** - Redis 캐시 매니저 구성
2. **상품 캐시** - 가장 단순하고 효과가 큰 영역  
3. **사용자 잔액 캐시** - 성능 개선 효과 큰 영역
4. **쿠폰 캐시** - 복잡도 중간, 효과 높음
5. **통계 캐시** - 배치성 데이터, 부하 감소 효과
6. **모니터링 도구** - 캐시 효율성 측정

이러한 캐시 전략을 통해 데이터베이스 부하를 30-50% 감소시키고, 응답 시간을 50-80% 단축할 수 있을 것으로 예상됩니다.