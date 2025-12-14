import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Header,
} from '@nestjs/common';
import { BackupService } from './backup.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('backup')
@UseGuards(JwtAuthGuard)
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  @Get()
  async createBackup(@Request() req: any) {
    const storeId = req.user.store_id;
    return this.backupService.createBackup(storeId);
  }

  @Post('restore')
  @HttpCode(HttpStatus.OK)
  async restoreFromBackup(
    @Body() body: { products?: any[]; customers?: any[] },
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    return this.backupService.restoreFromBackup(storeId, body);
  }

  @Get('export')
  @Header('Content-Type', 'application/json')
  @Header('Content-Disposition', 'attachment; filename=backup.json')
  async exportBackup(@Request() req: any) {
    const storeId = req.user.store_id;
    const backup = await this.backupService.createBackup(storeId);
    return JSON.stringify(backup, null, 2);
  }
}

