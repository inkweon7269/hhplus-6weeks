import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { BalanceFacade } from '../balance.facade';
import { BalanceService } from '../balance.service';
import { BalanceRechargeRequest } from '../dto/request/balance-recharge-request';
import { BalanceResponse } from '../dto/response/balance-response';
import { BalanceEntity } from '../domain/balance.entity';
import { OptimisticLockException } from '../../common/exception/optimistic-lock.exception';

describe('BalanceFacade', () => {
  let facade: BalanceFacade;
  let balanceService: jest.Mocked<BalanceService>;

  const mockBalanceEntity: BalanceEntity = {
    id: 1,
    userId: 1,
    amount: 150000,
    version: 1,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    user: null,
  };

  const mockBalanceResponse: BalanceResponse = {
    id: 1,
    userId: 1,
    amount: 150000,
    createdAt: '2024-01-01 00:00:00',
    updatedAt: '2024-01-01 00:00:00',
  };

  beforeEach(async () => {
    const mockService = {
      getBalance: jest.fn(),
      rechargeBalance: jest.fn(),
      useBalance: jest.fn(),
      initializeBalance: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BalanceFacade,
        {
          provide: BalanceService,
          useValue: mockService,
        },
      ],
    }).compile();

    facade = module.get<BalanceFacade>(BalanceFacade);
    balanceService = module.get(BalanceService);
  });

  it('should be defined', () => {
    expect(facade).toBeDefined();
  });

  describe('getBalance', () => {
    it('사용자의 잔액 정보가 존재하지 않을 때 NotFoundException을 전달합니다.', async () => {
      const userId = 999;
      const notFoundError = new NotFoundException(`ID가 '${userId}'인 사용자의 잔액 정보를 찾을 수 없습니다.`);
      balanceService.getBalance.mockRejectedValue(notFoundError);

      await expect(facade.getBalance(userId)).rejects.toThrow(notFoundError);
      expect(balanceService.getBalance).toHaveBeenCalledWith(userId);
      expect(balanceService.getBalance).toHaveBeenCalledTimes(1);
    });

    it('사용자의 잔액 정보가 존재할 때 BalanceResponse를 반환합니다.', async () => {
      const userId = 1;
      balanceService.getBalance.mockResolvedValue(mockBalanceEntity);

      // BalanceResponse.of 메서드를 mock
      jest.spyOn(BalanceResponse, 'of').mockReturnValue(mockBalanceResponse);

      const result = await facade.getBalance(userId);

      expect(result).toEqual(mockBalanceResponse);
      expect(balanceService.getBalance).toHaveBeenCalledWith(userId);
      expect(balanceService.getBalance).toHaveBeenCalledTimes(1);
      expect(BalanceResponse.of).toHaveBeenCalledWith(mockBalanceEntity);
    });
  });

  describe('rechargeBalance', () => {
    const rechargeRequest: BalanceRechargeRequest = { amount: 10000 };

    it('사용자의 잔액 정보가 존재하지 않을 때 NotFoundException을 전달합니다.', async () => {
      const userId = 999;
      const notFoundError = new NotFoundException(`ID가 '${userId}'인 사용자의 잔액 정보를 찾을 수 없습니다.`);
      balanceService.rechargeBalance.mockRejectedValue(notFoundError);

      await expect(facade.rechargeBalance(userId, rechargeRequest)).rejects.toThrow(notFoundError);
      expect(balanceService.rechargeBalance).toHaveBeenCalledWith(userId, rechargeRequest);
      expect(balanceService.rechargeBalance).toHaveBeenCalledTimes(1);
    });

    it('사용자 잔액을 충전합니다.', async () => {
      const userId = 1;
      balanceService.rechargeBalance.mockResolvedValue(undefined);

      await facade.rechargeBalance(userId, rechargeRequest);

      expect(balanceService.rechargeBalance).toHaveBeenCalledWith(userId, rechargeRequest);
      expect(balanceService.rechargeBalance).toHaveBeenCalledTimes(1);
    });

    it('OptimisticLockException을 Service에서 전달받으면 그대로 전파합니다.', async () => {
      const userId = 1;
      const optimisticLockError = new OptimisticLockException();
      balanceService.rechargeBalance.mockRejectedValue(optimisticLockError);

      await expect(facade.rechargeBalance(userId, rechargeRequest)).rejects.toThrow(OptimisticLockException);
      expect(balanceService.rechargeBalance).toHaveBeenCalledWith(userId, rechargeRequest);
    });

    it('유효하지 않은 충전 요청에 대해 Service 에러를 전파합니다.', async () => {
      const userId = 1;
      const invalidRequest = { amount: 50 }; // 100원 미만
      const validationError = new BadRequestException('충전 금액은 최소 100원 이상이어야 합니다.');

      balanceService.rechargeBalance.mockRejectedValue(validationError);

      await expect(facade.rechargeBalance(userId, invalidRequest)).rejects.toThrow(BadRequestException);
      expect(balanceService.rechargeBalance).toHaveBeenCalledWith(userId, invalidRequest);
    });
  });

  describe('DTO 변환 로직', () => {
    it('BalanceEntity에서 BalanceResponse로 올바르게 변환됩니다.', async () => {
      const userId = 1;
      balanceService.getBalance.mockResolvedValue(mockBalanceEntity);

      // BalanceResponse.of 정적 메서드의 실제 동작을 검증
      const result = await facade.getBalance(userId);

      expect(result).toHaveProperty('id', mockBalanceEntity.id);
      expect(result).toHaveProperty('userId', mockBalanceEntity.userId);
      expect(result).toHaveProperty('amount', mockBalanceEntity.amount);
      expect(result).toHaveProperty('createdAt');
      expect(result).toHaveProperty('updatedAt');
    });

    it('충전 요청이 정상적으로 Service로 전달됩니다.', async () => {
      const userId = 1;
      const chargeRequest = { amount: 50000 };

      balanceService.rechargeBalance.mockResolvedValue(undefined);

      await facade.rechargeBalance(userId, chargeRequest);

      expect(balanceService.rechargeBalance).toHaveBeenCalledWith(userId, chargeRequest);
      expect(balanceService.rechargeBalance).toHaveBeenCalledTimes(1);
    });
  });

  // 예외 처리 전파 테스트는 핵심 시나리오에서 제외하여 단순화
});
