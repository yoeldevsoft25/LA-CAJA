// Mock ESM modules behaving badly in Jest (Baileys)
jest.mock('@whiskeysockets/baileys', () => ({
    default: jest.fn(),
    useMultiFileAuthState: jest.fn(),
    DisconnectReason: {},
    Browsers: { ubuntu: jest.fn() },
    makeCacheableSignalKeyStore: jest.fn(),
}));

// Mock modules that import the bad ESM modules
jest.mock('../projections/projections.module', () => ({
    ProjectionsModule: class MockProjectionsModule { }
}));
jest.mock('../whatsapp/whatsapp.module', () => ({
    WhatsAppModule: class MockWhatsAppModule { }
}));

import { Test, TestingModule } from '@nestjs/testing';
import { SalesService } from './sales.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConfigModule } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { Sale } from '../database/entities/sale.entity';
import { SaleItem } from '../database/entities/sale-item.entity';
import { Product } from '../database/entities/product.entity';
import { SaleReturn } from '../database/entities/sale-return.entity';
import { SaleReturnItem } from '../database/entities/sale-return-item.entity';
import { Debt, DebtStatus } from '../database/entities/debt.entity';
import { DebtPayment } from '../database/entities/debt-payment.entity';
import { InventoryMovement } from '../database/entities/inventory-movement.entity';
import { Store } from '../database/entities/store.entity';
import { Profile } from '../database/entities/profile.entity';
import { Customer } from '../database/entities/customer.entity';
import { ProductVariant } from '../database/entities/product-variant.entity';
import { ProductLot } from '../database/entities/product-lot.entity';
import { Warehouse } from '../database/entities/warehouse.entity';
import { RecipeIngredient } from '../database/entities/recipe-ingredient.entity';
import { InvoiceSeries } from '../database/entities/invoice-series.entity';
import { WarehouseStock } from '../database/entities/warehouse-stock.entity';
import { Transfer } from '../database/entities/transfer.entity';
import { TransferItem } from '../database/entities/transfer-item.entity';
import { LotMovement } from '../database/entities/lot-movement.entity';
import { v4 as uuidv4 } from 'uuid';
import { INestApplication } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ReturnSaleDto } from './dto/return-sale.dto';
import { getMetadataArgsStorage } from 'typeorm';

// Services and Handlers
import { SalesReturnDomainService } from './domain/services/sales-return-domain.service';
import { SalesReturnValidationService } from './domain/services/sales-return-validation.service';
import { SalesReturnInventoryService } from './domain/services/sales-return-inventory.service';
import { SalesReturnFinancialService } from './domain/services/sales-return-financial.service';
import { ReturnItemsHandler } from './application/commands/return-items/return-items.handler';
import { ReturnSaleHandler } from './application/commands/return-sale/return-sale.handler';
import { WarehousesService } from '../warehouses/warehouses.service';
import { ProductSerial } from '../database/entities/product-serial.entity';
import { FiscalInvoice } from '../database/entities/fiscal-invoice.entity';
import { FiscalInvoiceItem } from '../database/entities/fiscal-invoice-item.entity';

// Mocks for queues not needed but BullModule requires mock
import { QueuesModule } from '../queues/queues.module';

