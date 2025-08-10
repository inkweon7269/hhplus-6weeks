import { UserEntity } from './user.entity';

export interface IUserRepository {
  findById(id: number): Promise<UserEntity | null>;
  findByName(name: string): Promise<UserEntity | null>;
  save(user: Partial<UserEntity>): Promise<UserEntity>;
}

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
