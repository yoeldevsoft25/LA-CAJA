import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Res,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { FastifyReply } from 'fastify';
import * as fs from 'fs';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ChartOfAccountsService } from './chart-of-accounts.service';
import { AccountingService } from './accounting.service';
import { AccountingExportService } from './accounting-export.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { CreateJournalEntryDto } from './dto/create-journal-entry.dto';
import { GetJournalEntriesDto } from './dto/get-journal-entries.dto';
import { CreateAccountMappingDto } from './dto/create-account-mapping.dto';
import { ExportAccountingDto } from './dto/export-accounting.dto';
import { GetBalanceSheetDto } from './dto/get-balance-sheet.dto';
import { GetIncomeStatementDto } from './dto/get-income-statement.dto';
import { GetTrialBalanceDto } from './dto/get-trial-balance.dto';
import { GetGeneralLedgerDto } from './dto/get-general-ledger.dto';
import { GetCashFlowDto } from './dto/get-cash-flow.dto';
import { ClosePeriodDto } from './dto/close-period.dto';
import { ReopenPeriodDto } from './dto/reopen-period.dto';
import { ValidateAccountingDto, ReconcileAccountsDto } from './dto/validate-accounting.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccountingAccountMapping } from '../database/entities/accounting-account-mapping.entity';
import { randomUUID } from 'crypto';

@Controller('accounting')
@UseGuards(JwtAuthGuard)
@Roles('owner')
export class AccountingController {
  constructor(
    private readonly chartOfAccountsService: ChartOfAccountsService,
    private readonly accountingService: AccountingService,
    private readonly exportService: AccountingExportService,
    @InjectRepository(AccountingAccountMapping)
    private mappingRepository: Repository<AccountingAccountMapping>,
  ) {}

  /**
   * Plan de Cuentas
   */
  @Get('accounts')
  async getAccounts(
    @Request() req: any,
    @Query('active_only') activeOnly?: string,
  ) {
    const storeId = req.user.store_id;
    return this.chartOfAccountsService.getAccounts(storeId, activeOnly === 'true');
  }

  @Get('accounts/tree')
  async getAccountTree(@Request() req: any) {
    const storeId = req.user.store_id;
    return this.chartOfAccountsService.getAccountTree(storeId);
  }

  @Post('accounts')
  async createAccount(@Request() req: any, @Body() dto: CreateAccountDto) {
    const storeId = req.user.store_id;
    const userId = req.user.user_id;
    return this.chartOfAccountsService.createAccount(storeId, dto, userId);
  }

  @Get('accounts/:id')
  async getAccount(@Request() req: any, @Param('id') accountId: string) {
    const storeId = req.user.store_id;
    return this.chartOfAccountsService.getAccount(storeId, accountId);
  }

  @Put('accounts/:id')
  async updateAccount(
    @Request() req: any,
    @Param('id') accountId: string,
    @Body() dto: Partial<CreateAccountDto>,
  ) {
    const storeId = req.user.store_id;
    return this.chartOfAccountsService.updateAccount(storeId, accountId, dto);
  }

  @Delete('accounts/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAccount(@Request() req: any, @Param('id') accountId: string) {
    const storeId = req.user.store_id;
    await this.chartOfAccountsService.deleteAccount(storeId, accountId);
  }

  @Post('accounts/initialize')
  @HttpCode(HttpStatus.OK)
  async initializeChartOfAccounts(
    @Request() req: any,
    @Body() body?: { business_type?: 'retail' | 'services' | 'restaurant' | 'general' },
  ) {
    const storeId = req.user.store_id;
    const userId = req.user.user_id;
    const businessType = body?.business_type || 'general';
    const { accounts_created, mappings_created } =
      await this.chartOfAccountsService.initializeDefaultChartOfAccounts(storeId, userId, businessType);
    return {
      message: 'Plan de cuentas inicializado exitosamente',
      accounts_created,
      mappings_created,
    };
  }

  /**
   * Asientos Contables
   */
  @Get('entries')
  async getJournalEntries(@Request() req: any, @Query() dto: GetJournalEntriesDto) {
    const storeId = req.user.store_id;
    return this.accountingService.getJournalEntries(storeId, dto);
  }

  @Post('entries')
  async createJournalEntry(@Request() req: any, @Body() dto: CreateJournalEntryDto) {
    const storeId = req.user.store_id;
    const userId = req.user.user_id;
    return this.accountingService.createJournalEntry(storeId, dto, userId);
  }

  @Get('entries/:id')
  async getJournalEntry(@Request() req: any, @Param('id') entryId: string) {
    const storeId = req.user.store_id;
    return this.accountingService.getJournalEntry(storeId, entryId);
  }

