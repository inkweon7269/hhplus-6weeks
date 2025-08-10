import { DataSource } from 'typeorm';
import * as process from 'process';

let datasource: DataSource;

export const getDatasource = async () => {
  if (datasource) {
    return datasource;
  }
  datasource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_DATABASE,
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    migrations: [`migrations/*`],
    logging: true,
    entities: ['src/**/*.entity.ts'],
    relationLoadStrategy: 'join',
  });
  await datasource.initialize();
  return datasource;
};
