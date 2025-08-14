import { Injectable } from '@nestjs/common';
import { Repository, In } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { ProductOptionEntity } from './product-option.entity';
import { IProductOptionRepository } from './product-option.repository.interface';

@Injectable()
export class ProductOptionRepository implements IProductOptionRepository {
  constructor(
    @InjectRepository(ProductOptionEntity)
    private readonly productOptionRepository: Repository<ProductOptionEntity>,
  ) {}

  async saveMultipleStock(productOptions: ProductOptionEntity[]): Promise<void> {
    await this.productOptionRepository.save(productOptions);
  }

  async findByIds(ids: number[]): Promise<ProductOptionEntity[]> {
    return this.productOptionRepository.find({
      where: { id: In(ids) },
    });
  }

  async findById(id: number): Promise<ProductOptionEntity | null> {
    return this.productOptionRepository.findOne({
      where: { id },
      relations: ['product'],
    });
  }

  async saveProductOption(productOption: Partial<ProductOptionEntity>): Promise<ProductOptionEntity> {
    return this.productOptionRepository.save(productOption);
  }

  async deductStockWithPessimisticLock(productOptionId: number, quantity: number): Promise<ProductOptionEntity> {
    // 비관적 락으로 엔티티 조회
    const productOption = await this.productOptionRepository
      .createQueryBuilder('productOption')
      .where('productOption.id = :id', { id: productOptionId })
      .setLock('pessimistic_write')
      .getOne();

    if (!productOption) {
      throw new Error(`ProductOption not found: ${productOptionId}`);
    }

    // 재고 차감
    productOption.stock = productOption.stock - quantity;
    return await this.productOptionRepository.save(productOption);
  }

  async deductMultipleStockWithPessimisticLock(
    items: { productOptionId: number; quantity: number }[],
  ): Promise<ProductOptionEntity[]> {
    const updatedOptions: ProductOptionEntity[] = [];

    // 순차적으로 락 획득 및 재고 차감 (데드락 방지)
    for (const item of items) {
      const updatedOption = await this.deductStockWithPessimisticLock(item.productOptionId, item.quantity);
      updatedOptions.push(updatedOption);
    }

    return updatedOptions;
  }
}
