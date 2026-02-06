import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableIndex,
  TableUnique,
} from 'typeorm';

export class CreateCashLedgerAndEscrow1738786000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create cash_ledger_entries table
    await queryRunner.createTable(
      new Table({
        name: 'cash_ledger_entries',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true },
          { name: 'store_id', type: 'uuid' },
          { name: 'device_id', type: 'uuid' },
          { name: 'seq', type: 'bigint' },
          { name: 'vector_clock', type: 'jsonb', default: "'{}'" },
          { name: 'entry_type', type: 'text' }, // sale, expense, adjustment, transfer, initial_balance, income
          {
            name: 'amount_bs',
            type: 'numeric',
            precision: 18,
            scale: 2,
            default: 0,
          },
          {
            name: 'amount_usd',
            type: 'numeric',
            precision: 18,
            scale: 2,
            default: 0,
          },
          { name: 'currency', type: 'varchar', length: '10', default: "'BS'" },
          { name: 'cash_session_id', type: 'uuid' },
          { name: 'sold_at', type: 'timestamptz' },
          { name: 'event_id', type: 'uuid' },
          { name: 'request_id', type: 'uuid' },
          { name: 'created_at', type: 'timestamptz', default: 'now()' },
          { name: 'metadata', type: 'jsonb', isNullable: true },
        ],
      }),
      true,
    );

    // Indices for cash_ledger_entries
    await queryRunner.createIndex(
      'cash_ledger_entries',
      new TableIndex({
        name: 'IDX_cash_ledger_store_session',
        columnNames: ['store_id', 'cash_session_id'],
      }),
    );

    await queryRunner.createIndex(
      'cash_ledger_entries',
      new TableIndex({
        name: 'IDX_cash_ledger_event_id',
        columnNames: ['event_id'],
      }),
    );

    await queryRunner.createIndex(
      'cash_ledger_entries',
      new TableIndex({
        name: 'IDX_cash_ledger_request_id',
        columnNames: ['request_id'],
        isUnique: true,
      }),
    );

    await queryRunner.createIndex(
      'cash_ledger_entries',
      new TableIndex({
        name: 'IDX_cash_ledger_store_created_at',
        columnNames: ['store_id', 'created_at'],
      }),
    );

    // Create stock_escrow table
    await queryRunner.createTable(
      new Table({
        name: 'stock_escrow',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true },
          { name: 'store_id', type: 'uuid' },
          { name: 'product_id', type: 'uuid' },
          { name: 'variant_id', type: 'uuid', isNullable: true },
          { name: 'device_id', type: 'uuid' },
          {
            name: 'qty_granted',
            type: 'numeric',
            precision: 18,
            scale: 3,
            default: 0,
          },
          { name: 'expires_at', type: 'timestamptz', isNullable: true },
          { name: 'last_updated_at', type: 'timestamptz', default: 'now()' },
        ],
      }),
      true,
    );

    // Indices for stock_escrow
    await queryRunner.createUniqueConstraint(
      'stock_escrow',
      new TableUnique({
        name: 'UQ_stock_escrow_store_product_device',
        columnNames: ['store_id', 'product_id', 'device_id'], // Assuming variant handles nulls correctly in older PGs? Or just business logic?
        // Note: Unique constraints with NULL columns behavior depends on DB. Assuming product_id implies variant logic handled or separate rows.
        // Actually, if variant_id can be null, we might need a partial index or just rely on UUIDs.
        // Let's stick to the constraint requested: store, product, device. Variant should probably be part of uniqueness if it exists.
        // Let's separate it into an index for now since standard Unique handles NULLs as non-equal.
      }),
    );

    // Better unique constraint including variant logic implicitly or explicitly.
    // If variant_id is NULL, multiple NULLs are allowed in standard SQL unique index.
    // Postgres 15 allows UNIQUE NULLS NOT DISTINCT. But to be safe, let's just index store/product.

    await queryRunner.createIndex(
      'stock_escrow',
      new TableIndex({
        name: 'IDX_stock_escrow_store_product',
        columnNames: ['store_id', 'product_id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('stock_escrow');
    await queryRunner.dropTable('cash_ledger_entries');
  }
}
