import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DiscountAuthorization } from '../database/entities/discount-authorization.entity';
import { Sale } from '../database/entities/sale.entity';
import { AuthorizeDiscountDto } from './dto/authorize-discount.dto';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';

/**
 * Servicio para gestión de autorizaciones de descuentos
 */
@Injectable()
export class DiscountAuthorizationsService {
  constructor(
    @InjectRepository(DiscountAuthorization)
    private authorizationRepository: Repository<DiscountAuthorization>,
    @InjectRepository(Sale)
    private saleRepository: Repository<Sale>,
  ) {}

  /**
   * Crea una autorización de descuento para una venta
   */
  async createAuthorization(
    storeId: string,
    userId: string,
    userRole: string,
    dto: AuthorizeDiscountDto,
    discountAmountBs: number,
    discountAmountUsd: number,
    discountPercentage: number,
    pinHash?: string | null,
  ): Promise<DiscountAuthorization> {
    // Verificar que la venta existe y pertenece a la tienda
    const sale = await this.saleRepository.findOne({
      where: { id: dto.sale_id, store_id: storeId },
    });

    if (!sale) {
      throw new NotFoundException('Venta no encontrada');
    }

    // Verificar que la venta tiene descuentos
    const totals = sale.totals as any;
    const saleDiscountBs = Number(totals.discount_bs || 0);
    const saleDiscountUsd = Number(totals.discount_usd || 0);

    if (saleDiscountBs === 0 && saleDiscountUsd === 0) {
      throw new BadRequestException(
        'La venta no tiene descuentos para autorizar',
      );
    }

    // Verificar que los montos coinciden
    const tolerance = 0.01;
    if (
      Math.abs(saleDiscountBs - discountAmountBs) > tolerance ||
      Math.abs(saleDiscountUsd - discountAmountUsd) > tolerance
    ) {
      throw new BadRequestException(
        'Los montos de descuento no coinciden con la venta',
      );
    }

    // Hash del PIN si se proporcionó
    let finalPinHash: string | null = null;
    if (dto.authorization_pin) {
      finalPinHash = await bcrypt.hash(dto.authorization_pin, 10);
    } else if (pinHash) {
      finalPinHash = pinHash;
    }

    const authorization = this.authorizationRepository.create({
      id: randomUUID(),
      sale_id: dto.sale_id,
      store_id: storeId,
      discount_amount_bs: discountAmountBs,
      discount_amount_usd: discountAmountUsd,
      discount_percentage: discountPercentage,
      authorized_by: userId,
      authorization_pin_hash: finalPinHash,
      reason: dto.reason || null,
    });

    return this.authorizationRepository.save(authorization);
  }

  /**
   * Obtiene las autorizaciones de una venta
   */
  async getAuthorizationsBySale(
    saleId: string,
    storeId: string,
  ): Promise<DiscountAuthorization[]> {
    return this.authorizationRepository.find({
      where: { sale_id: saleId, store_id: storeId },
      relations: ['authorizer'],
      order: { authorized_at: 'DESC' },
    });
  }

  /**
   * Obtiene todas las autorizaciones de una tienda
   */
  async getAuthorizations(
    storeId: string,
    limit: number = 50,
    offset: number = 0,
    startDate?: Date,
    endDate?: Date,
  ): Promise<{ authorizations: DiscountAuthorization[]; total: number }> {
    const query = this.authorizationRepository
      .createQueryBuilder('auth')
      .where('auth.store_id = :storeId', { storeId })
      .orderBy('auth.authorized_at', 'DESC');

    if (startDate) {
      query.andWhere('auth.authorized_at >= :startDate', { startDate });
    }

    if (endDate) {
      query.andWhere('auth.authorized_at <= :endDate', { endDate });
    }

    const total = await query.getCount();
    query.limit(limit).offset(offset);

    const authorizations = await query
      .leftJoinAndSelect('auth.authorizer', 'authorizer')
      .leftJoinAndSelect('auth.sale', 'sale')
      .getMany();

    return { authorizations, total };
  }

  /**
   * Obtiene el resumen de descuentos autorizados
   */
  async getDiscountSummary(
    storeId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    total_discounts_bs: number;
    total_discounts_usd: number;
    count: number;
    average_percentage: number;
    by_authorizer: Record<string, number>;
  }> {
    const query = this.authorizationRepository
      .createQueryBuilder('auth')
      .where('auth.store_id = :storeId', { storeId });

    if (startDate) {
      query.andWhere('auth.authorized_at >= :startDate', { startDate });
    }

    if (endDate) {
      query.andWhere('auth.authorized_at <= :endDate', { endDate });
    }

    const authorizations = await query.getMany();

    let totalDiscountsBs = 0;
    let totalDiscountsUsd = 0;
    let totalPercentage = 0;
    const byAuthorizer: Record<string, number> = {};

    for (const auth of authorizations) {
      totalDiscountsBs += Number(auth.discount_amount_bs || 0);
      totalDiscountsUsd += Number(auth.discount_amount_usd || 0);
      totalPercentage += Number(auth.discount_percentage || 0);

      const authorizerId = auth.authorized_by;
      byAuthorizer[authorizerId] =
        (byAuthorizer[authorizerId] || 0) +
        Number(auth.discount_amount_bs || 0);
    }

    return {
      total_discounts_bs: Math.round(totalDiscountsBs * 100) / 100,
      total_discounts_usd: Math.round(totalDiscountsUsd * 100) / 100,
      count: authorizations.length,
      average_percentage:
        authorizations.length > 0
          ? Math.round((totalPercentage / authorizations.length) * 100) / 100
          : 0,
      by_authorizer: byAuthorizer,
    };
  }
}
