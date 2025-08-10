import { Injectable } from '@nestjs/common';
import { Repository, In } from 'typeorm';
import { ProductEntity } from './product.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { IProductRepository } from './product.repository.interface';

@Injectable()
export class ProductRepository implements IProductRepository {
  constructor(
    @InjectRepository(ProductEntity)
    private readonly productRepository: Repository<ProductEntity>,
  ) {}

  async findProducts(page: number, limit: number): Promise<[ProductEntity[], number]> {
    const skip = (page - 1) * limit;

    return await this.productRepository.findAndCount({
      relations: {
        productOptions: true,
      },
      skip,
      take: limit,
      order: {
        id: 'DESC',
      },
    });
  }

  async findByIdWithOptions(id: number): Promise<ProductEntity | null> {
    return this.productRepository.findOne({
      where: { id },
      relations: {
        productOptions: true,
      },
      order: {
        productOptions: {
          id: 'ASC',
        },
      },
    });
  }

  async findByProductOptionIds(productOptionIds: number[]): Promise<ProductEntity[]> {
    return this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.productOptions', 'productOption')
      .where('productOption.id IN (:...productOptionIds)', { productOptionIds })
      .orderBy('product.id', 'ASC')
      .addOrderBy('productOption.id', 'ASC')
      .getMany();
  }

  async saveProduct(product: Partial<ProductEntity>): Promise<ProductEntity> {
    return this.productRepository.save(product);
  }
}
