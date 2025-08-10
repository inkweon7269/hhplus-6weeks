export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  logging: boolean;
}

export const dbConfig = () => ({
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432, // PostgreSQL 기본 포트
    database: process.env.DB_DATABASE || 'dbname',
    username: process.env.DB_USERNAME || 'postgres', // PostgreSQL 기본 사용자
    password: process.env.DB_PASSWORD || 'pw',
    logging: process.env.DB_LOGGING_ENABLED == 'true' || false,
  } as DatabaseConfig,
});
