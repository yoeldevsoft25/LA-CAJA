import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from "typeorm";

export class AddRequestIdToEvents1738787000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Add request_id column
        await queryRunner.addColumn("events", new TableColumn({
            name: "request_id",
            type: "uuid",
            isNullable: true // Existing events won't have it
        }));

        // 2. Create unique index for request_id (filtered to only track non-null values for dedupe)
        // Note: Using raw SQL for the filtered index as TableIndex's 'where' clause support varies by driver version
        await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_events_request_id_unique" 
            ON "events" (request_id) 
            WHERE request_id IS NOT NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropIndex("events", "IDX_events_request_id_unique");
        await queryRunner.dropColumn("events", "request_id");
    }
}
