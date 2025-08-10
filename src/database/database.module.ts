import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseConfig, dbConfig } from './database.config';
import { addTransactionalDataSource } from 'typeorm-transactional';
import { DataSource } from 'typeorm';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [
        ConfigModule.forRoot({
          load: [dbConfig],
          envFilePath: `.env.${process.env.NODE_ENV}`,
        }),
      ],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        ...configService.get<DatabaseConfig>('database'),
        synchronize: false,
        autoLoadEntities: true,
        relationLoadStrategy: 'join',
      }),
      inject: [ConfigService],
      dataSourceFactory: async (options) => {
        if (!options) {
          throw new Error('Invalid options passed');
        }
        const dataSource = new DataSource(options);
        // 테스트 환경에서는 이미 setup.ts에서 등록되어 있을 수 있음
        try {
          return addTransactionalDataSource(dataSource);
        } catch (error) {
          if (error.message?.includes('has already added')) {
            return dataSource;
          }
          throw error;
        }
      },
    }),
  ],
  controllers: [],
  providers: [],
})
export class DatabaseModule {}
