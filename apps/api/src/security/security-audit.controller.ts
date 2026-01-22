import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { SecurityAuditService } from './security-audit.service';

@Controller('security/audit')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SecurityAuditController {
  constructor(private readonly securityAuditService: SecurityAuditService) {}

  @Roles('owner')
  @Get('suspicious')
  async getSuspiciousActivityReport(
    @Query('start_date') startDate: string,
    @Query('end_date') endDate: string,
    @Query('limit') limit: string,
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    return this.securityAuditService.getSuspiciousActivityReport(
      storeId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
      limit ? parseInt(limit, 10) : 50,
    );
  }
}
