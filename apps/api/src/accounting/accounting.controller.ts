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
  HttpCode,
  HttpStatus,
  Res,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ChartOfAccountsService } from './chart-of-accounts.service';
import { AccountingService } from './accounting.service';
import { AccountingExportService } from './accounting-export.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { CreateJournalEntryDto } from './dto/create-journal-entry.dto';
import { GetJournalEntriesDto } from './dto/get-journal-entries.dto';
import { CreateAccountMappingDto } from './dto/create-account-mapping.dto';
import { ExportAccountingDto } from './dto/export-accounting.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccountingAccountMapping } from '../database/entities/accounting-account-mapping.entity';
import { randomUUID } from 'crypto';

@Controller('accounting')
@UseGuards(JwtAuthGuard)
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
  async initializeChartOfAccounts(@Request() req: any) {
    const storeId = req.user.store_id;
    const userId = req.user.user_id;
    await this.chartOfAccountsService.initializeDefaultChartOfAccounts(storeId, userId);
    return { message: 'Plan de cuentas inicializado exitosamente' };
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
    return this.mappingRepository.find({
      where: { store_id: storeId, is_active: true },
      order: { transaction_type: 'ASC' },
    });
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
      account_id: dto.account_id,
      account_code: dto.account_code,
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
    @Res() res: Response,
  ) {
    const storeId = req.user.store_id;
    const { filePath, fileName } = await this.exportService.getExportFile(storeId, exportId);

    res.download(filePath, fileName, (err) => {
      if (err) {
        res.status(500).json({ message: 'Error descargando archivo' });
      }
    });
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
}

