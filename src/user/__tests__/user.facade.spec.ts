import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UserFacade } from '../user.facade';
import { UserService } from '../user.service';
import { GetUserProfileResponse } from '../dto';

describe('UserFacade', () => {
  let facade: UserFacade;
  let userService: jest.Mocked<UserService>;

  const mockUserProfile: GetUserProfileResponse = {
    id: 1,
    name: '김철수',
  };

  beforeEach(async () => {
    const mockUserService = {
      getUserProfile: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserFacade,
        {
          provide: UserService,
          useValue: mockUserService,
        },
      ],
    }).compile();

    facade = module.get<UserFacade>(UserFacade);
    userService = module.get(UserService);
  });

  it('should be defined', () => {
    expect(facade).toBeDefined();
  });

  describe('getUserProfile', () => {
    it('사용자가 존재하지 않을 때 NotFoundException을 전달합니다.', async () => {
      const userId = 999;
      const notFoundError = new NotFoundException(`ID가 '${userId}'인 사용자를 찾을 수 없습니다.`);
      userService.getUserProfile.mockRejectedValue(notFoundError);

      await expect(facade.getUserProfile(userId)).rejects.toThrow(notFoundError);
      expect(userService.getUserProfile).toHaveBeenCalledWith(userId);
      expect(userService.getUserProfile).toHaveBeenCalledTimes(1);
    });

    it('사용자가 존재할 때 프로필 정보를 반환합니다.', async () => {
      const userId = 1;
      userService.getUserProfile.mockResolvedValue(mockUserProfile);

      const result: GetUserProfileResponse = await facade.getUserProfile(userId);

      expect(result).toEqual(mockUserProfile);
      expect(userService.getUserProfile).toHaveBeenCalledWith(userId);
      expect(userService.getUserProfile).toHaveBeenCalledTimes(1);
    });
  });
});
