import mongoose from 'mongoose';
import { runMigrations, Migration } from '../migrations/migration.runner';
import { migration0001 } from '../migrations/0001-staff-pin-lookup-index';
import { migration0002 } from '../migrations/0002-session-token-backfill';
import { migration0003 } from '../migrations/0003-drop-staff-pin';
import { Staff } from '../models/staff.model';
import { TotemSession } from '../models/totem.model';

const describeWithIntegrationDb = process.env.CI === 'true' || !!process.env.MONGODB_URI_TEST
  ? describe
  : describe.skip;

describeWithIntegrationDb('Migration runner', () => {
  interface RegistryDoc {
    _id: string;
    appliedAt?: Date;
    acquiredAt?: Date;
  }
  const registry = () => mongoose.connection.db!.collection<RegistryDoc>('schema_migrations');

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI!);
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await registry().deleteMany({});
  });

  it('applies pending migrations in order and records them', async () => {
    const order: string[] = [];
    const migrations: Migration[] = [
      { name: '0001-a', up: async () => { order.push('0001-a'); } },
      { name: '0002-b', up: async () => { order.push('0002-b'); } },
    ];
    const applied = await runMigrations(migrations);
    expect(applied).toEqual(['0001-a', '0002-b']);
    expect(order).toEqual(['0001-a', '0002-b']);
    const recorded = await registry().find({ _id: { $ne: '__migration_lock__' } }).toArray();
    expect(recorded.map((d) => d._id).sort()).toEqual(['0001-a', '0002-b']);
  });

  it('is idempotent: a second run applies nothing', async () => {
    let runs = 0;
    const migrations: Migration[] = [{ name: '0001-a', up: async () => { runs++; } }];
    await runMigrations(migrations);
    const second = await runMigrations(migrations);
    expect(second).toEqual([]);
    expect(runs).toBe(1);
  });

  it('records earlier migrations when a later one fails, and releases the lock', async () => {
    let runs = 0;
    await expect(runMigrations([
      { name: '0001-a', up: async () => { runs++; } },
      { name: '0002-b', up: async () => { throw new Error('boom'); } },
    ])).rejects.toThrow('boom');
    expect(runs).toBe(1);
    // Lock was released and 0001-a is not re-run on the next call.
    await runMigrations([{ name: '0001-a', up: async () => { runs++; } }]);
    expect(runs).toBe(1);
  });

  it('fails fast when the lock is held by another process', async () => {
    await registry().insertOne({ _id: '__migration_lock__', acquiredAt: new Date() });
    await expect(runMigrations([], { lockTimeoutMs: 500 }))
      .rejects.toThrow('MIGRATION_LOCK_TIMEOUT');
    await registry().deleteOne({ _id: '__migration_lock__' });
  });

  it('steals a stale lock', async () => {
    await registry().insertOne({ _id: '__migration_lock__', acquiredAt: new Date(Date.now() - 120_000) });
    const applied = await runMigrations([{ name: '0001-a', up: async () => {} }], { lockTimeoutMs: 1000 });
    expect(applied).toEqual(['0001-a']);
  });

  it('renews a short lease while a long migration is still running', async () => {
    let releaseMigration!: () => void;
    const migrationCanFinish = new Promise<void>((resolve) => {
      releaseMigration = resolve;
    });
    const firstRun = runMigrations([{
      name: '0001-long',
      up: async () => migrationCanFinish,
    }], { lockLeaseMs: 90, lockTimeoutMs: 1_000 });

    await new Promise((resolve) => setTimeout(resolve, 180));
    try {
      await expect(runMigrations([], { lockLeaseMs: 90, lockTimeoutMs: 100 }))
        .rejects.toThrow('MIGRATION_LOCK_TIMEOUT');
    } finally {
      releaseMigration();
    }
    await expect(firstRun).resolves.toEqual(['0001-long']);
  });

  it('rejects invalid migration lease durations', async () => {
    await expect(runMigrations([], { lockLeaseMs: 0 }))
      .rejects.toThrow('MIGRATION_LOCK_INVALID_LEASE');
  });

  it('0001 creates the unique partial pin_lookup index', async () => {
    await runMigrations([migration0001]);
    const indexes = await Staff.collection.indexes();
    const index = indexes.find(
      (i) => JSON.stringify(i.key) === JSON.stringify({ restaurant_id: 1, pin_lookup: 1 })
    );
    expect(index?.unique).toBe(true);
    expect(index?.partialFilterExpression).toEqual({ pin_lookup: { $type: 'string' } });
  });

  it('0002 back-fills session_token only on legacy STARTED sessions', async () => {
    const totemId = new mongoose.Types.ObjectId();
    await TotemSession.collection.insertOne({
      totem_id: totemId,
      totem_state: 'STARTED',
      session_date_start: new Date(),
    });
    await TotemSession.collection.insertOne({
      totem_id: totemId,
      totem_state: 'PAID',
      session_date_start: new Date(),
    });

    await runMigrations([migration0002]);

    const started = await TotemSession.collection.findOne({ totem_state: 'STARTED' });
    expect(typeof started?.session_token).toBe('string');
    expect((started?.session_token as string).length).toBeGreaterThan(0);
    const paid = await TotemSession.collection.findOne({ totem_state: 'PAID' });
    expect(paid?.session_token).toBeUndefined();
  });

  it('0003 drops the pin_lookup index and unsets pin fields, tolerating a missing index', async () => {
    const restaurantId = new mongoose.Types.ObjectId();
    const roleId = new mongoose.Types.ObjectId();
    await Staff.collection.insertOne({
      restaurant_id: restaurantId,
      role_id: roleId,
      staff_name: 'Legacy',
      username: 'legacy',
      password_hash: 'x',
      pin_code_hash: 'y',
      pin_lookup: 'z',
    });

    // Without the 0001 index the drop must be a no-op, not an error.
    await runMigrations([migration0003]);

    // Recreate the index via 0001 and ensure 0003 removes it too.
    await registry().deleteMany({ _id: '0003-drop-staff-pin' });
    await runMigrations([migration0001, migration0003]);

    const indexes = await Staff.collection.indexes();
    expect(
      indexes.find((i) => JSON.stringify(i.key) === JSON.stringify({ restaurant_id: 1, pin_lookup: 1 }))
    ).toBeUndefined();

    const staff = await Staff.collection.findOne({ username: 'legacy' });
    expect(staff).not.toBeNull();
    expect(staff).not.toHaveProperty('pin_code_hash');
    expect(staff).not.toHaveProperty('pin_lookup');
  });
});
