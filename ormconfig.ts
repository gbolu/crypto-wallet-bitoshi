import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { TransactionEntity } from './src/domain/transaction/entities/transaction.entity';
import { WalletEntity } from './src/domain/wallet/entities/wallet.entity';

config();

export default new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST ?? 'localhost',
  port: Number(process.env.DATABASE_PORT ?? 5432),
  username: process.env.DATABASE_USER ?? 'postgres',
  password: process.env.DATABASE_PASSWORD ?? 'postgres',
  database: process.env.DATABASE_NAME ?? 'bitoshi_wallet',
  ssl:
    (process.env.DATABASE_SSL ?? 'false') === 'true'
      ? { rejectUnauthorized: false }
      : false,
  entities: [WalletEntity, TransactionEntity],
  migrations: ['src/database/migrations/*.ts'],
  synchronize: false,
});
