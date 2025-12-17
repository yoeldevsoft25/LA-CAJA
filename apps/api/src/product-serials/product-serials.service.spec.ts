import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ProductSerialsService } from './product-serials.service';
import { ProductSerial } from '../database/entities/product-serial.entity';
import { Product } from '../database/entities/product.entity';
import { Sale } from '../database/entities/sale.entity';
import { SaleItem } from '../database/entities/sale-item.entity';

describe('ProductSerialsService', () => {
  let service: ProductSerialsService;
  let serialRepository: Repository<ProductSerial>;
  let productRepository: Repository<Product>;

  const mockSerialRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockProductRepository = {
    findOne: jest.fn(),
  };

  const mockSaleRepository = {
    findOne: jest.fn(),
  };

  const mockSaleItemRepository = {
    findOne: jest.fn(),
  };

  const mockDataSource = {
    transaction: jest.fn((callback) => callback({})),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductSerialsService,
        {
          provide: getRepositoryToken(ProductSerial),
          useValue: mockSerialRepository,
        },
        {
          provide: getRepositoryToken(Product),
          useValue: mockProductRepository,
        },
        {
          provide: getRepositoryToken(Sale),
          useValue: mockSaleRepository,
        },
        {
          provide: getRepositoryToken(SaleItem),
          useValue: mockSaleItemRepository,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<ProductSerialsService>(ProductSerialsService);
    serialRepository = module.get<Repository<ProductSerial>>(
      getRepositoryToken(ProductSerial),
    );
    productRepository = module.get<Repository<Product>>(
      getRepositoryToken(Product),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createSerial', () => {
    it('should create a serial if product exists', async () => {
      mockProductRepository.findOne.mockResolvedValue({
        id: 'product-1',
        store_id: 'store-1',
      });
      mockSerialRepository.findOne.mockResolvedValue(null);
      mockSerialRepository.create.mockReturnValue({
        id: 'serial-1',
        product_id: 'product-1',
      });
      mockSerialRepository.save.mockResolvedValue({
        id: 'serial-1',
        product_id: 'product-1',
      });

      const dto = {
        product_id: 'product-1',
        serial_number: 'SN001',
        received_at: '2024-01-01T10:00:00Z',
      };

      const result = await service.createSerial('store-1', dto);

      expect(result).toBeDefined();
      expect(mockSerialRepository.save).toHaveBeenCalled();
    });

    it('should throw if product not found', async () => {
      mockProductRepository.findOne.mockResolvedValue(null);

      const dto = {
        product_id: 'product-1',
        serial_number: 'SN001',
        received_at: '2024-01-01T10:00:00Z',
      };

      await expect(service.createSerial('store-1', dto)).rejects.toThrow(
        'Producto no encontrado',
      );
    });
  });
});

