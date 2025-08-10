import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { UserEntity } from './user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { IUserRepository } from './user.repository.interface';

@Injectable()
export class UserRepository implements IUserRepository {
  constructor(@InjectRepository(UserEntity) private repo: Repository<UserEntity>) {}

  async findById(id: number) {
    return this.repo.findOne({ where: { id } });
  }

  async findByName(name: string) {
    return this.repo.findOne({ where: { name } });
  }

  async save(user: Partial<UserEntity>): Promise<UserEntity> {
    const entity = this.repo.create(user);
    return await this.repo.save(entity);
  }
}
