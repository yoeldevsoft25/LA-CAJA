import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddFromEscrowToMovements1738792000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "inventory_movements" ADD COLUMN IF NOT EXISTS "from_escrow" BOOLEAN DEFAULT false;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('inventory_movements', 'from_escrow');
  }
}
