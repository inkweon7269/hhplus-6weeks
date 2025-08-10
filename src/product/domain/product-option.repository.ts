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
}
