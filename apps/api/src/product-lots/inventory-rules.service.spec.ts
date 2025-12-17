import { Test, TestingModule } from '@nestjs/testing';
import { InventoryRulesService } from './inventory-rules.service';
import { ProductLot } from '../database/entities/product-lot.entity';

describe('InventoryRulesService', () => {
  let service: InventoryRulesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [InventoryRulesService],
    }).compile();

    service = module.get<InventoryRulesService>(InventoryRulesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getLotsForSale', () => {
    it('should allocate using FIFO', () => {
      const lots: ProductLot[] = [
        {
          id: 'lot-1',
          product_id: 'product-1',
          lot_number: 'LOT001',
          initial_quantity: 10,
          remaining_quantity: 10,
          unit_cost_bs: 10,
          unit_cost_usd: 1,
          received_at: new Date('2024-01-01'),
        } as ProductLot,
        {
          id: 'lot-2',
          product_id: 'product-1',
          lot_number: 'LOT002',
          initial_quantity: 20,
          remaining_quantity: 20,
          unit_cost_bs: 12,
          unit_cost_usd: 1.2,
          received_at: new Date('2024-01-15'),
        } as ProductLot,
      ];

      const allocations = service.getLotsForSale('product-1', 15, lots);

      expect(allocations).toHaveLength(2);
      expect(allocations[0].lot_id).toBe('lot-1');
      expect(allocations[0].quantity).toBe(10); // Todo el lote 1
      expect(allocations[1].lot_id).toBe('lot-2');
      expect(allocations[1].quantity).toBe(5); // 5 del lote 2
    });

    it('should throw if insufficient stock', () => {
      const lots: ProductLot[] = [
        {
          id: 'lot-1',
          product_id: 'product-1',
          remaining_quantity: 5,
          received_at: new Date('2024-01-01'),
        } as ProductLot,
      ];

      expect(() => {
        service.getLotsForSale('product-1', 10, lots);
      }).toThrow('Stock insuficiente');
    });
  });
});

