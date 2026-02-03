import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { SupplierPriceList } from '../database/entities/supplier-price-list.entity';
import { SupplierPriceListItem } from '../database/entities/supplier-price-list-item.entity';
import { Supplier } from '../database/entities/supplier.entity';
import { ImportSupplierPriceListDto } from './dto/import-supplier-price-list.dto';
import { SearchSupplierPriceItemsDto } from './dto/search-supplier-price-items.dto';
import { randomUUID } from 'crypto';

type ParsedPriceRow = {
  product_code: string;
  product_name: string;
  units_per_case: number | null;
  price_a: number | null;
  price_b: number | null;
  unit_price_a: number | null;
  unit_price_b: number | null;
  supplier_name: string | null;
  source_date: Date | null;
  row: number;
};

@Injectable()
export class SupplierPriceListsService {
  private readonly logger = new Logger(SupplierPriceListsService.name);

  constructor(
    @InjectRepository(SupplierPriceList)
    private listRepository: Repository<SupplierPriceList>,
    @InjectRepository(SupplierPriceListItem)
    private itemRepository: Repository<SupplierPriceListItem>,
    @InjectRepository(Supplier)
    private supplierRepository: Repository<Supplier>,
  ) {}

  private normalizeHeader(value: string): string {
    const normalized = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');

    const aliases: Record<string, string> = {
      productcode: 'product_code',
      productname: 'product_name',
      unitspercase: 'units_per_case',
      unitpricea: 'unit_price_a',
      unitpriceb: 'unit_price_b',
      pricea: 'price_a',
      priceb: 'price_b',
    };

    return aliases[normalized] || normalized;
  }

  private detectDelimiter(headerLine: string): string {
    const candidates = [',', '\t', ';'];
    let best = ',';
    let bestCount = 0;

    for (const candidate of candidates) {
      const count = headerLine.split(candidate).length - 1;
      if (count > bestCount) {
        best = candidate;
        bestCount = count;
      }
    }

    return best;
  }

  private parseCSVLine(line: string, delimiter: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
        continue;
      }

