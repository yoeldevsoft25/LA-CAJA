import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CashMovement,
  CashMovementType,
} from '../database/entities/cash-movement.entity';
import { CreateCashMovementDto } from './dto/create-cash-movement.dto';
import { randomUUID } from 'crypto';

/**
 * Servicio para gestión de bitácora de movimientos de efectivo
 */
@Injectable()
export class CashMovementsService {
  constructor(
    @InjectRepository(CashMovement)
    private cashMovementRepository: Repository<CashMovement>,
  ) {}

  /**
   * Registra un movimiento de efectivo (entrada o salida)
   */
  async createMovement(
    storeId: string,
    userId: string,
    dto: CreateCashMovementDto,
  ): Promise<CashMovement> {
    const movement = this.cashMovementRepository.create({
      id: randomUUID(),
      store_id: storeId,
      shift_id: dto.shift_id || null,
      cash_session_id: dto.cash_session_id || null,
      movement_type:
        dto.movement_type === 'entry'
          ? CashMovementType.ENTRY
          : CashMovementType.EXIT,
      amount_bs: dto.amount_bs,
      amount_usd: dto.amount_usd,
      reason: dto.reason,
      note: dto.note || null,
      created_by: userId,
    });

    return this.cashMovementRepository.save(movement);
  }

  /**
   * Obtiene los movimientos de efectivo de una tienda
   */
  async getMovements(
    storeId: string,
    limit: number = 50,
    offset: number = 0,
    shiftId?: string,
    cashSessionId?: string,
  ): Promise<{ movements: CashMovement[]; total: number }> {
    const query = this.cashMovementRepository
      .createQueryBuilder('movement')
      .where('movement.store_id = :storeId', { storeId })
      .orderBy('movement.created_at', 'DESC');

    if (shiftId) {
      query.andWhere('movement.shift_id = :shiftId', { shiftId });
    }

    if (cashSessionId) {
      query.andWhere('movement.cash_session_id = :cashSessionId', {
        cashSessionId,
      });
    }

    const total = await query.getCount();
    query.limit(limit).offset(offset);

    const movements = await query.getMany();

    return { movements, total };
  }

  /**
   * Obtiene el resumen de movimientos de efectivo
   */
  async getMovementsSummary(
    storeId: string,
    shiftId?: string,
    cashSessionId?: string,
  ): Promise<{
    total_entries_bs: number;
    total_entries_usd: number;
    total_exits_bs: number;
    total_exits_usd: number;
    net_bs: number;
    net_usd: number;
  }> {
    const query = this.cashMovementRepository
      .createQueryBuilder('movement')
      .where('movement.store_id = :storeId', { storeId });

    if (shiftId) {
      query.andWhere('movement.shift_id = :shiftId', { shiftId });
    }

    if (cashSessionId) {
      query.andWhere('movement.cash_session_id = :cashSessionId', {
        cashSessionId,
      });
    }

    const movements = await query.getMany();

    let totalEntriesBs = 0;
    let totalEntriesUsd = 0;
    let totalExitsBs = 0;
    let totalExitsUsd = 0;

    for (const movement of movements) {
      if (movement.movement_type === CashMovementType.ENTRY) {
        totalEntriesBs += Number(movement.amount_bs || 0);
        totalEntriesUsd += Number(movement.amount_usd || 0);
      } else {
        totalExitsBs += Number(movement.amount_bs || 0);
        totalExitsUsd += Number(movement.amount_usd || 0);
      }
    }

    return {
      total_entries_bs: Math.round(totalEntriesBs * 100) / 100,
      total_entries_usd: Math.round(totalEntriesUsd * 100) / 100,
      total_exits_bs: Math.round(totalExitsBs * 100) / 100,
      total_exits_usd: Math.round(totalExitsUsd * 100) / 100,
      net_bs: Math.round((totalEntriesBs - totalExitsBs) * 100) / 100,
      net_usd: Math.round((totalEntriesUsd - totalExitsUsd) * 100) / 100,
    };
  }
}
