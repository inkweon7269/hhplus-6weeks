import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { BalanceEntity } from './balance.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { IBalanceRepository } from './balance.repository.interface';
import { OptimisticLockException } from '../../common/exception/optimistic-lock.exception';

@Injectable()
export class BalanceRepository implements IBalanceRepository {
  constructor(
    @InjectRepository(BalanceEntity)
    private readonly balanceRepository: Repository<BalanceEntity>,
  ) {}

  async findByUserId(userId: number): Promise<BalanceEntity | null> {
    return this.balanceRepository.findOne({ where: { userId } });
  }

  async save(balance: Partial<BalanceEntity>): Promise<BalanceEntity> {
    const entity = this.balanceRepository.create(balance);
    return this.balanceRepository.save(entity);
  }

  async updateBalance(balanceEntity: BalanceEntity, newBalance: number): Promise<BalanceEntity> {
    balanceEntity.amount = newBalance;
    return this.balanceRepository.save(balanceEntity);
  }

  async deductBalance(balanceEntity: BalanceEntity, amount: number): Promise<BalanceEntity> {
    balanceEntity.amount = balanceEntity.amount - amount;
    return this.balanceRepository.save(balanceEntity);
  }

  async updateBalanceWithOptimisticLock(balanceEntity: BalanceEntity, newBalance: number): Promise<BalanceEntity> {
    // TypeORM에서 Optimistic Lock 버그 : https://github.com/typeorm/typeorm/issues/2848
    const result = await this.balanceRepository
      .createQueryBuilder()
      .update(BalanceEntity)
      .set({
        amount: newBalance,
        updatedAt: () => 'NOW()',
        version: () => 'version + 1',
      })
      .where('id = :id', { id: balanceEntity.id })
      .andWhere('version = :version', { version: balanceEntity.version })
      .execute();

    if (result.affected === 0) {
      throw new OptimisticLockException();
    }

    // 업데이트된 엔티티를 다시 조회하여 반환
    const updatedEntity = await this.findByUserId(balanceEntity.userId);
    if (!updatedEntity) {
      throw new InternalServerErrorException('업데이트된 잔액 정보를 찾을 수 없습니다.');
    }

    return updatedEntity;
  }

  async deductBalanceWithOptimisticLock(balanceEntity: BalanceEntity, amount: number): Promise<BalanceEntity> {
    const newBalance = balanceEntity.amount - amount;

    const result = await this.balanceRepository
      .createQueryBuilder()
      .update(BalanceEntity)
      .set({
        amount: newBalance,
        updatedAt: () => 'NOW()',
        version: () => 'version + 1',
      })
      .where('id = :id', { id: balanceEntity.id })
      .andWhere('version = :version', { version: balanceEntity.version })
      .execute();

    if (result.affected === 0) {
      throw new OptimisticLockException();
    }

    // 업데이트된 엔티티를 다시 조회하여 반환
    const updatedEntity = await this.findByUserId(balanceEntity.userId);
    if (!updatedEntity) {
      throw new InternalServerErrorException('업데이트된 잔액 정보를 찾을 수 없습니다.');
    }

    return updatedEntity;
  }
}
