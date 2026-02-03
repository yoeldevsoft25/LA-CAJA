import { newDb } from 'pg-mem';
import { ALL_ENTITIES } from '../database/entities';

async function run() {
  const db = newDb();
  db.public.registerFunction({ implementation: () => '1', name: 'version' });
  db.public.registerFunction({
    implementation: () => 'uuid',
    name: 'uuid_generate_v4',
  });
  db.public.registerFunction({
    implementation: () => 'test',
    name: 'current_database',
  });

  // Register potential missing types to test
  // db.public.registerType({ name: 'tsvector' });

  try {
    const ds = await db.adapters.createTypeormDataSource({
      type: 'postgres',
      entities: ALL_ENTITIES,
      synchronize: true,
    });
    await ds.initialize();
    await ds.synchronize();
    console.log('SUCCESS');
  } catch (e: any) {
    console.error('ERROR:', e.message);
    if (e.message.includes('not supported')) {
      console.error('Type Error Detail:', JSON.stringify(e, null, 2));
    }
  }
}

run();
