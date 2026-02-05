import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { ProjectionsService } from '../../projections/projections.service';
import { InventoryEscrowService } from './inventory-escrow.service';
import { Event } from '../../database/entities/event.entity';
import { Product } from '../../database/entities/product.entity';
import { ProductVariant } from '../../database/entities/product-variant.entity';
import { Warehouse } from '../../database/entities/warehouse.entity';
import { WarehouseStock } from '../../database/entities/warehouse-stock.entity';
import { StockEscrow } from '../../database/entities/stock-escrow.entity';
import { InventoryMovement } from '../../database/entities/inventory-movement.entity';
import { Sale } from '../../database/entities/sale.entity';
import { SaleItem } from '../../database/entities/sale-item.entity';
import { Store } from '../../database/entities/store.entity';
import { CashSession } from '../../database/entities/cash-session.entity';
import { CashLedgerEntry } from '../../database/entities/cash-ledger-entry.entity';
import { WarehousesService } from '../../warehouses/warehouses.service';
import { FederationSyncService } from '../../sync/federation-sync.service';
import { getMetadataArgsStorage } from 'typeorm';

describe('Stock Convergence Integration (Offline -> Sync -> Projections)', () => {
    let moduleFixture: TestingModule;
    let projectionsService: ProjectionsService;
    let dataSource: DataSource;
    let storeId: string;
    let productId: string;
    let deviceId: string;

    beforeAll(async () => {
        // Patch Entities for Sqlite
        const columns = getMetadataArgsStorage().columns;
        columns.forEach(col => {
            if (col.options.type === 'jsonb') col.options.type = 'simple-json';
            if (col.options.type === 'timestamptz') col.options.type = 'datetime';
            if (col.options.default && typeof col.options.default === 'string' && col.options.default.toUpperCase().includes('NOW()')) {
                col.options.default = () => 'CURRENT_TIMESTAMP';
            }
        });

        moduleFixture = await Test.createTestingModule({
            imports: [
                TypeOrmModule.forRoot({
                    type: 'sqlite',
                    database: ':memory:',
                    entities: [
                        Event, Product, ProductVariant, Warehouse, WarehouseStock,
                        StockEscrow, InventoryMovement, Sale, SaleItem, Store,
                        CashSession, CashLedgerEntry
                    ],
                    synchronize: true,
                    logging: false,
                }),
                TypeOrmModule.forFeature([
                    Event, Product, ProductVariant, Warehouse, WarehouseStock,
                    StockEscrow, InventoryMovement, Sale, SaleItem, Store,
                    CashSession, CashLedgerEntry
                ])
            ],
            providers: [
                ProjectionsService,
                { provide: WarehousesService, useValue: { updateStock: jest.fn().mockResolvedValue(true) } },
                { provide: FederationSyncService, useValue: { queueRelay: jest.fn().mockResolvedValue(true) } },
            ]
        }).compile();

        projectionsService = moduleFixture.get<ProjectionsService>(ProjectionsService);
        dataSource = moduleFixture.get<DataSource>(DataSource);

        // Seed basic data
        storeId = uuidv4();
        productId = uuidv4();
        deviceId = uuidv4();

        await dataSource.manager.save(Store, { id: storeId, name: 'Test Store', license_status: 'active' });
        await dataSource.manager.save(Product, { id: productId, store_id: storeId, name: 'Test Product', price_usd: 10, cost_usd: 5 });

        const warehouse = await dataSource.manager.save(Warehouse, {
            id: uuidv4(), store_id: storeId, name: 'Main', code: 'WH1', type: 'STORE', is_active: true, status: 'OPERATIONAL'
        });

        await dataSource.manager.save(WarehouseStock, {
            store_id: storeId, warehouse_id: warehouse.id, product_id: productId, qty: 100
        });
    });

    afterAll(async () => {
        await moduleFixture.close();
    });

    it('should correctly balance stock between warehouse and escrow after multiple sales', async () => {
        // 1. Grant Escrow Quota (10 units)
        // Simulate StockQuotaGranted event projection
        await projectionsService.projectStockQuotaGranted(storeId, {
            product_id: productId,
            device_id: deviceId,
            qty_granted: 10,
            request_id: uuidv4()
        });

        // Verify state: Escrow = 10, WarehouseStock = 90 (WarehousesService.updateStock was called with -10)
        // Wait, in my projection updatedStock is called. 
        // Let's check ProjectionsService.projectStockQuotaGranted
        const escrow = await dataSource.manager.findOne(StockEscrow, { where: { product_id: productId, device_id: deviceId } });
        expect(Number(escrow?.qty_granted)).toBe(10);

        // 2. Simulate Sale (5 units) using the escrow
        // This is done via projectSaleCreated
        const saleId = uuidv4();
        await projectionsService.projectSaleCreated(storeId, {
            sale_id: saleId,
            device_id: deviceId,
            sold_at: new Date(),
            items: [{
                product_id: productId,
                qty: 5,
                unit_price_usd: 10
            }],
            totals: { total_usd: 50 },
            payment: { method: 'CASH_USD' }
        } as any);

        // Verify state: Escrow = 5, WarehouseStock still 90 (Movement created but WarehouseStock not touched if escrow sufficient)
        const escrowAfterSale = await dataSource.manager.findOne(StockEscrow, { where: { product_id: productId, device_id: deviceId } });
        expect(Number(escrowAfterSale?.qty_granted)).toBe(5);

        // Check InventoryMovement
        const movement = await dataSource.manager.findOne(InventoryMovement, { where: { ref: { sale_id: saleId } } });
        expect(movement?.from_escrow).toBe(true);
        expect(Number(movement?.qty_delta)).toBe(-5);

        // 3. Simulate another Sale (10 units) - Consumes rest of escrow and touches warehouse
        const saleId2 = uuidv4();
        await projectionsService.projectSaleCreated(storeId, {
            sale_id: saleId2,
            device_id: deviceId,
            sold_at: new Date(),
            items: [{
                product_id: productId,
                qty: 10,
                unit_price_usd: 10
            }],
            totals: { total_usd: 100 }
        } as any);

        // Verify state: Escrow = 0, WarehouseStock should have been updated by -5 (via WarehousesService.updateStock)
        const escrowFinal = await dataSource.manager.findOne(StockEscrow, { where: { product_id: productId, device_id: deviceId } });
        expect(Number(escrowFinal?.qty_granted)).toBe(0);

        // In this case, ProjectionsService should have called updateStock with -5
        const warehousesService = moduleFixture.get<WarehousesService>(WarehousesService);
        // First call was -10 (for grant), second should be -5 (for over-consumption)
        // Wait, the projection logic for Sale handles split consumption.
        expect(warehousesService.updateStock).toHaveBeenCalledWith(
            expect.anything(), productId, null, -5, expect.anything(), expect.anything()
        );
    });
});
