import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductVariantsService } from './product-variants.service';
import { ProductVariant } from '../database/entities/product-variant.entity';
import { Product } from '../database/entities/product.entity';
import { InventoryMovement } from '../database/entities/inventory-movement.entity';

describe('ProductVariantsService', () => {
  let service: ProductVariantsService;
  let variantRepository: Repository<ProductVariant>;
  let productRepository: Repository<Product>;
  let movementRepository: Repository<InventoryMovement>;

  const mockVariantRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockProductRepository = {
    findOne: jest.fn(),
  };

  const mockMovementRepository = {
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductVariantsService,
        {
          provide: getRepositoryToken(ProductVariant),
          useValue: mockVariantRepository,
        },
        {
          provide: getRepositoryToken(Product),
          useValue: mockProductRepository,
        },
        {
          provide: getRepositoryToken(InventoryMovement),
          useValue: mockMovementRepository,
        },
      ],
    }).compile();

    service = module.get<ProductVariantsService>(ProductVariantsService);
    variantRepository = module.get<Repository<ProductVariant>>(
      getRepositoryToken(ProductVariant),
    );
    productRepository = module.get<Repository<Product>>(
      getRepositoryToken(Product),
    );
    movementRepository = module.get<Repository<InventoryMovement>>(
      getRepositoryToken(InventoryMovement),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createVariant', () => {
    it('should create a variant if product exists', async () => {
      mockProductRepository.findOne.mockResolvedValue({
        id: 'product-1',
        store_id: 'store-1',
      });
      mockVariantRepository.findOne.mockResolvedValue(null);
      mockVariantRepository.create.mockReturnValue({
        id: 'variant-1',
        product_id: 'product-1',
      });
      mockVariantRepository.save.mockResolvedValue({
        id: 'variant-1',
        product_id: 'product-1',
      });

      const dto = {
        product_id: 'product-1',
        variant_type: 'size',
        variant_value: 'M',
      };

      const result = await service.createVariant('store-1', dto);

      expect(result).toBeDefined();
      expect(mockVariantRepository.save).toHaveBeenCalled();
    });

    it('should throw if product not found', async () => {
      mockProductRepository.findOne.mockResolvedValue(null);

      const dto = {
        product_id: 'product-1',
        variant_type: 'size',
        variant_value: 'M',
      };

      await expect(service.createVariant('store-1', dto)).rejects.toThrow(
        'Producto no encontrado',
      );
    });
  });
});

