import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { BalanceService } from '../balance.service';
import { IBalanceRepository, BALANCE_REPOSITORY } from '../domain/balance.repository.interface';
import { BalanceEntity } from '../domain/balance.entity';
import { BalanceRechargeRequest } from '../dto/request/balance-recharge-request';

describe('BalanceService', () => {
  let service: BalanceService;
  let balanceRepository: jest.Mocked<IBalanceRepository>;

  const mockBalanceEntity: BalanceEntity = {
    id: 1,
    userId: 1,
    amount: 150000,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    user: null,
  };

  beforeEach(async () => {
    const mockRepository = {
      findByUserId: jest.fn(),
      save: jest.fn(),
      updateBalance: jest.fn(),
      deductBalance: jest.fn(),
      findAll: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BalanceService,
        {
          provide: BALANCE_REPOSITORY,
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<BalanceService>(BalanceService);
    balanceRepository = module.get(BALANCE_REPOSITORY);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getBalance', () => {
    it('사용자의 잔액 정보가 존재하지 않을 때 NotFoundException을 발생시킵니다.', async () => {
      const userId = 999;
      balanceRepository.findByUserId.mockResolvedValue(null);

      await expect(service.getBalance(userId)).rejects.toThrow(
        new NotFoundException(`ID가 '${userId}'인 사용자의 잔액 정보를 찾을 수 없습니다.`),
      );
      expect(balanceRepository.findByUserId).toHaveBeenCalledWith(userId);
      expect(balanceRepository.findByUserId).toHaveBeenCalledTimes(1);
    });

    it('사용자의 잔액 정보가 존재할 때 BalanceEntity를 반환합니다.', async () => {
      const userId = 1;
      balanceRepository.findByUserId.mockResolvedValue(mockBalanceEntity);

      const result = await service.getBalance(userId);

      expect(result).toEqual(mockBalanceEntity);
      expect(balanceRepository.findByUserId).toHaveBeenCalledWith(userId);
      expect(balanceRepository.findByUserId).toHaveBeenCalledTimes(1);
    });
  });

  describe('rechargeBalance', () => {
    const rechargeRequest: BalanceRechargeRequest = { amount: 10000 };

    it('사용자의 잔액 정보가 존재하지 않을 때 NotFoundException을 발생시킵니다.', async () => {
      const userId = 999;
      balanceRepository.findByUserId.mockResolvedValue(null);

      await expect(service.rechargeBalance(userId, rechargeRequest)).rejects.toThrow(
        new NotFoundException(`ID가 '${userId}'인 사용자의 잔액 정보를 찾을 수 없습니다.`),
      );
      expect(balanceRepository.findByUserId).toHaveBeenCalledWith(userId);
    });

    it('기존 사용자의 경우 잔액을 업데이트합니다.', async () => {
      const userId = 1;
      const expectedBalance = mockBalanceEntity.amount + rechargeRequest.amount;
      const updatedBalanceEntity = { ...mockBalanceEntity, amount: expectedBalance };

      balanceRepository.findByUserId.mockResolvedValue(mockBalanceEntity);
      balanceRepository.updateBalance.mockResolvedValue(updatedBalanceEntity);

      await service.rechargeBalance(userId, rechargeRequest);

      expect(balanceRepository.findByUserId).toHaveBeenCalledWith(userId);
      expect(balanceRepository.updateBalance).toHaveBeenCalledWith(mockBalanceEntity, expectedBalance);
    });
  });

  describe('useBalance', () => {
    const validUsedAmount = 50000;

    it('사용자의 잔액 정보가 존재하지 않을 때 NotFoundException을 발생시킵니다.', async () => {
      const userId = 999;
      balanceRepository.findByUserId.mockResolvedValue(null);

      await expect(service.useBalance(userId, validUsedAmount)).rejects.toThrow(
        new NotFoundException(`ID가 '${userId}'인 사용자의 잔액 정보를 찾을 수 없습니다.`),
      );
      expect(balanceRepository.findByUserId).toHaveBeenCalledWith(userId);
    });

    it('잔액이 부족할 때 BadRequestException을 발생시킵니다.', async () => {
      const userId = 1;
      const insufficientAmount = 200000; // 현재 잔액(150,000)보다 큰 금액
      balanceRepository.findByUserId.mockResolvedValue(mockBalanceEntity);

      await expect(service.useBalance(userId, insufficientAmount)).rejects.toThrow(
        new BadRequestException(
          `잔액이 부족합니다. 현재 잔액: ${mockBalanceEntity.amount.toLocaleString()}원, 사용 요청 금액: ${insufficientAmount.toLocaleString()}원`,
        ),
      );
      expect(balanceRepository.findByUserId).toHaveBeenCalledWith(userId);
    });

    it('유효하지 않은 사용 금액일 때 BadRequestException을 발생시킵니다.', async () => {
      const userId = 1;
      const invalidAmount = 150; // 100원 단위가 아님

      await expect(service.useBalance(userId, invalidAmount)).rejects.toThrow(
        new BadRequestException('사용 금액은 100원 단위로만 입력 가능합니다.'),
      );
    });

    it('정상적인 경우 잔액을 차감하고 결과를 반환합니다.', async () => {
      const userId = 1;
      const expectedBalance = mockBalanceEntity.amount - validUsedAmount;
      const updatedBalanceEntity = { ...mockBalanceEntity, amount: expectedBalance };

      balanceRepository.findByUserId.mockResolvedValue(mockBalanceEntity);
      balanceRepository.deductBalance.mockResolvedValue(updatedBalanceEntity);

      const result = await service.useBalance(userId, validUsedAmount);

      expect(result).toEqual({
        userId,
        usedAmount: validUsedAmount,
        currentBalance: expectedBalance,
      });
      expect(balanceRepository.findByUserId).toHaveBeenCalledWith(userId);
      expect(balanceRepository.deductBalance).toHaveBeenCalledWith(mockBalanceEntity, validUsedAmount);
    });
  });
});
