import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { BalanceFacade } from '../balance.facade';
import { BalanceService } from '../balance.service';
import { BalanceRechargeRequest } from '../dto/request/balance-recharge-request';
import { BalanceResponse } from '../dto/response/balance-response';
import { BalanceEntity } from '../domain/balance.entity';

describe('BalanceFacade', () => {
  let facade: BalanceFacade;
  let balanceService: jest.Mocked<BalanceService>;

  const mockBalanceEntity: BalanceEntity = {
    id: 1,
    userId: 1,
    amount: 150000,
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
  });
});