describe('Sales Returns Integration (Transactional - Sqlite)', () => {
    let moduleFixture: TestingModule;
    let service: SalesService;
    let dataSource: DataSource;

    beforeAll(async () => {
        // Patch Entities for Sqlite (timeout: DB connect + sync can be slow in CI)
        jest.setTimeout(15000);
        const columns = getMetadataArgsStorage().columns;
        columns.forEach(col => {
            if (col.options.type === 'jsonb') {
                col.options.type = 'simple-json';
            }
            if (col.options.type === 'timestamptz') {
                col.options.type = 'datetime';
            }
            // SQLite: default must be constant; avoid [object Object]
            if (col.options.default !== undefined && typeof col.options.default === 'object' && !Array.isArray(col.options.default) && col.options.default !== null) {
                col.options.default = JSON.stringify(col.options.default);
            }
            // Patch NOW() default
            if (col.options.default) {
                const def = typeof col.options.default === 'function' ? col.options.default() : col.options.default;
                if (typeof def === 'string' && def.toUpperCase().includes('NOW()')) {
                    col.options.default = () => 'CURRENT_TIMESTAMP';
                }
            }
        });

        moduleFixture = await Test.createTestingModule({
            imports: [
                ConfigModule.forRoot({
                    isGlobal: true,
                    ignoreEnvFile: true,
                    load: [() => ({
                        THROTTLE_TTL: 60,
                        THROTTLE_LIMIT: 100,
                        DB_SSL_REJECT_UNAUTHORIZED: 'false',
                        NODE_ENV: 'test',
                    })],
                }),
                BullModule.forRoot({
                    connection: { host: 'localhost', port: 6379 }
                }),
                CqrsModule,
                TypeOrmModule.forRoot({
                    type: 'sqlite',
                    database: ':memory:',
                    entities: [
                        Sale, SaleItem, SaleReturn, SaleReturnItem,
                        Product, ProductVariant, ProductLot, RecipeIngredient,
                        InventoryMovement, Warehouse, WarehouseStock, Transfer, TransferItem,
                        Debt, DebtPayment,
                        Store, Profile, Customer, InvoiceSeries, LotMovement,
                        ProductSerial, FiscalInvoice, FiscalInvoiceItem
                    ],
                    synchronize: true,
                    dropSchema: true,
                    logger: 'advanced-console',
                    logging: ['error', 'warn'],
                }),
                TypeOrmModule.forFeature([
                    Sale, SaleItem, SaleReturn, SaleReturnItem,
                    Product, InventoryMovement, Customer, Profile, Debt, DebtPayment
                ])
            ],
            providers: [
                SalesService,
                SalesReturnDomainService,
                SalesReturnValidationService,
                SalesReturnInventoryService,
                SalesReturnFinancialService,
                ReturnItemsHandler,
                ReturnSaleHandler,
                {
                    provide: WarehousesService,
                    useValue: {
                        getDefaultOrFirst: jest.fn().mockResolvedValue({ id: 'warehouse-1' }),
                        updateStock: jest.fn().mockResolvedValue(true)
                    }
                }
            ]
        })
            .overrideModule(QueuesModule)
            .useModule(class MockQueuesModule { })
            .compile();

        await moduleFixture.init();

        service = moduleFixture.get<SalesService>(SalesService);
        dataSource = moduleFixture.get<DataSource>(DataSource);

        await seedStaticData(dataSource);
    });

    afterAll(async () => {
        if (moduleFixture) await moduleFixture.close();
    });

    const seedStaticData = async (ds: DataSource) => {
        const store = new Store();
        store.id = 'store-1';
        store.name = 'Test Store';
        store.created_at = new Date();
        store.license_status = 'active';
        store.license_grace_days = 3;
        await ds.manager.save(store);

        const profile = new Profile();
        profile.id = 'user-1';
        profile.email = 'test@example.com';
        profile.created_at = new Date();
        await ds.manager.save(profile);

        const customer = new Customer();
        customer.id = 'customer-1';
        customer.store_id = 'store-1';
        customer.name = 'Test Customer';
        customer.created_at = new Date();
        customer.updated_at = new Date();
        await ds.manager.save(customer);

        const warehouse = new Warehouse();
        warehouse.id = 'warehouse-1';
        warehouse.store_id = 'store-1';
        warehouse.name = 'Main Warehouse';
        warehouse.code = 'WH-001';
        warehouse.type = 'STORE';
        warehouse.created_at = new Date();
        warehouse.updated_at = new Date();
        warehouse.capacity = 1000;
        warehouse.is_active = true;
        warehouse.is_default = true;
        warehouse.status = 'OPERATIONAL';
        await ds.manager.save(warehouse);
    };

    // Helper to seed data
    const seedSale = async (shouldBePaid = false) => {
        const product = new Product();
        product.id = uuidv4();
        product.name = 'Test Product';
        product.price_usd = 100;
        product.price_bs = 0;
        product.cost_usd = 50;
        product.cost_bs = 0;
        product.store_id = 'store-1';
        product.is_weight_product = false;
        await dataSource.manager.save(product);

        const sale = new Sale();
        sale.id = uuidv4();
        sale.store_id = 'store-1';
        sale.sold_by_user_id = 'user-1';
        sale.totals = {
            subtotal_bs: 0,
            subtotal_usd: 200,
            discount_bs: 0,
            discount_usd: 0,
            total_bs: 0,
            total_usd: 200,
        };
        sale.sold_at = new Date();
        sale.exchange_rate = 1;
        sale.currency = 'USD';
        sale.payment = { method: 'CASH_USD' };

        await dataSource.manager.save(sale);

        const item1 = new SaleItem();
        item1.id = uuidv4();
        item1.sale_id = sale.id;
        item1.product_id = product.id;
        item1.qty = 2;
        item1.unit_price_usd = 100;
        item1.unit_price_bs = 0;
        await dataSource.manager.save(item1);

        // Reload with relations
        return dataSource.manager.findOne(Sale, {
            where: { id: sale.id },
            relations: ['items']
        });
    };

    // Create movement to link item to warehouse
    const seedInventoryMovement = async (saleId: string, productId: string, qty: number) => {
        const movement = new InventoryMovement();
        movement.id = uuidv4();
        movement.store_id = 'store-1';
        movement.ref = { sale_id: saleId };
        movement.product_id = productId;
        movement.warehouse_id = 'warehouse-1';
        movement.qty_delta = -qty;
        movement.movement_type = 'sale';
        movement.happened_at = new Date();

        await dataSource.manager.save(movement);
    };

    describe('returnItems (Partial Return)', () => {
        it('should create return header, return items, adjust debt, and create stock movement', async () => {
            const sale = await seedSale(false);
            if (!sale) throw new Error('Sale seeding failed');

            const item = sale.items[0];

            // Setup Debt
            const debt = new Debt();
            debt.id = uuidv4();
            debt.sale_id = sale.id;
            debt.store_id = sale.store_id;
            debt.amount_usd = sale.totals.total_usd;
            debt.amount_bs = 0;
            debt.created_at = new Date();
            debt.status = DebtStatus.OPEN;
            debt.customer_id = 'customer-1';

            await dataSource.manager.save(debt);

            await seedInventoryMovement(sale.id, item.product_id, item.qty);

            const dto: ReturnSaleDto = {
                items: [
                    {
                        sale_item_id: item.id,
                        qty: 1,
                    }
                ],
                reason: 'Defective'
            };

            const result = await service.returnItems(
                'store-1',
                sale.id,
                dto,
                'user-1'
            );

            expect(result).toBeDefined();
            expect(result.items).toHaveLength(1);
            expect(Number(result.items[0].qty)).toBe(1);

            // Verify validations
            const updatedSale = await dataSource.manager.findOne(Sale, { where: { id: sale.id } });
            if (!updatedSale) throw new Error('Sale not found');

            expect(Number(updatedSale.totals.total_usd)).toBe(100);

            // Verify Debt
            const updatedDebt = await dataSource.manager.findOne(Debt, { where: { sale_id: sale.id } });
            if (!updatedDebt) throw new Error('Debt not found');

            expect(Number(updatedDebt.amount_usd)).toBe(100);
            expect(updatedDebt.status).toBe(DebtStatus.OPEN);

            // Verify Inventory Movement
            const movements = await dataSource.manager.find(InventoryMovement, {
                where: { store_id: 'store-1', product_id: item.product_id }
            });
            const returnMove = movements.find(m => Number(m.qty_delta) > 0);
            expect(returnMove).toBeDefined();
            expect(Number(returnMove!.qty_delta)).toBe(1);
        });
    });

    describe('returnSale (Full Return)', () => {
        it('should return all items, zero out debt, and update sale totals', async () => {
            const sale = await seedSale(false);
            if (!sale) throw new Error('Sale seeding failed');
            const item = sale.items[0];

            // Setup Debt
            const debt = new Debt();
            debt.id = uuidv4();
            debt.sale_id = sale.id;
            debt.store_id = sale.store_id;
            debt.amount_usd = sale.totals.total_usd;
            debt.amount_bs = 0;
            debt.created_at = new Date();
            debt.status = DebtStatus.OPEN;
            debt.customer_id = 'customer-1';
            await dataSource.manager.save(debt);

            await seedInventoryMovement(sale.id, item.product_id, item.qty);

            const result = await service.returnSale(
                'store-1',
                sale.id,
                'user-1',
                'Client changed mind'
            );

            expect(result).toBeDefined();
            expect(result.items).toHaveLength(1);
            expect(Number(result.items[0].qty)).toBe(2);

            const updatedSale = await dataSource.manager.findOne(Sale, { where: { id: sale.id } });
            if (!updatedSale) throw new Error('Sale not found');
            expect(Number(updatedSale.totals.total_usd)).toBe(0);

            const updatedDebt = await dataSource.manager.findOne(Debt, { where: { sale_id: sale.id } });
            if (!updatedDebt) throw new Error('Debt not found');
            expect(Number(updatedDebt.amount_usd)).toBe(0);
            expect(updatedDebt.status).toBe(DebtStatus.PAID);
        });

        it('should rejection return if debt has payments', async () => {
            const sale = await seedSale(false);
            if (!sale) throw new Error('Sale seeding failed');

            const debt = new Debt();
            debt.id = uuidv4();
            debt.sale_id = sale.id;
            debt.store_id = sale.store_id;
            debt.amount_usd = sale.totals.total_usd;
            debt.created_at = new Date();
            debt.status = DebtStatus.OPEN;
            debt.customer_id = 'customer-1';
            await dataSource.manager.save(debt);

            const payment = new DebtPayment();
            payment.id = uuidv4();
            payment.debt_id = debt.id;
            payment.amount_usd = 50;
            payment.amount_bs = 0;
            payment.store_id = sale.store_id;
            payment.paid_at = new Date();
            payment.method = 'CASH_USD';
            await dataSource.manager.save(payment);

            // Expect failure
            await expect(service.returnSale(
                'store-1',
                sale.id,
                'user-1',
            )).rejects.toThrow('La venta tiene pagos asociados. Debes reversar los pagos antes de la devolución.');
        });
    });
});
