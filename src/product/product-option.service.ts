import { Injectable, BadRequestException, Inject, ConflictException } from '@nestjs/common';
import { IProductOptionRepository, PRODUCT_OPTION_REPOSITORY } from './domain/product-option.repository.interface';
import { RedisLockService } from '../redis/redis-lock.service';

@Injectable()
export class ProductOptionService {
  constructor(
    @Inject(PRODUCT_OPTION_REPOSITORY)
    private readonly productOptionRepository: IProductOptionRepository,
    private readonly redisLockService: RedisLockService,
  ) {}

  async checkMultipleStock(items: { productOptionId: number; quantity: number }[]): Promise<boolean> {
    const productOptions = await this.validateAndGetProductOptions(items);
    this.checkStockAvailability(items, productOptions);
    return true;
  }

  async deductMultipleStock(items: { productOptionId: number; quantity: number }[]): Promise<void> {
    if (items.length === 0) {
      return;
    }

    // ID 순으로 정렬하여 데드락 방지
    const sortedItems = [...items].sort((a, b) => a.productOptionId - b.productOptionId);
    
    // 각 상품 옵션에 대해 Redis lock 적용
    const locks: Array<{ key: string; value: string }> = [];
    
    try {
      // 1. 모든 상품 옵션에 대해 Redis lock 획득
      for (const item of sortedItems) {
        const lockKey = `deduct:stock:${item.productOptionId}`;
        const lockValue = this.redisLockService.generateLockValue('deductStock', undefined, {
          productOptionId: item.productOptionId,
          quantity: item.quantity
        });
        
        const acquired = await this.redisLockService.tryAcquireLock(lockKey, lockValue, {
          ttlSeconds: 10,
          retryAttempts: 3,
          retryDelayMs: 100,
        });

        if (!acquired) {
          throw new ConflictException(
            `상품 옵션 ${item.productOptionId}의 재고 차감이 진행 중입니다. 잠시 후 다시 시도해주세요.`
          );
        }

        locks.push({ key: lockKey, value: lockValue });
      }

      // 2. 비관적 락으로 재고 차감 (Repository에서 검증 없이 바로 차감)
      for (const item of sortedItems) {
        // 사전 검증: 락 없이 빠른 실패를 위한 재고 체크
        const productOption = await this.productOptionRepository.findById(item.productOptionId);
        
        if (!productOption) {
          throw new BadRequestException(`상품 옵션 ID ${item.productOptionId}를 찾을 수 없습니다.`);
        }

        if (productOption.stock < item.quantity) {
          throw new BadRequestException(
            `상품 옵션 '${productOption.name}'의 재고가 부족합니다. (요청: ${item.quantity}, 재고: ${productOption.stock})`
          );
        }

        // 비관적 락으로 원자적 재고 차감
        await this.productOptionRepository.deductStockWithPessimisticLock(item.productOptionId, item.quantity);
      }
    } finally {
      // 3. 모든 Redis lock 해제 (역순으로)
      for (const lock of locks.reverse()) {
        await this.redisLockService.releaseLock(lock.key, lock.value);
      }
    }
  }

  /**
   * 결제용 상품 옵션 정보 조회 및 유효성 검증 (배치 처리)
   * @param productOptionIds 상품 옵션 ID 배열
   * @returns 결제에 필요한 상품 옵션 정보 배열
   */
  async getProductOptionsForPayment(productOptionIds: number[]): Promise<
    Array<{
      id: number;
      name: string;
      price: number;
      stock: number;
      productId: number;
      productName: string;
      isValid: boolean;
      validationMessage?: string;
    }>
  > {
    if (productOptionIds.length === 0) {
      return [];
    }

    // 중복 제거
    const uniqueIds = [...new Set(productOptionIds)];

    // 배치로 상품 옵션 정보 조회
    const productOptions = await this.productOptionRepository.findByIds(uniqueIds);

    if (productOptions.length === 0) {
      throw new BadRequestException(`요청된 상품 옵션들을 찾을 수 없습니다: ${uniqueIds.join(', ')}`);
    }

    const result: Array<{
      id: number;
      name: string;
      price: number;
      stock: number;
      productId: number;
      productName: string;
      isValid: boolean;
      validationMessage?: string;
    }> = [];

    // 각 상품 옵션 ID에 대해 정보 생성
    for (const optionId of productOptionIds) {
      const productOption = productOptions.find((option) => option.id === optionId);

      if (!productOption) {
        throw new BadRequestException(`상품 옵션 ID ${optionId}를 찾을 수 없습니다.`);
      }

      // 상품 옵션 유효성 검증
      const validationResult = this.validateProductOptionForPayment(productOption);

      result.push({
        id: productOption.id,
        name: productOption.name,
        price: productOption.price,
        stock: productOption.stock,
        productId: productOption.product?.id || 0,
        productName: productOption.product?.name || '',
        isValid: validationResult.isValid,
        validationMessage: validationResult.message,
      });
    }

    return result;
  }

