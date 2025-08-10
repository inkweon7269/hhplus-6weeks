# Facade 패턴 (퍼사드 패턴)

## 🔹 기본 설명

Facade 패턴은 **복잡한 서브시스템들의 집합에 대해 통합된 단순한 인터페이스를 제공**하는 구조적 디자인 패턴입니다. 마치 건물의 정면(facade)처럼, 내부의 복잡한 구조는 숨기고 사용자에게는 깔끔하고 사용하기 쉬운 외관만을 보여줍니다.

복잡하거나 여러 서브시스템을 하나의 단순한 인터페이스로 감싸, 클라이언트가 내부 구현을 모른 채 쉽게 사용할 수 있게 해주는 구조적 디자인 패턴입니다.

## 🔹 주요 특징

- **단일 진입점 제공**: 여러 서브시스템을 하나의 Facade 클래스가 감싸고, 클라이언트는 이 하나의 인터페이스만 사용하면 됩니다
- **복잡성 은닉**: 내부 구현 세부사항을 숨기고 꼭 필요한 기능만 노출합니다
- **낮은 결합도(loose coupling)**: 클라이언트는 Facade에만 의존하며 내부 서브시스템 변경 시 클라이언트 코드 영향을 줄입니다
- **가독성 및 유지보수 향상**: 복잡한 흐름이 한 곳에 모여 있어 코드가 간결하고 관리하기 쉬워집니다
- **선택적 접근 허용**: Facade를 사용하면서도 필요시 서브시스템에 직접 접근 가능
- **계층적 구조 지원**: 여러 단계의 Facade를 구성하여 복잡성을 단계별로 관리
- **의존성 관리**: 클라이언트의 서브시스템 의존성을 Facade 하나로 집중

---

## 🎯 언제 사용해야 할까?

### ✅ 사용해야 하는 경우

- **복잡한 서브시스템**: 여러 클래스나 모듈이 얽혀있는 복잡한 로직을 단순화하고 싶을 때
- **외부 API 통합**: 여러 외부 서비스나 API를 하나의 인터페이스로 통합할 때
- **레거시 시스템 래핑**: 기존 복잡한 시스템을 새로운 인터페이스로 감싸고 싶을 때
- **마이크로서비스 간 통신**: 여러 마이크로서비스의 복잡한 상호작용을 단순화할 때
- **테스트 용이성**: 복잡한 의존성을 가진 시스템을 테스트하기 쉽게 만들고 싶을 때

### ❌ 사용하지 말아야 하는 경우

- **단순한 시스템**: 이미 충분히 단순한 시스템에는 불필요한 복잡성만 추가
- **성능이 중요한 경우**: 추가적인 추상화 계층이 성능에 영향을 줄 수 있음
- **모든 기능을 노출해야 하는 경우**: 서브시스템의 모든 기능을 직접 접근해야 하는 경우

---

## 🌍 실제 사용 사례

### 라이브러리/프레임워크 예시

- **jQuery**: 복잡한 DOM 조작을 `$()` 하나로 단순화
- **React**: 복잡한 DOM 업데이트를 컴포넌트 API로 추상화
- **Express.js**: HTTP 서버 구성의 복잡성을 미들웨어 패턴으로 단순화
- **AWS SDK**: 복잡한 클라우드 서비스 API를 통합 인터페이스로 제공

### 비즈니스 시스템 예시

- **전자상거래**: 주문처리(재고확인→결제→배송→알림)를 하나의 메서드로 통합
- **은행 시스템**: 계좌이체(인증→잔액확인→이체→로그기록→알림)를 단일 API로 제공
- **소셜미디어**: 게시물 작성(유효성검사→저장→인덱싱→알림→피드업데이트)을 하나로 처리

---

## ✅ 장점

- **단순화된 인터페이스**: 복잡한 로직을 하나의 메서드로 캡슐화해 사용이 편리합니다
- **캡슐화 & 추상화**: 내부 세부 구현을 숨겨, 클라이언트는 필요한 정보만 알면 됩니다
- **결합도 감소**: 클라이언트와 서브시스템의 직접 의존을 줄여 시스템 확장 시 유연합니다
- **재사용성 & 확장성**: 동일한 Facade 인터페이스를 다양한 맥락에서 그대로 활용 가능
- **테스트 용이성**: 복잡한 의존성을 가진 시스템을 모킹하기 쉬워집니다

