import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChartOfAccount, AccountType } from '../database/entities/chart-of-accounts.entity';
import { AccountingAccountMapping } from '../database/entities/accounting-account-mapping.entity';
import { CreateAccountDto } from './dto/create-account.dto';
import { getChartTemplate, getDefaultMappings, BusinessType } from './templates/chart-templates';
import { randomUUID } from 'crypto';

@Injectable()
export class ChartOfAccountsService {
  private readonly logger = new Logger(ChartOfAccountsService.name);

  constructor(
    @InjectRepository(ChartOfAccount)
    private accountRepository: Repository<ChartOfAccount>,
    @InjectRepository(AccountingAccountMapping)
    private mappingRepository: Repository<AccountingAccountMapping>,
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
   * Ahora soporta templates por tipo de negocio
   */
  async initializeDefaultChartOfAccounts(
    storeId: string,
    userId: string,
    businessType: BusinessType = 'general',
  ): Promise<{ accounts_created: number; mappings_created: number }> {
    // Usar template según tipo de negocio
    const defaultAccounts = getChartTemplate(businessType);

    const existingAccounts = await this.accountRepository.find({
      where: { store_id: storeId },
    });

    const accountMap = new Map<string, string>(); // code -> id
    for (const account of existingAccounts) {
      accountMap.set(account.account_code, account.id);
    }

    let accountsCreated = 0;

    for (const acc of defaultAccounts) {
      if (accountMap.has(acc.code)) {
        continue;
      }

      const parentId = acc.parent ? accountMap.get(acc.parent) || null : null;

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
      accountsCreated += 1;
    }

    // Obtener mapeos según tipo de negocio
    const mappingsToCreate = getDefaultMappings(businessType);

    const existingMappings = await this.mappingRepository.find({
      where: { store_id: storeId, is_active: true },
    });
    const existingMappingTypes = new Set(existingMappings.map((mapping) => mapping.transaction_type));
    let mappingsCreated = 0;

    for (const mapping of mappingsToCreate) {
      if (existingMappingTypes.has(mapping.transaction_type)) {
        continue;
      }

      const accountId = accountMap.get(mapping.account_code);
      if (!accountId) {
        this.logger.warn(
          `No se encontró cuenta ${mapping.account_code} para mapeo ${mapping.transaction_type}`,
        );
        continue;
      }

      const mappingEntity = this.mappingRepository.create({
        id: randomUUID(),
        store_id: storeId,
        transaction_type: mapping.transaction_type,
        account_id: accountId,
        account_code: mapping.account_code,
        is_default: true,
        is_active: true,
        created_by: userId,
      });

      await this.mappingRepository.save(mappingEntity);
      existingMappingTypes.add(mapping.transaction_type);
      mappingsCreated += 1;
    }

    this.logger.log(
      `Plan de cuentas inicializado para store ${storeId}: ${accountsCreated} cuentas, ${mappingsCreated} mapeos`,
    );

    return { accounts_created: accountsCreated, mappings_created: mappingsCreated };
  }
}








