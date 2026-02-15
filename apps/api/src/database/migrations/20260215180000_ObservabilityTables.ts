import { MigrationInterface, QueryRunner, Table, TableIndex } from "typeorm";

export class ObservabilityTables20260215180000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create alerts table
    await queryRunner.createTable(new Table({
      name: "alerts",
      columns: [
        {
          name: "id",
          type: "uuid",
          isPrimary: true,
          isGenerated: true,
          generationStrategy: "uuid",
          default: "uuid_generate_v4()"
        },
        {
          name: "service_name",
          type: "varchar",
          length: "100"
        },
        {
          name: "alert_type",
          type: "varchar",
          length: "50"
        },
        {
          name: "severity",
          type: "varchar",
          length: "20"
        },
        {
          name: "message",
          type: "text"
        },
        {
          name: "status",
          type: "varchar",
          length: "20"
        },
        {
          name: "metadata",
          type: "jsonb",
          isNullable: true
        },
        {
          name: "created_at",
          type: "timestamptz",
          default: "now()"
        },
        {
          name: "updated_at",
          type: "timestamptz",
          default: "now()"
        }
      ]
    }), true);

    // Create alert indices
    await queryRunner.createIndex("alerts", new TableIndex({
      name: "IDX_alerts_status",
      columnNames: ["status"]
    }));
    await queryRunner.createIndex("alerts", new TableIndex({
      name: "IDX_alerts_service_name",
      columnNames: ["service_name"]
    }));
    await queryRunner.createIndex("alerts", new TableIndex({
      name: "IDX_alerts_severity",
      columnNames: ["severity"]
    }));
    await queryRunner.createIndex("alerts", new TableIndex({
      name: "IDX_alerts_created_at",
      columnNames: ["created_at"]
    }));
    // Partial index support varies by driver, assuming Postgres
    await queryRunner.query(`CREATE INDEX "IDX_alerts_status_created_at_active" ON "alerts" ("status", "created_at") WHERE status = 'active'`);


    // Create uptime_records table
    await queryRunner.createTable(new Table({
      name: "uptime_records",
      columns: [
        {
          name: "id",
          type: "uuid",
          isPrimary: true,
          isGenerated: true,
          generationStrategy: "uuid",
          default: "uuid_generate_v4()"
        },
        {
          name: "timestamp",
          type: "timestamptz"
        },
        {
          name: "status",
          type: "varchar",
          length: "20"
        },
        {
          name: "service_name",
          type: "varchar",
          length: "100",
          isNullable: true
        },
        {
          name: "response_time_ms",
          type: "integer",
          isNullable: true
        },
        {
          name: "error_message",
          type: "text",
          isNullable: true
        },
        {
          name: "metadata",
          type: "jsonb",
          isNullable: true
        },
        {
          name: "created_at",
          type: "timestamptz",
          default: "now()"
        }
      ]
    }), true);

    // Create uptime_records indices
    await queryRunner.createIndex("uptime_records", new TableIndex({
      name: "IDX_uptime_records_timestamp",
      columnNames: ["timestamp"]
    }));
    await queryRunner.createIndex("uptime_records", new TableIndex({
      name: "IDX_uptime_records_service_name",
      columnNames: ["service_name"]
    }));
    await queryRunner.createIndex("uptime_records", new TableIndex({
      name: "IDX_uptime_records_status",
      columnNames: ["status"]
    }));
    await queryRunner.createIndex("uptime_records", new TableIndex({
      name: "IDX_uptime_records_service_name_timestamp",
      columnNames: ["service_name", "timestamp"]
    }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("uptime_records");
    await queryRunner.dropTable("alerts");
  }
}
