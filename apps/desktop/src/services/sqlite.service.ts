import Database from '@tauri-apps/plugin-sql';
import { createLogger } from '@/lib/logger';

const logger = createLogger('SqliteService');

class SqliteService {
    private static instance: SqliteService;
    private db: Database | null = null;
    private dbName = 'velox_pos.db';

    private constructor() { }

    public static getInstance(): SqliteService {
        if (!SqliteService.instance) {
            SqliteService.instance = new SqliteService();
        }
        return SqliteService.instance;
    }

    /**
     * Initialize the database connection
     */
    public async initialize(): Promise<void> {
        if (this.db) return;

        try {
            logger.info(`Connecting to SQLite database: ${this.dbName}`);
            // Connect to SQLite database. The path is relative to the AppData directory.
            this.db = await Database.load(`sqlite:${this.dbName}`);
            logger.info('Connected to SQLite database successfully');

            await this.runMigrations();
        } catch (error) {
            logger.error('Failed to connect to SQLite database', error);
            throw error;
        }
    }

    /**
     * Run initial migrations to set up tables
     */
    private async runMigrations(): Promise<void> {
        if (!this.db) return;

        try {
            // Version control table
            await this.db.execute(`
                CREATE TABLE IF NOT EXISTS schema_migrations (
                    version INTEGER PRIMARY KEY,
                    executed_at INTEGER NOT NULL
                );
            `);

            const migrations = [
                {
                    version: 1,
                    sql: `
                        -- PRODUCTS
                        CREATE TABLE IF NOT EXISTS products (
                            id TEXT PRIMARY KEY,
                            store_id TEXT NOT NULL,
                            name TEXT NOT NULL,
                            sku TEXT,
                            barcode TEXT,
                            category TEXT,
                            is_active INTEGER DEFAULT 1,
                            json_data TEXT NOT NULL,
                            updated_at INTEGER
                        );
                        CREATE INDEX IF NOT EXISTS idx_products_store ON products(store_id);
                        CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
                        CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
                        CREATE INDEX IF NOT EXISTS idx_products_name ON products(name); -- Consider FTS for future

                        -- CUSTOMERS
                        CREATE TABLE IF NOT EXISTS customers (
                            id TEXT PRIMARY KEY,
                            store_id TEXT NOT NULL,
                            name TEXT NOT NULL,
                            document_id TEXT,
                            phone TEXT,
                            json_data TEXT NOT NULL,
                            updated_at INTEGER
                        );
                        CREATE INDEX IF NOT EXISTS idx_customers_store ON customers(store_id);
                        CREATE INDEX IF NOT EXISTS idx_customers_doc ON customers(document_id);
                        CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);

                        -- SALES
                        CREATE TABLE IF NOT EXISTS sales (
                            id TEXT PRIMARY KEY,
                            store_id TEXT NOT NULL,
                            sold_at INTEGER NOT NULL,
                            total_usd REAL,
                            total_bs REAL,
                            payment_method TEXT,
                            json_data TEXT NOT NULL
                        );
                        CREATE INDEX IF NOT EXISTS idx_sales_store_date ON sales(store_id, sold_at DESC);
                    `
                },
                {
                    version: 2,
                    sql: `
                        -- LOCAL EVENTS (Sync Queue)
                        CREATE TABLE IF NOT EXISTS local_events (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            event_id TEXT UNIQUE NOT NULL,
                            store_id TEXT NOT NULL,
                            device_id TEXT NOT NULL,
                            seq INTEGER NOT NULL,
                            type TEXT NOT NULL,
                            payload TEXT NOT NULL,
                            sync_status TEXT NOT NULL,
                            sync_attempts INTEGER DEFAULT 0,
                            created_at INTEGER NOT NULL,
                            synced_at INTEGER,
                            next_retry_at INTEGER,
                            last_error TEXT,
                            vector_clock TEXT,
                            metadata TEXT
                        );
                        CREATE INDEX IF NOT EXISTS idx_events_status_created ON local_events(sync_status, created_at);
                        CREATE INDEX IF NOT EXISTS idx_events_retry ON local_events(sync_status, next_retry_at);
                        CREATE INDEX IF NOT EXISTS idx_events_store_device_seq ON local_events(store_id, device_id, seq);
                    `
                }
            ];

            // Get current version
            const result = await this.db.select<{ version: number }[]>('SELECT MAX(version) as version FROM schema_migrations');
            const currentVersion = result[0]?.version || 0;

            for (const migration of migrations) {
                if (migration.version > currentVersion) {
                    logger.info(`Running migration v${migration.version}`);
                    // Split by semicolon and run each statement
                    // Note: Tauri plugin might support executing multiple statements, 
                    // but safer to split complex schemas if needed, though execute() usually handles scripts.
                    await this.db.execute(migration.sql);
                    await this.db.execute('INSERT INTO schema_migrations (version, executed_at) VALUES (?, ?)', [migration.version, Date.now()]);
                }
            }

            logger.info('SQLite migrations executed successfully');
        } catch (error) {
            logger.error('Failed to execute SQLite migrations', error);
        }
    }

    /**
     * Execute a query (INSERT, UPDATE, DELETE)
     */
    public async execute(query: string, params: any[] = []): Promise<any> {
        if (!this.db) await this.initialize();
        if (!this.db) throw new Error('Database not initialized');
        return this.db.execute(query, params);
    }

    /**
     * Select multiple rows
     */
    public async select<T>(query: string, params: any[] = []): Promise<T[]> {
        if (!this.db) await this.initialize();
        if (!this.db) throw new Error('Database not initialized');
        return this.db.select<T[]>(query, params);
    }

    /**
     * Close the database connection
     */
    public async close(): Promise<void> {
        // Note: The plugin might not expose an explicit close, 
        // usually connections are managed by the Rust backend.
        this.db = null;
    }
}

export const sqliteService = SqliteService.getInstance();
