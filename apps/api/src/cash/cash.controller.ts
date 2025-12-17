import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CashService } from './cash.service';
import { OpenCashSessionDto } from './dto/open-cash-session.dto';
import { CloseCashSessionDto } from './dto/close-cash-session.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('cash')
@UseGuards(JwtAuthGuard)
export class CashController {
  constructor(private readonly cashService: CashService) {}

  @Post('sessions/open')
  @HttpCode(HttpStatus.CREATED)
  async openSession(@Body() dto: OpenCashSessionDto, @Request() req: any) {
    const storeId = req.user.store_id;
    const userId = req.user.sub; // ID del usuario autenticado
    return this.cashService.openSession(storeId, userId, dto);
  }

  @Get('sessions/current')
  async getCurrentSession(@Request() req: any) {
    const storeId = req.user.store_id;
    return this.cashService.getCurrentSession(storeId);
  }

  @Post('sessions/:id/close')
  async closeSession(
    @Param('id') sessionId: string,
    @Body() dto: CloseCashSessionDto,
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    const userId = req.user.sub; // ID del usuario autenticado
    return this.cashService.closeSession(storeId, userId, sessionId, dto);
  }

  @Get('sessions/:id/summary')
  async getSessionSummary(@Param('id') sessionId: string, @Request() req: any) {
    const storeId = req.user.store_id;
    return this.cashService.getSessionSummary(sessionId, storeId);
  }

  @Get('sessions')
  async listSessions(
    @Query('limit') limit: string,
    @Query('offset') offset: string,
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    return this.cashService.listSessions(
      storeId,
      limit ? parseInt(limit, 10) : 50,
      offset ? parseInt(offset, 10) : 0,
    );
  }
}