  @Post('entries/:id/post')
  @HttpCode(HttpStatus.OK)
  async postEntry(@Request() req: any, @Param('id') entryId: string) {
    const storeId = req.user.store_id;
    const userId = req.user.user_id;
    return this.accountingService.postEntry(storeId, entryId, userId);
  }

  @Post('entries/:id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelEntry(
    @Request() req: any,
    @Param('id') entryId: string,
    @Body('reason') reason: string,
  ) {
    const storeId = req.user.store_id;
    const userId = req.user.user_id;
    return this.accountingService.cancelEntry(storeId, entryId, userId, reason);
  }

  /**
   * Mapeo de Cuentas
   */
  @Get('mappings')
  async getAccountMappings(@Request() req: any) {
    const storeId = req.user.store_id;
    const mappings = await this.mappingRepository.find({
      where: { store_id: storeId, is_active: true },
      order: { transaction_type: 'ASC' },
      relations: ['account'],
    });

    return mappings.map(({ account, ...mapping }) => ({
      ...mapping,
      account_name: account?.account_name || null,
    }));
  }

  @Post('mappings')
  async createAccountMapping(@Request() req: any, @Body() dto: CreateAccountMappingDto) {
    const storeId = req.user.store_id;
    const userId = req.user.user_id;

    // Verificar que la cuenta existe
    const account = await this.chartOfAccountsService.getAccount(storeId, dto.account_id);

    const mapping = this.mappingRepository.create({
      id: randomUUID(),
      store_id: storeId,
      transaction_type: dto.transaction_type,
      account_id: account.id,
      account_code: account.account_code,
      is_default: dto.is_default ?? false,
      conditions: dto.conditions || null,
      is_active: dto.is_active ?? true,
      created_by: userId,
    });

    return this.mappingRepository.save(mapping);
  }

  @Put('mappings/:id')
  async updateAccountMapping(
    @Request() req: any,
    @Param('id') mappingId: string,
    @Body() dto: Partial<CreateAccountMappingDto>,
  ) {
    const storeId = req.user.store_id;
    const mapping = await this.mappingRepository.findOne({
      where: { id: mappingId, store_id: storeId },
    });

    if (!mapping) {
      throw new NotFoundException('Mapeo no encontrado');
    }

    Object.assign(mapping, dto);

    if (dto.account_id) {
      const account = await this.chartOfAccountsService.getAccount(storeId, dto.account_id);
      mapping.account_id = account.id;
      mapping.account_code = account.account_code;
    }
    return this.mappingRepository.save(mapping);
  }

  @Delete('mappings/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAccountMapping(@Request() req: any, @Param('id') mappingId: string) {
    const storeId = req.user.store_id;
    await this.mappingRepository.delete({ id: mappingId, store_id: storeId });
  }

  /**
   * Exportaciones
   */
  @Post('export')
  async exportAccounting(@Request() req: any, @Body() dto: ExportAccountingDto) {
    const storeId = req.user.store_id;
    const userId = req.user.user_id;
    return this.exportService.exportAccounting(storeId, dto, userId);
  }

  @Get('exports')
  async getExports(@Request() req: any, @Query('limit') limit?: string) {
    const storeId = req.user.store_id;
    return this.exportService.getExports(storeId, limit ? parseInt(limit, 10) : 20);
  }