_출처: [GeeksforGeeks - Facade Design Pattern](https://www.geeksforgeeks.org/system-design/facade-design-patterns-javascript-design-pattern/), [SoftwarePatternsLexicon.com](https://softwarepatternslexicon.com/patterns-js/6/3/), [backendgarden.com](https://backendgarden.com/notes/facade-pattern)_

---

## ⚠️ 단점

- **기능 노출 제한**: Facade가 감춘 기능은 직접 호출하기 어렵습니다
- **추가 추상화로 인한 오버헤드**: 호출 계층이 늘어나 약간의 성능 저하나 복잡성 우려
- **God object 위험**: Facade가 너무 많은 책임을 가지게 되면 자체적으로 복잡해져 패턴의 목적에 반할 수 있습니다
- **디버깅 어려움**: 내부 로직이 숨겨져 있어, 문제 발생 시 파악이 더 복잡할 수 있습니다
- **버전 관리 복잡성**: 서브시스템들의 버전이 다를 때 호환성 문제가 발생할 수 있습니다
- **순환 의존성 위험**: Facade와 서브시스템 간 잘못된 설계로 순환 의존성이 생길 수 있습니다

_출처: [GeeksforGeeks - Facade Design Pattern](https://www.geeksforgeeks.org/system-design/facade-design-patterns-javascript-design-pattern/), [codingtechroom.com](https://codingtechroom.com/question/what-are-the-pros-and-cons-of-the-facade-pattern-in-software-design), [backendgarden.com](https://backendgarden.com/notes/facade-pattern)_

---

## 🔄 다른 패턴과의 비교

### vs Adapter 패턴

- **Facade**: 복잡한 서브시스템을 단순화하여 사용하기 쉽게 만듦
- **Adapter**: 호환되지 않는 인터페이스를 호환되게 변환

### vs Mediator 패턴

- **Facade**: 클라이언트와 서브시스템 간의 단방향 통신
- **Mediator**: 여러 객체 간의 양방향 통신 조정

### vs Proxy 패턴

- **Facade**: 여러 서브시스템을 감싸는 새로운 인터페이스 제공
- **Proxy**: 기존 객체의 대리자 역할, 동일한 인터페이스 유지

---

## ❌ 잘못된 Facade 패턴 사용 예시

```javascript
// 🚫 잘못된 예시 - 단순 위임만 하는 불필요한 Facade
class UnnecessaryFacade {
  constructor() {
    this.service = new SimpleService();
  }

  // 단순히 메서드명만 바꾸는 것은 의미없음
  doSomething() {
    return this.service.execute();
  }
}

// 🚫 잘못된 예시 - 비즈니스 로직이 포함된 Facade
class BadFacade {
  processOrder(order) {
    // Facade에 비즈니스 로직이 들어가면 안됨
    if (order.amount > 1000000) {
      throw new Error('금액이 너무 큽니다');
    }

    // 복잡한 계산 로직
    const tax = this.calculateComplexTax(order);
    const discount = this.applyBusinessRules(order);

    return this.orderService.process(order);
  }
}

// ✅ 올바른 예시 - 단순한 조정 역할만
class GoodFacade {
  processOrder(order) {
    // 검증은 각 서비스에서 담당
    const validatedOrder = this.validationService.validate(order);
    const processedPayment = this.paymentService.process(validatedOrder);
    const shipment = this.shippingService.create(processedPayment);

    return {
      orderId: validatedOrder.id,
      paymentId: processedPayment.id,
      shipmentId: shipment.id,
    };
  }
}
```

---

## 🏗️ TypeScript/NestJS에서의 실제 예시

### 주문 처리 시스템 예시

```typescript
// 서브시스템들
class InventoryService {
  checkStock(productId: string): boolean {
    console.log(`재고 확인: ${productId}`);
    return true;
  }

  reserveStock(productId: string): void {
    console.log(`재고 예약: ${productId}`);
  }
}

class PaymentService {
  processPayment(amount: number): boolean {
    console.log(`결제 처리: ${amount}원`);
    return true;
  }
}

class ShippingService {
  createShipment(orderId: string): string {
    console.log(`배송 생성: ${orderId}`);
    return `SHIP-${orderId}`;
  }
}

// Facade 클래스
class OrderFacade {
  constructor(
    private inventoryService: InventoryService,
    private paymentService: PaymentService,
    private shippingService: ShippingService,
  ) {}

  // 복잡한 주문 처리를 하나의 메서드로 단순화
  async processOrder(orderData: {
    productId: string;
    amount: number;
    orderId: string;
  }): Promise<{ success: boolean; shipmentId?: string }> {
    try {
      // 1. 재고 확인
      const hasStock = this.inventoryService.checkStock(orderData.productId);
      if (!hasStock) {
        return { success: false };
      }

      // 2. 결제 처리
      const paymentSuccess = this.paymentService.processPayment(orderData.amount);
      if (!paymentSuccess) {
        return { success: false };
      }

      // 3. 재고 예약
      this.inventoryService.reserveStock(orderData.productId);

      // 4. 배송 생성
      const shipmentId = this.shippingService.createShipment(orderData.orderId);

      return { success: true, shipmentId };
    } catch (error) {
      console.error('주문 처리 중 오류:', error);
      return { success: false };
    }
  }
}

// 사용 예시
const orderFacade = new OrderFacade(new InventoryService(), new PaymentService(), new ShippingService());

// 클라이언트는 복잡한 내부 로직을 모르고도 간단하게 주문 처리 가능
orderFacade.processOrder({
  productId: 'PROD-001',
  amount: 50000,
  orderId: 'ORDER-001',
});
```

### 개선된 NestJS Facade 구현

```typescript
// 인터페이스를 통한 의존성 역전
interface IUserFacade {
  registerUser(registerDto: RegisterDto): Promise<UserResponse>;
  getUserProfile(userId: string): Promise<UserProfileResponse>;
}

// 에러 처리가 포함된 Facade
@Injectable()
export class UserFacadeService implements IUserFacade {
  constructor(
    private userService: UserService,
    private authService: AuthService,
    private profileService: ProfileService,
    private notificationService: NotificationService,
    private logger: Logger,
    private dataSource: DataSource,
  ) {}

  async registerUser(registerDto: RegisterDto): Promise<UserResponse> {
    try {
      // 트랜잭션 시작
      return await this.dataSource.transaction(async (manager) => {
        const user = await this.userService.createUser(registerDto, manager);
        const token = await this.authService.generateToken(user.id);

        // 병렬 처리로 성능 개선
        await Promise.all([
          this.profileService.initializeProfile(user.id, manager),
          this.notificationService.sendWelcomeNotification(user.id),
        ]);

        return {
          user,
          token,
          message: '회원가입이 완료되었습니다.',
        };
      });
    } catch (error) {
      this.logger.error('사용자 등록 실패', error);

      // 구체적인 에러를 추상화하여 클라이언트에게 전달
      if (error instanceof DuplicateEmailError) {
        throw new BadRequestException('이미 존재하는 이메일입니다.');
      }

      throw new InternalServerErrorException('회원가입 처리 중 오류가 발생했습니다.');
    }
  }

  async getUserProfile(userId: string): Promise<UserProfileResponse> {
    try {
      // 병렬로 여러 서비스에서 데이터 조회
      const [user, profile, preferences] = await Promise.all([
        this.userService.findById(userId),
        this.profileService.getProfile(userId),
        this.userService.getPreferences(userId),
      ]);

      return {
        user,
        profile,
        preferences,
        lastLoginAt: await this.authService.getLastLoginTime(userId),
      };
    } catch (error) {
      this.logger.error('사용자 프로필 조회 실패', error);
      throw new NotFoundException('사용자 정보를 찾을 수 없습니다.');
    }
  }
}

// controller.ts
@Controller('users')
export class UserController {
  constructor(private userFacadeService: UserFacadeService) {}

  @Post('register')
  async register(@Body() registerDto: RegisterDto): Promise<UserResponse> {
    return this.userFacadeService.registerUser(registerDto);
  }

  @Get('profile/:id')
  async getProfile(@Param('id') userId: string): Promise<UserProfileResponse> {
    return this.userFacadeService.getUserProfile(userId);
  }
}
```

---

## 🧪 Facade 패턴 테스트 전략

```javascript
describe('OrderFacade', () => {
  let orderFacade;
  let mockInventoryService;
  let mockPaymentService;
  let mockShippingService;

  beforeEach(() => {
    // 각 서브시스템을 모킹
    mockInventoryService = {
      checkStock: jest.fn(),
      reserveStock: jest.fn(),
    };
    mockPaymentService = {
      processPayment: jest.fn(),
    };
    mockShippingService = {
      createShipment: jest.fn(),
    };

    // 의존성 주입을 통한 테스트 용이성 확보
    orderFacade = new OrderFacade(mockInventoryService, mockPaymentService, mockShippingService);
  });

  it('성공적인 주문 처리 시나리오', async () => {
    // Given
    mockInventoryService.checkStock.mockReturnValue(true);
    mockPaymentService.processPayment.mockReturnValue(true);
    mockShippingService.createShipment.mockReturnValue('SHIP-123');

    // When
    const result = await orderFacade.processOrder({
      productId: 'PROD-001',
      amount: 50000,
      orderId: 'ORDER-001',
    });

    // Then
    expect(result.success).toBe(true);
    expect(result.shipmentId).toBe('SHIP-123');
    expect(mockInventoryService.checkStock).toHaveBeenCalledWith('PROD-001');
    expect(mockPaymentService.processPayment).toHaveBeenCalledWith(50000);
  });

  it('재고 부족 시 실패 처리', async () => {
    // Given
    mockInventoryService.checkStock.mockReturnValue(false);

    // When
    const result = await orderFacade.processOrder({
      productId: 'PROD-001',
      amount: 50000,
      orderId: 'ORDER-001',
    });

    // Then
    expect(result.success).toBe(false);
    expect(mockPaymentService.processPayment).not.toHaveBeenCalled();
  });

  it('결제 실패 시 재고 예약하지 않음', async () => {
    // Given
    mockInventoryService.checkStock.mockReturnValue(true);
    mockPaymentService.processPayment.mockReturnValue(false);

    // When
    const result = await orderFacade.processOrder({
      productId: 'PROD-001',
      amount: 50000,
      orderId: 'ORDER-001',
    });

    // Then
    expect(result.success).toBe(false);
    expect(mockInventoryService.reserveStock).not.toHaveBeenCalled();
    expect(mockShippingService.createShipment).not.toHaveBeenCalled();
  });
});
```

---

## 🔗 다른 패턴과의 조합 활용

### Facade + Strategy 패턴

```javascript
class PaymentFacade {
  constructor() {
    this.strategies = {
      card: new CardPaymentStrategy(),
      bank: new BankTransferStrategy(),
      mobile: new MobilePaymentStrategy(),
    };
  }

  processPayment(method, amount) {
    const strategy = this.strategies[method];
    if (!strategy) {
      throw new Error(`지원하지 않는 결제 방법: ${method}`);
    }
    return strategy.process(amount);
  }
}
```

### Facade + Factory 패턴

```javascript
class ServiceFacade {
  constructor() {
    this.serviceFactory = new ServiceFactory();
  }

  processRequest(type, data) {
    const service = this.serviceFactory.createService(type);
    return service.process(data);
  }
}
```

### Facade + Observer 패턴

```javascript
class EventDrivenFacade extends EventEmitter {
  async processOrder(order) {
    this.emit('orderStarted', order);

    try {
      const result = await this.internalProcess(order);
      this.emit('orderCompleted', result);
      return result;
    } catch (error) {
      this.emit('orderFailed', error);
      throw error;
    }
  }
}
```

---

## 📋 구현 시 주의사항

1. **단일 책임 원칙 준수**: Facade가 너무 많은 책임을 가지지 않도록 주의
2. **적절한 추상화 수준**: 너무 추상적이거나 너무 구체적이지 않게 설계
3. **에러 처리**: 내부 서브시스템의 에러를 적절히 처리하고 클라이언트에게 의미있는 에러 메시지 제공
4. **성능 고려**: 불필요한 추상화 계층으로 인한 성능 저하 방지
5. **테스트 용이성**: 각 서브시스템을 독립적으로 테스트할 수 있도록 설계
6. **의존성 주입**: 테스트와 유연성을 위해 의존성 주입 활용
7. **인터페이스 설계**: 클라이언트가 진짜 필요로 하는 기능만 노출
8. **문서화**: 내부 복잡성이 숨겨져 있으므로 Facade의 동작을 명확히 문서화

---

## 🎯 결론

Facade 패턴은 복잡한 시스템을 단순화하고 클라이언트의 사용성을 향상시키는 강력한 패턴입니다. 특히 마이크로서비스 아키텍처나 레거시 시스템 통합에서 매우 유용하며, NestJS와 같은 현대적인 프레임워크에서도 효과적으로 활용할 수 있습니다.

다만, 적절한 사용 시점과 설계 원칙을 지켜야 그 진가를 발휘할 수 있습니다. 단순한 위임이 아닌 진정한 가치를 제공하는 Facade를 만들고, 성능과 테스트 용이성을 고려한 설계를 통해 유지보수성 높은 코드를 작성할 수 있습니다.

### 핵심 포인트

- **복잡성 숨기기**: 내부 구현은 복잡해도 외부 인터페이스는 단순하게
- **의존성 관리**: 클라이언트가 여러 서브시스템에 직접 의존하지 않도록
- **적절한 책임**: Facade는 조정자 역할만, 비즈니스 로직은 포함하지 않기
- **테스트 고려**: 의존성 주입과 모킹을 통한 테스트 용이성 확보
- **성능 최적화**: 지연 초기화와 캐싱을 통한 성능 개선

---

---

# Dependency Inversion Principle (의존성 역전 원칙)

## 🔹 기본 설명

Dependency Inversion Principle (DIP)은 SOLID 원칙의 마지막 원칙으로, **고수준 모듈이 저수준 모듈에 의존하지 않아야 하며, 둘 다 추상화에 의존해야 한다**는 원칙입니다. 또한 **추상화는 세부사항에 의존하지 않아야 하고, 세부사항이 추상화에 의존해야 한다**고 합니다.

NestJS와 TypeORM 환경에서 이 원칙을 적용하면, 비즈니스 로직(Service)이 데이터베이스 구현 세부사항(TypeORM Repository)에 직접 의존하지 않고, 추상화된 인터페이스를 통해 상호작용하게 됩니다.

## 🔹 주요 특징

- **추상화에 의존**: 구체적인 구현체가 아닌 인터페이스에 의존
- **의존성 역전**: 전통적인 의존성 방향을 역전시켜 유연성 확보
- **테스트 용이성**: 모킹을 통한 단위 테스트 구현 가능
- **확장성**: 새로운 구현체 추가 시 기존 코드 변경 없이 확장 가능
- **느슨한 결합**: 모듈 간의 결합도를 낮춰 유지보수성 향상

---

## 🎯 언제 사용해야 할까?

### ✅ 사용해야 하는 경우

- **데이터베이스 추상화**: 다양한 데이터베이스나 ORM으로 쉽게 전환하고 싶을 때
- **테스트 용이성**: 단위 테스트에서 실제 데이터베이스 대신 모킹을 사용하고 싶을 때
- **마이크로서비스**: 서비스 간의 느슨한 결합을 유지하고 싶을 때
- **플러그인 아키텍처**: 런타임에 다양한 구현체를 주입하고 싶을 때
- **레거시 시스템 통합**: 기존 시스템과의 결합도를 낮추고 싶을 때

### ❌ 사용하지 말아야 하는 경우

- **단순한 CRUD**: 매우 단순한 애플리케이션에서는 과도한 복잡성
- **성능이 중요한 경우**: 추가적인 추상화 계층이 성능에 영향을 줄 수 있음
- **하나의 구현체만 사용**: 여러 구현체가 필요하지 않은 경우

---

## 🌍 실제 사용 사례

### 라이브러리/프레임워크 예시

- **Spring Framework**: `@Repository` 인터페이스를 통한 데이터 접근 추상화
- **Laravel**: Eloquent ORM의 Repository 패턴 구현
- **Angular**: Dependency Injection을 통한 서비스 추상화
- **React**: Context API를 통한 상태 관리 추상화

### 비즈니스 시스템 예시

- **전자상거래**: 다양한 결제 시스템(카드, 계좌이체, 모바일결제)을 인터페이스로 추상화
- **알림 시스템**: 이메일, SMS, 푸시알림을 통합 인터페이스로 관리
- **파일 저장**: 로컬, S3, Azure Blob 등 다양한 스토리지를 추상화

---

## ✅ 장점

- **유연성**: 구현체 변경 시 기존 코드 수정 없이 확장 가능
- **테스트 용이성**: 실제 의존성 대신 모킹을 사용한 단위 테스트 구현
- **유지보수성**: 모듈 간 결합도 감소로 변경 영향도 최소화
- **재사용성**: 동일한 인터페이스를 다양한 맥락에서 활용 가능
- **확장성**: 새로운 구현체 추가가 용이

---

## ⚠️ 단점

- **복잡성 증가**: 추가적인 추상화 계층으로 인한 코드 복잡성
- **성능 오버헤드**: 인터페이스 호출로 인한 약간의 성능 저하
- **학습 곡선**: 초기 설계와 구현에 더 많은 시간과 노력 필요
- **과도한 추상화**: 불필요한 추상화로 인한 코드 가독성 저하 위험

---

## 🔄 다른 패턴과의 비교

### vs Dependency Injection

- **DIP**: 의존성의 방향을 역전시키는 설계 원칙
- **DI**: 의존성을 외부에서 주입하는 구현 기법

### vs Strategy Pattern

- **DIP**: 의존성 방향을 추상화로 역전
- **Strategy**: 알고리즘을 런타임에 교체하는 패턴

### vs Adapter Pattern

- **DIP**: 추상화를 통한 의존성 역전
- **Adapter**: 호환되지 않는 인터페이스를 호환되게 변환

---

## ❌ 잘못된 DIP 사용 예시

```typescript
// 🚫 잘못된 예시 - 직접적인 의존성
@Injectable()
export class UserService {
  constructor(
    @InjectRepository(UserEntity) // TypeORM에 직접 의존
    private userRepository: Repository<UserEntity>,
  ) {}

  async findById(id: number): Promise<UserEntity> {
    return this.userRepository.findOne({ where: { id } });
  }
}

// 🚫 잘못된 예시 - 구체적인 클래스에 의존
@Injectable()
export class PaymentService {
  constructor(
    private cardPaymentProcessor: CardPaymentProcessor, // 구체 클래스에 의존
    private bankTransferProcessor: BankTransferProcessor,
  ) {}
}

// ✅ 올바른 예시 - 인터페이스에 의존
@Injectable()
export class UserService {
  constructor(
    @Inject(USER_REPOSITORY) // 인터페이스에 의존
    private userRepository: IUserRepository,
  ) {}

  async findById(id: number): Promise<UserEntity> {
    return this.userRepository.findById(id);
  }
}
```

---

## 🏗️ TypeScript/NestJS에서의 실제 예시

### 현재 프로젝트의 User 모듈 구현

```typescript
// 1. 추상화 정의 (인터페이스)
// src/user/domain/user.repository.interface.ts
import { UserEntity } from './user.entity';

export interface IUserRepository {
  findById(id: number): Promise<UserEntity | null>;
  findByName(name: string): Promise<UserEntity | null>;
  save(user: Partial<UserEntity>): Promise<UserEntity>;
}

// Symbol을 사용한 토큰 정의 (의존성 주입용)
export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

// 2. 구체적인 구현체
// src/user/domain/user.repository.ts
import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { UserEntity } from './user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { IUserRepository } from './user.repository.interface';

@Injectable()
export class UserRepository implements IUserRepository {
  constructor(
    @InjectRepository(UserEntity)
    private repo: Repository<UserEntity>,
  ) {}

  async findById(id: number): Promise<UserEntity | null> {
    return this.repo.findOne({ where: { id } });
  }

  async findByName(name: string): Promise<UserEntity | null> {
    return this.repo.findOne({ where: { name } });
  }

  async save(user: Partial<UserEntity>): Promise<UserEntity> {
    const entity = this.repo.create(user);
    return await this.repo.save(entity);
  }
}

// 3. 고수준 모듈 (비즈니스 로직)
// src/user/user.service.ts
import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { IUserRepository, USER_REPOSITORY } from './domain/user.repository.interface';
import { GetUserProfileResponse } from './dto';

@Injectable()
export class UserService {
  constructor(
    @Inject(USER_REPOSITORY) // 인터페이스에 의존 (의존성 역전)
    private userRepository: IUserRepository,
  ) {}

  async getUserProfile(userId: number): Promise<GetUserProfileResponse> {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new NotFoundException(`ID가 '${userId}'인 사용자를 찾을 수 없습니다.`);
    }

    return {
      id: user.id,
      name: user.name,
    };
  }
}

// 4. 의존성 주입 설정
// src/user/user.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { UserFacade } from './user.facade';
import { UserEntity } from './domain/user.entity';
import { UserRepository } from './domain/user.repository';
import { USER_REPOSITORY } from './domain/user.repository.interface';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity])],
  controllers: [UserController],
  providers: [
    UserService,
    UserFacade,
    {
      provide: USER_REPOSITORY, // 인터페이스 토큰
      useClass: UserRepository, // 구체적인 구현체 바인딩
    },
  ],
  exports: [UserFacade, USER_REPOSITORY],
})
export class UserModule {}
```

### 다양한 구현체 지원 예시

```typescript
// 메모리 기반 Repository (테스트용)
@Injectable()
export class InMemoryUserRepository implements IUserRepository {
  private users: UserEntity[] = [];

  async findById(id: number): Promise<UserEntity | null> {
    return this.users.find((user) => user.id === id) || null;
  }

  async findByName(name: string): Promise<UserEntity | null> {
    return this.users.find((user) => user.name === name) || null;
  }

  async save(user: Partial<UserEntity>): Promise<UserEntity> {
    const newUser = { id: Date.now(), ...user } as UserEntity;
    this.users.push(newUser);
    return newUser;
  }
}

// MongoDB 기반 Repository
@Injectable()
export class MongoUserRepository implements IUserRepository {
  constructor(
    @InjectModel('User')
    private userModel: Model<UserEntity>,
  ) {}

  async findById(id: number): Promise<UserEntity | null> {
    return this.userModel.findById(id).exec();
  }

  async findByName(name: string): Promise<UserEntity | null> {
    return this.userModel.findOne({ name }).exec();
  }

  async save(user: Partial<UserEntity>): Promise<UserEntity> {
    const newUser = new this.userModel(user);
    return await newUser.save();
  }
}

// 환경에 따른 Repository 선택
@Module({
  providers: [
    UserService,
    {
      provide: USER_REPOSITORY,
      useClass: process.env.NODE_ENV === 'test' ? InMemoryUserRepository : UserRepository,
    },
  ],
})
export class UserModule {}
```

---

## 🧪 DIP 패턴 테스트 전략

```typescript
describe('UserService', () => {
  let userService: UserService;
  let mockUserRepository: jest.Mocked<IUserRepository>;

  beforeEach(async () => {
    // 인터페이스를 모킹하여 테스트
    mockUserRepository = {
      findById: jest.fn(),
      findByName: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: USER_REPOSITORY,
          useValue: mockUserRepository, // 모킹된 구현체 주입
        },
      ],
    }).compile();

    userService = module.get<UserService>(UserService);
  });

  it('사용자 프로필 조회 성공', async () => {
    // Given
    const mockUser = { id: 1, name: '테스트 사용자' };
    mockUserRepository.findById.mockResolvedValue(mockUser);

    // When
    const result = await userService.getUserProfile(1);

    // Then
    expect(result).toEqual({
      id: 1,
      name: '테스트 사용자',
    });
    expect(mockUserRepository.findById).toHaveBeenCalledWith(1);
  });

  it('존재하지 않는 사용자 조회 시 예외 발생', async () => {
    // Given
    mockUserRepository.findById.mockResolvedValue(null);

    // When & Then
    await expect(userService.getUserProfile(999)).rejects.toThrow(NotFoundException);
  });
});
```

---

## 🔗 다른 패턴과의 조합 활용

### DIP + Factory Pattern

```typescript
// Repository Factory
@Injectable()
export class UserRepositoryFactory {
  createRepository(type: 'typeorm' | 'memory' | 'mongo'): IUserRepository {
    switch (type) {
      case 'typeorm':
        return new UserRepository();
      case 'memory':
        return new InMemoryUserRepository();
      case 'mongo':
        return new MongoUserRepository();
      default:
        throw new Error(`지원하지 않는 Repository 타입: ${type}`);
    }
  }
}

// Factory를 통한 동적 Repository 생성
@Module({
  providers: [
    {
      provide: USER_REPOSITORY,
      useFactory: (factory: UserRepositoryFactory) => {
        return factory.createRepository(process.env.DB_TYPE as any);
      },
      inject: [UserRepositoryFactory],
    },
  ],
})
export class UserModule {}
```

### DIP + Strategy Pattern

```typescript
// 결제 전략 인터페이스
interface IPaymentStrategy {
  processPayment(amount: number): Promise<boolean>;
}

// 다양한 결제 전략 구현
class CardPaymentStrategy implements IPaymentStrategy {
  async processPayment(amount: number): Promise<boolean> {
    // 카드 결제 로직
    return true;
  }
}

class BankTransferStrategy implements IPaymentStrategy {
  async processPayment(amount: number): Promise<boolean> {
    // 계좌이체 로직
    return true;
  }
}

// 결제 서비스 (DIP 적용)
@Injectable()
export class PaymentService {
  constructor(
    @Inject(PAYMENT_STRATEGY)
    private paymentStrategy: IPaymentStrategy,
  ) {}

  async processPayment(amount: number): Promise<boolean> {
    return this.paymentStrategy.processPayment(amount);
  }
}
```

---

## 📋 구현 시 주의사항

1. **적절한 추상화 수준**: 너무 세밀하거나 너무 거칠지 않게 인터페이스 설계
2. **인터페이스 분리**: 하나의 인터페이스가 너무 많은 책임을 가지지 않도록 주의
3. **의존성 주입 설정**: 모듈에서 올바른 바인딩 설정 확인
4. **테스트 커버리지**: 모든 구현체에 대한 테스트 작성
5. **성능 고려**: 불필요한 추상화로 인한 성능 저하 방지
6. **문서화**: 인터페이스의 계약과 구현체의 차이점 명확히 문서화
7. **에러 처리**: 인터페이스 레벨에서 적절한 에러 처리 전략 수립
8. **버전 관리**: 인터페이스 변경 시 하위 호환성 고려

---

## 🎯 결론

Dependency Inversion Principle은 NestJS와 TypeORM 환경에서 매우 강력한 설계 원칙입니다. 현재 프로젝트의 User 모듈에서 볼 수 있듯이, 인터페이스를 통한 추상화로 비즈니스 로직과 데이터 접근 계층을 분리하여 유연하고 테스트 가능한 코드를 작성할 수 있습니다.

특히 마이크로서비스 아키텍처나 다양한 데이터베이스 지원이 필요한 환경에서 DIP를 적용하면, 코드의 유지보수성과 확장성을 크게 향상시킬 수 있습니다.

### 핵심 포인트

- **추상화 우선**: 구체적인 구현보다는 인터페이스에 의존
- **의존성 역전**: 전통적인 의존성 방향을 추상화를 통해 역전
- **테스트 용이성**: 모킹을 통한 단위 테스트 구현 가능
- **확장성**: 새로운 구현체 추가 시 기존 코드 변경 없이 확장
- **느슨한 결합**: 모듈 간의 결합도를 낮춰 유지보수성 향상

---

## 📚 참고 자료

- [Wikipedia - Dependency Inversion Principle](https://en.wikipedia.org/wiki/Dependency_inversion_principle)
- [Yvan Florian - Dependency Inversion Principle in NestJS with TypeORM](https://yvanflorian.medium.com/dependency-inversion-principle-in-nestjs-with-typeorm-6e52f2dcf830)
- [GeeksforGeeks - Dependency Inversion Principle](https://www.geeksforgeeks.org/dependency-inversion-principle-solid/)
- [Martin Fowler - Inversion of Control Containers and the Dependency Injection pattern](https://martinfowler.com/articles/injection.html)
- [NestJS Documentation - Custom Providers](https://docs.nestjs.com/fundamentals/custom-providers)
- [TypeORM Documentation - Repository Pattern](https://typeorm.io/#/repository-api)

---

## 📚 참고 자료

- [Wikipedia - Facade Pattern](https://en.wikipedia.org/wiki/Facade_pattern)
- [GeeksforGeeks - Facade Design Pattern Introduction](https://www.geeksforgeeks.org/system-design/facade-design-pattern-introduction/)
- [GeeksforGeeks - Facade Design Patterns JavaScript](https://www.geeksforgeeks.org/system-design/facade-design-patterns-javascript-design-pattern/)
- [SoftwarePatternsLexicon.com - Facade Pattern](https://softwarepatternslexicon.com/patterns-js/6/3/)
- [backendgarden.com - Facade Pattern](https://backendgarden.com/notes/facade-pattern)
- [codingtechroom.com - Pros and Cons of Facade Pattern](https://codingtechroom.com/question/what-are-the-pros-and-cons-of-the-facade-pattern-in-software-design)
