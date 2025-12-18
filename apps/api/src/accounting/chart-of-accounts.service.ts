import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChartOfAccount, AccountType } from '../database/entities/chart-of-accounts.entity';
import { CreateAccountDto } from './dto/create-account.dto';
import { randomUUID } from 'crypto';

@Injectable()
export class ChartOfAccountsService {
  private readonly logger = new Logger(ChartOfAccountsService.name);

  constructor(
    @InjectRepository(ChartOfAccount)
    private accountRepository: Repository<ChartOfAccount>,
  ) {}

  /**
   * Crear cuenta contable
   */
  async createAccount(storeId: string, dto: CreateAccountDto, userId: string): Promise<ChartOfAccount> {
    // Validar que el código no exista
    const existing = await this.accountRepository.findOne({
      where: { store_id: storeId, account_code: dto.account_code },
    });

    if (existing) {
      throw new BadRequestException(`La cuenta ${dto.account_code} ya existe`);
    }

    // Validar cuenta padre si se proporciona
    if (dto.parent_account_id) {
      const parent = await this.accountRepository.findOne({
        where: { id: dto.parent_account_id, store_id: storeId },
      });

      if (!parent) {
        throw new NotFoundException('Cuenta padre no encontrada');
      }

      if (!parent.allows_entries) {
        throw new BadRequestException('La cuenta padre no permite crear subcuentas');
      }
    }

    const account = this.accountRepository.create({
      id: randomUUID(),
      store_id: storeId,
      account_code: dto.account_code,
      account_name: dto.account_name,
      account_type: dto.account_type,
      parent_account_id: dto.parent_account_id || null,
      level: dto.level || 1,
      is_active: dto.is_active ?? true,
      allows_entries: dto.allows_entries ?? true,
      description: dto.description,
      metadata: dto.metadata,
      created_by: userId,
    });

    return this.accountRepository.save(account);
  }

  /**
   * Obtener todas las cuentas
   */
  async getAccounts(storeId: string, activeOnly: boolean = false): Promise<ChartOfAccount[]> {
    const query = this.accountRepository.createQueryBuilder('account')
      .where('account.store_id = :storeId', { storeId })
      .orderBy('account.account_code', 'ASC');

    if (activeOnly) {
      query.andWhere('account.is_active = :active', { active: true });
    }

    return query.getMany();
  }

  /**
   * Obtener cuenta por ID
   */
  async getAccount(storeId: string, accountId: string): Promise<ChartOfAccount> {
    const account = await this.accountRepository.findOne({
      where: { id: accountId, store_id: storeId },
    });

    if (!account) {
      throw new NotFoundException('Cuenta no encontrada');
    }

    return account;
  }

  /**
   * Obtener cuenta por código
   */
  async getAccountByCode(storeId: string, accountCode: string): Promise<ChartOfAccount | null> {
    return this.accountRepository.findOne({
      where: { store_id: storeId, account_code: accountCode },
    });
  }

  /**
   * Actualizar cuenta
   */
  async updateAccount(
    storeId: string,
    accountId: string,
    updates: Partial<CreateAccountDto>,
  ): Promise<ChartOfAccount> {
    const account = await this.getAccount(storeId, accountId);

    // Si se cambia el código, validar que no exista
    if (updates.account_code && updates.account_code !== account.account_code) {
      const existing = await this.accountRepository.findOne({
        where: { store_id: storeId, account_code: updates.account_code },
      });

      if (existing) {
        throw new BadRequestException(`La cuenta ${updates.account_code} ya existe`);
      }
    }

    Object.assign(account, updates);
    return this.accountRepository.save(account);
  }

  /**
   * Eliminar cuenta (solo si no tiene movimientos)
   */
  async deleteAccount(storeId: string, accountId: string): Promise<void> {
    const account = await this.getAccount(storeId, accountId);

    // Verificar si tiene subcuentas
    const subAccounts = await this.accountRepository.count({
      where: { parent_account_id: accountId },
    });

    if (subAccounts > 0) {
      throw new BadRequestException('No se puede eliminar una cuenta que tiene subcuentas');
    }

    // TODO: Verificar si tiene movimientos en journal_entries
    // Por ahora permitimos eliminación

    await this.accountRepository.remove(account);
  }

