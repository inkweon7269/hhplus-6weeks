import { BalanceEntity } from './balance.entity';

export interface IBalanceRepository {
  findByUserId(userId: number): Promise<BalanceEntity | null>;
  save(balance: Partial<BalanceEntity>): Promise<BalanceEntity>;
  updateBalance(balanceEntity: BalanceEntity, newBalance: number): Promise<BalanceEntity>;
  deductBalance(balanceEntity: BalanceEntity, amount: number): Promise<BalanceEntity>;
  updateBalanceWithOptimisticLock(balanceEntity: BalanceEntity, newBalance: number): Promise<BalanceEntity>;
  deductBalanceWithOptimisticLock(balanceEntity: BalanceEntity, amount: number): Promise<BalanceEntity>;
}

export const BALANCE_REPOSITORY = Symbol('BALANCE_REPOSITORY');
