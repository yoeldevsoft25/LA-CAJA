import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPNCountersToCashSessions1738790000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE cash_sessions 
      ADD COLUMN IF NOT EXISTS ledger_p_bs NUMERIC(18,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS ledger_n_bs NUMERIC(18,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS ledger_p_usd NUMERIC(18,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS ledger_n_usd NUMERIC(18,2) DEFAULT 0;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE cash_sessions 
      DROP COLUMN ledger_p_bs,
      DROP COLUMN ledger_n_bs,
      DROP COLUMN ledger_p_usd,
      DROP COLUMN ledger_n_usd;
    `);
  }
}