      if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = '';
        continue;
      }

      current += char;
    }

    result.push(current.trim());
    return result;
  }

  private parseNumber(value: string | undefined): number | null {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;

    let normalized = trimmed.replace(/[^0-9.,-]/g, '');
    if (!normalized) return null;

    const hasComma = normalized.includes(',');
    const hasDot = normalized.includes('.');

    if (hasComma && !hasDot) {
      normalized = normalized.replace(',', '.');
    } else if (hasComma && hasDot) {
      normalized = normalized.replace(/,/g, '');
    }

    const parsed = parseFloat(normalized);
    return Number.isNaN(parsed) ? null : parsed;
  }

  private parseDate(value: string | undefined): Date | null {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const date = new Date(`${trimmed}T00:00:00Z`);
      return Number.isNaN(date.getTime()) ? null : date;
    }

    const match = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (match) {
      const day = parseInt(match[1], 10);
      const month = parseInt(match[2], 10);
      const year = parseInt(
        match[3].length === 2 ? `20${match[3]}` : match[3],
        10,
      );
      const date = new Date(Date.UTC(year, month - 1, day));
      return Number.isNaN(date.getTime()) ? null : date;
    }

    const date = new Date(trimmed);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private extractRows(csv: string): {
    rows: ParsedPriceRow[];
    errors: { row: number; message: string }[];
  } {
    const lines = csv
      .replace(/\ufeff/g, '')
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0);

    if (lines.length < 2) {
      throw new BadRequestException('El archivo CSV está vacío o incompleto');
    }

    const delimiter = this.detectDelimiter(lines[0]);
    const rawHeaders = this.parseCSVLine(lines[0], delimiter);
    const headers = rawHeaders.map((header) => this.normalizeHeader(header));

    const headerIndex: Record<string, number> = {};
    headers.forEach((header, index) => {
      headerIndex[header] = index;
    });

    if (
      headerIndex.product_code === undefined ||
      headerIndex.product_name === undefined
    ) {
      throw new BadRequestException(
        'El CSV debe incluir las columnas Product_Code y Product_Name',
      );
    }

    const rows: ParsedPriceRow[] = [];
    const errors: { row: number; message: string }[] = [];

    for (let i = 1; i < lines.length; i++) {
      const columns = this.parseCSVLine(lines[i], delimiter);
      const rowNumber = i + 1;

      const getValue = (key: string): string | undefined => {
        const index = headerIndex[key];
        if (index === undefined) return undefined;
        return columns[index];
      };

      const productCode = (getValue('product_code') || '').trim();
      const productName = (getValue('product_name') || '').trim();

      if (!productCode || !productName) {
        errors.push({
          row: rowNumber,
          message: 'Faltan Product_Code o Product_Name',
        });
        continue;
      }

      const unitsPerCase = this.parseNumber(getValue('units_per_case'));
      const priceA = this.parseNumber(getValue('price_a'));
      const priceB = this.parseNumber(getValue('price_b'));
      let unitPriceA = this.parseNumber(getValue('unit_price_a'));
      let unitPriceB = this.parseNumber(getValue('unit_price_b'));

      if (!unitPriceA && priceA != null && unitsPerCase) {
        unitPriceA = priceA / unitsPerCase;
      }
      if (!unitPriceB && priceB != null && unitsPerCase) {
        unitPriceB = priceB / unitsPerCase;
      }

      if (
        unitPriceA == null &&
        unitPriceB == null &&
        priceA == null &&
        priceB == null
      ) {
        errors.push({
          row: rowNumber,
          message:
            'Fila sin precios válidos (Price_A/Price_B/Unit_Price_A/Unit_Price_B)',
        });
        continue;
      }

      rows.push({
        product_code: productCode,
        product_name: productName,
        units_per_case: unitsPerCase ?? null,
        price_a: priceA ?? null,
        price_b: priceB ?? null,
        unit_price_a: unitPriceA ?? null,
        unit_price_b: unitPriceB ?? null,
        supplier_name: (getValue('supplier') || '').trim() || null,
        source_date: this.parseDate(getValue('date')),
        row: rowNumber,
      });
    }

    return { rows, errors };
  }

  private buildListName(supplierName: string, sourceDate: Date | null): string {
    const datePart = sourceDate
      ? sourceDate.toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    return `Lista ${supplierName} ${datePart}`.trim();
  }

  private async resolveSupplierId(
    storeId: string,
    supplierId: string | null,
    supplierName: string | null,
  ): Promise<{ id: string | null; name: string | null }> {
    if (supplierId) {
      const supplier = await this.supplierRepository.findOne({
        where: { id: supplierId, store_id: storeId },
      });
      if (!supplier) {
        throw new NotFoundException('Proveedor no encontrado');
      }
      return { id: supplier.id, name: supplier.name };
    }

    if (supplierName) {
      const supplier = await this.supplierRepository.findOne({
        where: { store_id: storeId, name: ILike(supplierName) },
      });
      if (supplier) {
        return { id: supplier.id, name: supplier.name };
      }
    }

    return { id: null, name: supplierName };
  }

  async importFromCSV(storeId: string, dto: ImportSupplierPriceListDto) {
    const { rows, errors } = this.extractRows(dto.csv);

    if (rows.length === 0) {
      throw new BadRequestException('No hay filas válidas para importar');
    }

    const forcedSupplier = dto.supplier_id
      ? await this.supplierRepository.findOne({
          where: { id: dto.supplier_id, store_id: storeId },
        })
      : null;

    if (dto.supplier_id && !forcedSupplier) {
      throw new NotFoundException('Proveedor no encontrado');
    }

    const forcedSupplierName =
      dto.supplier_name?.trim() || forcedSupplier?.name || null;

    const grouped = new Map<string, ParsedPriceRow[]>();

    for (const row of rows) {
      const supplierKey =
        forcedSupplierName || row.supplier_name || 'Proveedor sin nombre';

      if (!grouped.has(supplierKey)) {
        grouped.set(supplierKey, []);
      }
      grouped.get(supplierKey)!.push(row);
    }

    const summaries: Array<{
      id: string;
      name: string;
      supplier_name: string;
      items: number;
    }> = [];

    for (const [supplierName, groupRows] of grouped.entries()) {
      const supplierInfo = forcedSupplier
        ? {
            id: forcedSupplier.id,
            name: forcedSupplierName || forcedSupplier.name,
          }
        : await this.resolveSupplierId(storeId, null, supplierName);

      const dates = groupRows
        .map((row) => row.source_date)
        .filter((date): date is Date => Boolean(date));
      const sourceDate = dates.length
        ? new Date(Math.max(...dates.map((date) => date.getTime())))
        : null;

      const listName = dto.list_name?.trim()
        ? dto.list_name.trim()
        : this.buildListName(supplierInfo.name || supplierName, sourceDate);

      const list = this.listRepository.create({
        id: randomUUID(),
        store_id: storeId,
        supplier_id: supplierInfo.id,
        supplier_name: supplierInfo.name || supplierName,
        name: listName,
        currency: dto.currency || 'USD',
        source_date: sourceDate,
        is_active: true,
        imported_at: new Date(),
      });

      await this.listRepository.save(list);

      const items = groupRows.map((row) =>
        this.itemRepository.create({
          id: randomUUID(),
          list_id: list.id,
          product_code: row.product_code,
          product_name: row.product_name,
          units_per_case: row.units_per_case,
          price_a: row.price_a,
          price_b: row.price_b,
          unit_price_a: row.unit_price_a,
          unit_price_b: row.unit_price_b,
          supplier_name: row.supplier_name || supplierInfo.name || supplierName,
          source_date: row.source_date,
        }),
      );

      await this.itemRepository.save(items, { chunk: 500 });

      summaries.push({
        id: list.id,
        name: list.name,
        supplier_name: list.supplier_name || supplierName,
        items: items.length,
      });
    }

    this.logger.log(
      `Importadas ${rows.length} filas en ${summaries.length} listas de precio de proveedores`,
    );

    return {
      total_rows: rows.length,
      imported_rows: rows.length,
      lists: summaries,
      errors,
    };
  }

  async getLists(storeId: string, supplierId?: string) {
    const query = this.listRepository
      .createQueryBuilder('list')
      .leftJoin('supplier_price_list_items', 'item', 'item.list_id = list.id')
      .select('list.id', 'id')
      .addSelect('list.name', 'name')
      .addSelect('list.supplier_id', 'supplier_id')
      .addSelect('list.supplier_name', 'supplier_name')
      .addSelect('list.currency', 'currency')
      .addSelect('list.source_date', 'source_date')
      .addSelect('list.imported_at', 'imported_at')
      .addSelect('list.is_active', 'is_active')
      .addSelect('COUNT(item.id)', 'items_count')
      .where('list.store_id = :storeId', { storeId })
      .groupBy('list.id')
      .orderBy('list.imported_at', 'DESC');

    if (supplierId) {
      query.andWhere('list.supplier_id = :supplierId', { supplierId });
    }

    return query.getRawMany();
  }

  private async getLatestList(
    storeId: string,
    supplierId?: string,
  ): Promise<SupplierPriceList | null> {
    const query = this.listRepository
      .createQueryBuilder('list')
      .where('list.store_id = :storeId', { storeId })
      .andWhere('list.is_active = true')
      .orderBy('COALESCE(list.source_date, list.imported_at)', 'DESC')
      .addOrderBy('list.imported_at', 'DESC');

    if (supplierId) {
      query.andWhere('list.supplier_id = :supplierId', { supplierId });
    }

    return query.getOne();
  }

  async searchItems(storeId: string, dto: SearchSupplierPriceItemsDto) {
    let list: SupplierPriceList | null = null;

    if (dto.list_id) {
      list = await this.listRepository.findOne({
        where: { id: dto.list_id, store_id: storeId },
      });
    } else if (dto.supplier_id) {
      list = await this.getLatestList(storeId, dto.supplier_id);
    }

    if (!list) {
      throw new NotFoundException('No hay listas de precio disponibles');
    }

    const query = this.itemRepository
      .createQueryBuilder('item')
      .where('item.list_id = :listId', { listId: list.id });

    if (dto.search) {
      query.andWhere(
        '(item.product_code ILIKE :search OR item.product_name ILIKE :search)',
        { search: `%${dto.search}%` },
      );
    }

    query.orderBy('item.product_name', 'ASC');

    if (dto.limit) {
      query.take(dto.limit);
    }
    if (dto.offset) {
      query.skip(dto.offset);
    }

    const [items, total] = await query.getManyAndCount();

    return {
      list: {
        id: list.id,
        name: list.name,
        supplier_id: list.supplier_id,
        supplier_name: list.supplier_name,
        currency: list.currency,
        source_date: list.source_date,
      },
      items,
      total,
    };
  }
}
