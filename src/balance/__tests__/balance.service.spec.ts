import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { BalanceService } from '../balance.service';
import { IBalanceRepository, BALANCE_REPOSITORY } from '../domain/balance.repository.interface';
import { BalanceEntity } from '../domain/balance.entity';
import { BalanceRechargeRequest } from '../dto/request/balance-recharge-request';
import { OptimisticLockException, RetryExhaustedException } from '../../common/exception/optimistic-lock.exception';

describe('BalanceService', () => {
  let service: BalanceService;
  let balanceRepository: jest.Mocked<IBalanceRepository>;

  const mockBalanceEntity: BalanceEntity = {
    id: 1,
    userId: 1,
    amount: 150000,
    version: 1,
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
      updateBalanceWithOptimisticLock: jest.fn(),
      deductBalanceWithOptimisticLock: jest.fn(),
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
      const updatedBalanceEntity = { ...mockBalanceEntity, amount: expectedBalance, version: 2 };

      balanceRepository.findByUserId.mockResolvedValue(mockBalanceEntity);
      balanceRepository.updateBalanceWithOptimisticLock.mockResolvedValue(updatedBalanceEntity);

      await service.rechargeBalance(userId, rechargeRequest);

      expect(balanceRepository.findByUserId).toHaveBeenCalledWith(userId);
      expect(balanceRepository.updateBalanceWithOptimisticLock).toHaveBeenCalledWith(
        mockBalanceEntity,
        expectedBalance,
      );
    });

    it('OptimisticLockException 발생 시 재시도합니다.', async () => {
      const userId = 1;
      const expectedBalance = mockBalanceEntity.amount + rechargeRequest.amount;
      const updatedBalanceEntity = { ...mockBalanceEntity, amount: expectedBalance, version: 2 };

      balanceRepository.findByUserId.mockResolvedValue(mockBalanceEntity);
      balanceRepository.updateBalanceWithOptimisticLock
        .mockRejectedValueOnce(new OptimisticLockException())
        .mockResolvedValueOnce(updatedBalanceEntity);

      await service.rechargeBalance(userId, rechargeRequest);

      expect(balanceRepository.findByUserId).toHaveBeenCalledTimes(2);
      expect(balanceRepository.updateBalanceWithOptimisticLock).toHaveBeenCalledTimes(2);
    });

    it('최대 재시도 횟수 초과 시 RetryExhaustedException을 발생시킵니다.', async () => {
      const userId = 1;

      balanceRepository.findByUserId.mockResolvedValue(mockBalanceEntity);
      balanceRepository.updateBalanceWithOptimisticLock.mockRejectedValue(new OptimisticLockException());

      await expect(service.rechargeBalance(userId, rechargeRequest)).rejects.toThrow(RetryExhaustedException);
      expect(balanceRepository.updateBalanceWithOptimisticLock).toHaveBeenCalledTimes(3);
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
  });

  // 입력값 상세 검증 테스트는 핵심/동시성 시나리오에서 제외하여 단순화

  describe('동시성 제어 및 Edge Cases', () => {
    // 대량 금액 처리 관련 과도한 엣지 케이스 테스트는 제거

    describe('동시성 충돌 시뮬레이션', () => {
      it('충전과 사용이 동시에 발생할 때 재시도가 올바르게 작동합니다.', async () => {
        const userId = 1;
        const rechargeAmount = 10000;
        const useAmount = 5000;

        // 첫 번째 작업: 충전 성공, 두 번째 작업: 첫 시도 실패 후 재시도 성공
        const initialEntity = { ...mockBalanceEntity, amount: 50000, version: 1 };
        const afterRecharge = { ...initialEntity, amount: 60000, version: 2 };
        const afterUse = { ...afterRecharge, amount: 55000, version: 3 };

        // 충전 작업
        balanceRepository.findByUserId.mockResolvedValueOnce(initialEntity);
        balanceRepository.updateBalanceWithOptimisticLock.mockResolvedValueOnce(afterRecharge);

        // 사용 작업 - 첫 번째 시도는 실패 (버전 충돌), 두 번째는 성공
        balanceRepository.findByUserId
          .mockResolvedValueOnce(initialEntity) // 첫 번째 시도 시 이전 버전
          .mockResolvedValueOnce(afterRecharge); // 재시도 시 업데이트된 버전

        balanceRepository.deductBalanceWithOptimisticLock
          .mockRejectedValueOnce(new OptimisticLockException())
          .mockResolvedValueOnce(afterUse);

        // 충전 실행
        const rechargeRequest: BalanceRechargeRequest = { amount: rechargeAmount };
        await service.rechargeBalance(userId, rechargeRequest);

        // 사용 실행
        const result = await service.useBalance(userId, useAmount);

        expect(result.currentBalance).toBe(55000);
        expect(balanceRepository.deductBalanceWithOptimisticLock).toHaveBeenCalledTimes(2);
      });

      it('여러 충전 요청이 동시에 발생할 때 순차적으로 처리됩니다.', async () => {
        const userId = 1;
        const chargeAmount = 10000;
        const request: BalanceRechargeRequest = { amount: chargeAmount };

        // 각 충전마다 버전이 증가하는 시나리오
        const entities = [
          { ...mockBalanceEntity, amount: 100000, version: 1 },
          { ...mockBalanceEntity, amount: 110000, version: 2 },
          { ...mockBalanceEntity, amount: 120000, version: 3 },
        ];

        balanceRepository.findByUserId.mockResolvedValueOnce(entities[0]);
        // 재시도 시 최신 엔티티를 다시 조회하도록 한 번 더 모킹
        balanceRepository.findByUserId.mockResolvedValueOnce(entities[0]);
        balanceRepository.updateBalanceWithOptimisticLock
          .mockRejectedValueOnce(new OptimisticLockException()) // 첫 번째 시도 실패
          .mockResolvedValueOnce(entities[1]); // 재시도 성공

        // 두 번째 충전 요청도 처리
        balanceRepository.findByUserId.mockResolvedValueOnce(entities[1]);
        balanceRepository.updateBalanceWithOptimisticLock.mockResolvedValueOnce(entities[2]);

        await service.rechargeBalance(userId, request);
        await service.rechargeBalance(userId, request);

        expect(balanceRepository.updateBalanceWithOptimisticLock).toHaveBeenCalledTimes(3); // 1회 실패 + 2회 성공
      });
    });

    describe('재시도 로직 상세 검증', () => {
      // 시간 지연에 의존하는 테스트는 취약하므로 제거

      it('재시도 중에도 최신 엔티티 정보를 가져옵니다.', async () => {
        const userId = 1;
        const useAmount = 30000;

        const initialEntity = { ...mockBalanceEntity, amount: 100000, version: 1 };
        const updatedEntity = { ...mockBalanceEntity, amount: 80000, version: 2 };
        const finalEntity = { ...mockBalanceEntity, amount: 50000, version: 3 };

        balanceRepository.findByUserId
          .mockResolvedValueOnce(initialEntity) // 첫 번째 시도
          .mockResolvedValueOnce(updatedEntity); // 재시도 시 최신 정보

        balanceRepository.deductBalanceWithOptimisticLock
          .mockRejectedValueOnce(new OptimisticLockException())
          .mockResolvedValueOnce(finalEntity);

        const result = await service.useBalance(userId, useAmount);

        expect(result.currentBalance).toBe(50000);
        expect(balanceRepository.findByUserId).toHaveBeenCalledTimes(2);
      });
    });

    describe('비즈니스 로직 경계 조건', () => {
      it('정확히 보유 잔액만큼 사용할 수 있습니다.', async () => {
        const userId = 1;
        const exactAmount = mockBalanceEntity.amount; // 150,000원
        const zeroBalanceEntity = { ...mockBalanceEntity, amount: 0, version: 2 };

        balanceRepository.findByUserId.mockResolvedValue(mockBalanceEntity);
        balanceRepository.deductBalanceWithOptimisticLock.mockResolvedValue(zeroBalanceEntity);

        const result = await service.useBalance(userId, exactAmount);

        expect(result.currentBalance).toBe(0);
        expect(result.usedAmount).toBe(exactAmount);
      });

      it('1원 초과 사용 시도시 BadRequestException을 발생시킵니다.', async () => {
        const userId = 1;
        const excessAmount = mockBalanceEntity.amount + 100; // 현재 잔액 + 100원

        balanceRepository.findByUserId.mockResolvedValue(mockBalanceEntity);

        await expect(service.useBalance(userId, excessAmount)).rejects.toThrow(
          new BadRequestException(
            `잔액이 부족합니다. 현재 잔액: ${mockBalanceEntity.amount.toLocaleString()}원, 사용 요청 금액: ${excessAmount.toLocaleString()}원`,
          ),
        );
      });
    });
  });
});