  /**
   * 결제용 상품 옵션 정보 조회 및 유효성 검증
   * @param productOptionId 상품 옵션 ID
   * @returns 결제에 필요한 상품 옵션 정보
   */
  async getProductOptionForPayment(productOptionId: number): Promise<{
    id: number;
    name: string;
    price: number;
    stock: number;
    productId: number;
    productName: string;
    isValid: boolean;
    validationMessage?: string;
  }> {
    const productOption = await this.productOptionRepository.findById(productOptionId);

    if (!productOption) {
      throw new BadRequestException(`상품 옵션 ID ${productOptionId}를 찾을 수 없습니다.`);
    }

    // 상품 옵션 유효성 검증
    const validationResult = this.validateProductOptionForPayment(productOption);

    return {
      id: productOption.id,
      name: productOption.name,
      price: productOption.price,
      stock: productOption.stock,
      productId: productOption.product?.id || 0,
      productName: productOption.product?.name || '',
      isValid: validationResult.isValid,
      validationMessage: validationResult.message,
    };
  }

  /**
   * 결제용 상품 옵션 유효성 검증
   * @param productOption 상품 옵션 엔티티
   * @returns 유효성 검증 결과
   */
  private validateProductOptionForPayment(productOption: any): {
    isValid: boolean;
    message?: string;
  } {
    // 1. 상품 옵션이 삭제되지 않았는지 확인
    if (productOption.deletedAt) {
      return {
        isValid: false,
        message: `상품 옵션 '${productOption.name}'이 삭제되었습니다.`,
      };
    }

    // 2. 상품이 삭제되지 않았는지 확인
    if (productOption.product && productOption.product.deletedAt) {
      return {
        isValid: false,
        message: `상품 '${productOption.product.name}'이 삭제되었습니다.`,
      };
    }

    // 3. 가격이 유효한지 확인
    if (productOption.price <= 0) {
      return {
        isValid: false,
        message: `상품 옵션 '${productOption.name}'의 가격이 유효하지 않습니다.`,
      };
    }

    // 4. 재고가 있는지 확인
    if (productOption.stock <= 0) {
      return {
        isValid: false,
        message: `상품 옵션 '${productOption.name}'의 재고가 부족합니다.`,
      };
    }

    return {
      isValid: true,
    };
  }

  private async validateAndGetProductOptions(items: { productOptionId: number; quantity: number }[]) {
    const productOptionIds = items.map((item) => item.productOptionId);
    const productOptions = await this.productOptionRepository.findByIds(productOptionIds);

    if (productOptions.length !== items.length) {
      throw new BadRequestException('존재하지 않는 상품 옵션이 포함되어 있습니다.');
    }

    return productOptions;
  }

  private checkStockAvailability(items: { productOptionId: number; quantity: number }[], productOptions: any[]): void {
    for (const item of items) {
      const productOption = productOptions.find((option) => option.id === item.productOptionId);
      if (productOption.stock < item.quantity) {
        throw new BadRequestException(
          `상품 옵션 ${productOption.name}의 재고가 부족합니다. (요청: ${item.quantity}, 재고: ${productOption.stock})`,
        );
      }
    }
  }
}
