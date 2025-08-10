import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UserService } from '../user.service';
import { IUserRepository, USER_REPOSITORY } from '../domain/user.repository.interface';
import { UserEntity } from '../domain/user.entity';
import { GetUserProfileResponse } from '../dto';

describe('UserService', () => {
  let service: UserService;
  let userRepository: jest.Mocked<IUserRepository>;

  const mockUser: UserEntity = {
    id: 1,
    name: '김철수',
  };

  beforeEach(async () => {
    const mockUserRepository = {
      findById: jest.fn(),
      findByName: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: USER_REPOSITORY,
          useValue: mockUserRepository,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    userRepository = module.get(USER_REPOSITORY);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getUserProfile', () => {
    it('사용자가 존재하지 않을 때 NotFoundException을 전달합니다.', async () => {
      const userId = 999;
      userRepository.findById.mockResolvedValue(null);

      await expect(service.getUserProfile(userId)).rejects.toThrow(
        new NotFoundException(`ID가 '${userId}'인 사용자를 찾을 수 없습니다.`),
      );
      expect(userRepository.findById).toHaveBeenCalledWith(userId);
      expect(userRepository.findById).toHaveBeenCalledTimes(1);
    });

    it('사용자가 존재할 때 프로필 정보를 반환합니다.', async () => {
      const userId = 1;
      userRepository.findById.mockResolvedValue(mockUser);

      const result: GetUserProfileResponse = await service.getUserProfile(userId);

      expect(result).toEqual({
        id: mockUser.id,
        name: mockUser.name,
      });
      expect(userRepository.findById).toHaveBeenCalledWith(userId);
      expect(userRepository.findById).toHaveBeenCalledTimes(1);
    });
  });
});