  @Get('exports/:id/download')
  async downloadExport(
    @Request() req: any,
    @Param('id') exportId: string,
    @Res() res: FastifyReply,
  ) {
    const storeId = req.user.store_id;
    const { filePath, fileName } = await this.exportService.getExportFile(storeId, exportId);

    try {
      const fileStream = fs.createReadStream(filePath);
      res.header('Content-Type', 'application/octet-stream');
      res.header('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(fileStream);
    } catch (error) {
      res.status(500).send({ message: 'Error descargando archivo' });
    }
  }

  /**
   * Balance de Cuentas
   */
  @Get('balance/:accountId')
  async getAccountBalance(
    @Request() req: any,
    @Param('accountId') accountId: string,
    @Query('start_date') startDate: string,
    @Query('end_date') endDate: string,
  ) {
    const storeId = req.user.store_id;
    return this.accountingService.getAccountBalance(
      storeId,
      accountId,
      new Date(startDate),
      new Date(endDate),
    );
  }

  /**
   * Balance General
   */
  @Get('reports/balance-sheet')
  async getBalanceSheet(
    @Request() req: any,
    @Query() dto: GetBalanceSheetDto,
  ) {
    const storeId = req.user.store_id;
    const asOfDate = dto.as_of_date ? new Date(dto.as_of_date) : new Date();
    return this.accountingService.getBalanceSheet(storeId, asOfDate);
  }

  /**
   * Estado de Resultados (Pérdidas y Ganancias)
   */
  @Get('reports/income-statement')
  async getIncomeStatement(
    @Request() req: any,
    @Query() dto: GetIncomeStatementDto,
  ) {
    const storeId = req.user.store_id;
    return this.accountingService.getIncomeStatement(
      storeId,
      new Date(dto.start_date),
      new Date(dto.end_date),
    );
  }

  /**
   * Trial Balance (Balance de Comprobación)
   */
  @Get('reports/trial-balance')
  async getTrialBalance(
    @Request() req: any,
    @Query() dto: GetTrialBalanceDto,
  ) {
    const storeId = req.user.store_id;
    const asOfDate = dto.as_of_date ? new Date(dto.as_of_date) : new Date();
    const includeZeroBalance = dto.include_zero_balance === true;
    return this.accountingService.getTrialBalance(storeId, asOfDate, includeZeroBalance);
  }

  /**
   * Libro Mayor (General Ledger)
   */
  @Get('reports/general-ledger')
  async getGeneralLedger(
    @Request() req: any,
    @Query() dto: GetGeneralLedgerDto,
  ) {
    const storeId = req.user.store_id;
    return this.accountingService.getGeneralLedger(
      storeId,
      new Date(dto.start_date),
      new Date(dto.end_date),
      dto.account_ids,
    );
  }

  /**
   * Estado de Flujo de Efectivo (Cash Flow Statement)
   */
  @Get('reports/cash-flow')
  async getCashFlow(
    @Request() req: any,
    @Query() dto: GetCashFlowDto,
  ) {
    const storeId = req.user.store_id;
    return this.accountingService.getCashFlowStatement(
      storeId,
      new Date(dto.start_date),
      new Date(dto.end_date),
      dto.method || 'indirect',
    );
  }

  /**
   * Cerrar período contable
   */
  @Post('periods/close')
  @HttpCode(HttpStatus.OK)
  async closePeriod(
    @Request() req: any,
    @Body() dto: ClosePeriodDto,
  ) {
    const storeId = req.user.store_id;
    const userId = req.user.sub;
    return this.accountingService.closePeriod(
      storeId,
      new Date(dto.period_start),
      new Date(dto.period_end),
      userId,
      dto.note,
    );
  }

  /**
   * Reabrir período contable
   */
  @Post('periods/:periodCode/reopen')
  @HttpCode(HttpStatus.OK)
  async reopenPeriod(
    @Request() req: any,
    @Param('periodCode') periodCode: string,
    @Body() dto: ReopenPeriodDto,
  ) {
    const storeId = req.user.store_id;
    const userId = req.user.sub;
    return this.accountingService.reopenPeriod(
      storeId,
      periodCode,
      userId,
      dto.reason,
    );
  }

  /**
   * Obtener períodos contables
   */
  @Get('periods')
  async getPeriods(
    @Request() req: any,
    @Query('status') status?: string,
  ) {
    const storeId = req.user.store_id;
    // TODO: Implementar método en servicio para listar períodos
    // Por ahora retornar lista vacía
    return [];
  }

  /**
   * Validación avanzada de integridad contable
   */
  @Get('validate')
  async validateAccounting(
    @Request() req: any,
    @Query() dto: ValidateAccountingDto,
  ) {
    const storeId = req.user.store_id;
    return this.accountingService.validateAccountingIntegrity(
      storeId,
      dto.start_date ? new Date(dto.start_date) : undefined,
      dto.end_date ? new Date(dto.end_date) : undefined,
    );
  }

  /**
   * Reconciliación de cuentas
   */
  @Post('reconcile')
  async reconcileAccounts(
    @Request() req: any,
    @Body() dto: ReconcileAccountsDto,
  ) {
    const storeId = req.user.store_id;
    return this.accountingService.reconcileAccounts(
      storeId,
      dto.account_ids,
      dto.as_of_date ? new Date(dto.as_of_date) : new Date(),
    );
  }

  /**
   * Recalcular y corregir totales de asientos desbalanceados
   */
  @Post('recalculate-totals')
  @HttpCode(HttpStatus.OK)
  async recalculateEntryTotals(
    @Request() req: any,
    @Body() body?: { entry_ids?: string[] },
  ) {
    const storeId = req.user.store_id;
    return this.accountingService.recalculateEntryTotals(
      storeId,
      body?.entry_ids,
    );
  }
}
