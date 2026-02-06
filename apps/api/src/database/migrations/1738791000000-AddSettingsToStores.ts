import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSettingsToStores1738791000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE stores 
      ADD COLUMN settings JSONB DEFAULT '{}';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE stores 
      DROP COLUMN settings;
    `);
  }
}
