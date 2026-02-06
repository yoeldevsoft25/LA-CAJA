import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddFromEscrowToMovements1738792000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'inventory_movements',
      new TableColumn({
        name: 'from_escrow',
        type: 'boolean',
        default: false,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('inventory_movements', 'from_escrow');
  }
}