  /**
   * Obtener árbol de cuentas (jerarquía)
   */
  async getAccountTree(storeId: string): Promise<ChartOfAccount[]> {
    const accounts = await this.getAccounts(storeId, true);
    
    // Construir árbol
    const accountMap = new Map<string, ChartOfAccount & { children?: ChartOfAccount[] }>();
    const rootAccounts: ChartOfAccount[] = [];

    // Crear mapa
    accounts.forEach((account) => {
      accountMap.set(account.id, { ...account, children: [] });
    });

    // Construir jerarquía
    accounts.forEach((account) => {
      const accountWithChildren = accountMap.get(account.id)!;
      
      if (account.parent_account_id) {
        const parent = accountMap.get(account.parent_account_id);
        if (parent) {
          if (!parent.children) {
            parent.children = [];
          }
          parent.children.push(accountWithChildren);
        }
      } else {
        rootAccounts.push(accountWithChildren);
      }
    });

    return rootAccounts;
  }

  /**
   * Inicializar plan de cuentas básico (para nuevos stores)
   */
  async initializeDefaultChartOfAccounts(storeId: string, userId: string): Promise<void> {
    const defaultAccounts = [
      // Activos
      { code: '1', name: 'ACTIVOS', type: 'asset' as AccountType, level: 1 },
      { code: '1.01', name: 'Activos Corrientes', type: 'asset' as AccountType, level: 2, parent: '1' },
      { code: '1.01.01', name: 'Caja', type: 'asset' as AccountType, level: 3, parent: '1.01' },
      { code: '1.01.02', name: 'Bancos', type: 'asset' as AccountType, level: 3, parent: '1.01' },
      { code: '1.01.03', name: 'Cuentas por Cobrar', type: 'asset' as AccountType, level: 3, parent: '1.01' },
      { code: '1.02', name: 'Activos No Corrientes', type: 'asset' as AccountType, level: 2, parent: '1' },
      { code: '1.02.01', name: 'Inventario', type: 'asset' as AccountType, level: 3, parent: '1.02' },
      
      // Pasivos
      { code: '2', name: 'PASIVOS', type: 'liability' as AccountType, level: 1 },
      { code: '2.01', name: 'Pasivos Corrientes', type: 'liability' as AccountType, level: 2, parent: '2' },
      { code: '2.01.01', name: 'Cuentas por Pagar', type: 'liability' as AccountType, level: 3, parent: '2.01' },
      
      // Patrimonio
      { code: '3', name: 'PATRIMONIO', type: 'equity' as AccountType, level: 1 },
      { code: '3.01', name: 'Capital', type: 'equity' as AccountType, level: 2, parent: '3' },
      
      // Ingresos
      { code: '4', name: 'INGRESOS', type: 'revenue' as AccountType, level: 1 },
      { code: '4.01', name: 'Ventas', type: 'revenue' as AccountType, level: 2, parent: '4' },
      { code: '4.01.01', name: 'Ventas de Productos', type: 'revenue' as AccountType, level: 3, parent: '4.01' },
      
      // Gastos
      { code: '5', name: 'GASTOS', type: 'expense' as AccountType, level: 1 },
      { code: '5.01', name: 'Costo de Ventas', type: 'expense' as AccountType, level: 2, parent: '5' },
      { code: '5.01.01', name: 'Costo de Productos Vendidos', type: 'expense' as AccountType, level: 3, parent: '5.01' },
      { code: '5.02', name: 'Gastos Operativos', type: 'expense' as AccountType, level: 2, parent: '5' },
    ];

    const accountMap = new Map<string, string>(); // code -> id

    for (const acc of defaultAccounts) {
      const parentId = acc.parent ? accountMap.get(acc.parent) : null;

      const account = this.accountRepository.create({
        id: randomUUID(),
        store_id: storeId,
        account_code: acc.code,
        account_name: acc.name,
        account_type: acc.type,
        parent_account_id: parentId || null,
        level: acc.level,
        is_active: true,
        allows_entries: acc.level >= 3, // Solo cuentas de nivel 3+ permiten asientos
        created_by: userId,
      });

      const saved = await this.accountRepository.save(account);
      accountMap.set(acc.code, saved.id);
    }

    this.logger.log(`Plan de cuentas inicializado para store ${storeId}`);
  }
}


