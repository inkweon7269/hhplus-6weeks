import { AppDataSource } from './data-source';
import { seedProducts } from './seeds/product.seed';
import { seedOrders } from './seeds/order.seed';

async function seed() {
  try {
    await AppDataSource.initialize();
    console.log('Data Source has been initialized!');

    await seedProducts(AppDataSource);
    await seedOrders(AppDataSource);

    await AppDataSource.destroy();
    console.log('Seeding completed!');
  } catch (error) {
    console.error('Error during seeding:', error);
    process.exit(1);
  }
}

seed();
