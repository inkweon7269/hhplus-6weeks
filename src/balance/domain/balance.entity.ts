import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  VersionColumn,
} from 'typeorm';
import { UserEntity } from '../../user/domain/user.entity';

@Entity('balances')
export class BalanceEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn({ comment: '생성일시' })
  createdAt: Date;

  @UpdateDateColumn({ comment: '수정일시' })
  updatedAt: Date;

  @Column({ type: 'int', unique: true, comment: '사용자 ID' })
  userId: number;

  @Column({ type: 'int', comment: '잔액' })
  amount: number;

  @VersionColumn({ comment: '낙관적 락을 위한 버전 컬럼' })
  version: number;

  // UserEntity와 OneToOne 관계 (owning side, 기존 userId 컬럼 활용)
  @OneToOne(() => UserEntity, (user) => user.balance)
  @JoinColumn({ name: 'userId' })
  user: UserEntity;
}
