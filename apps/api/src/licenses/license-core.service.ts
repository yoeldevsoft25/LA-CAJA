import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import {
    SubscriptionPlan,
    StoreLicense,
    LicenseStatus,
    LicenseUsage
} from '../database/entities';
import { Store } from '../database/entities/store.entity';

@Injectable()
export class LicenseService {
    private readonly logger = new Logger(LicenseService.name);

    constructor(
        @InjectRepository(SubscriptionPlan)
        private planRepo: Repository<SubscriptionPlan>,
        @InjectRepository(Store)
        private storeRepo: Repository<Store>,
        @InjectRepository(LicenseUsage)
        private usageRepo: Repository<LicenseUsage>,
        private jwtService: JwtService,
    ) { }

    /**
     * Obtiene el estado detallado de la licencia de una tienda
     */
    async getLicenseStatus(storeId: string) {
        const store = await this.storeRepo.findOne({
            where: { id: storeId },
        });

        if (!store) {
            // Should not happen for valid requests
            return this.getFreemiumStatus(storeId);
        }

        // Si no tiene plan asignado, es Freemium
        if (!store.license_plan) {
            return this.getFreemiumStatus(storeId);
        }

        const planCode = store.license_plan?.toUpperCase();
        const plan =
            (planCode
                ? await this.planRepo.findOne({ where: { code: planCode } })
                : null) ||
            (store.license_plan
                ? await this.planRepo.findOne({ where: { code: store.license_plan } })
                : null);
        const usage = await this.usageRepo.find({ where: { store_id: storeId } });

        // Mapear uso a un objeto plano
        const usageMap = usage.reduce((acc, curr) => {
            acc[curr.metric] = curr.used;
            return acc;
        }, {} as Record<string, number>);

        return {
            plan: store.license_plan || (planCode ? planCode.toLowerCase() : 'freemium'),
            status: store.license_status,
            expires_at: store.license_expires_at,
            features: plan?.features || [], // Usar features del plan base
            limits: plan?.limits || {},     // Usar limites del plan base
            usage: usageMap,
        };
    }

    /**
     * Genera un token JWT firmado para uso offline (PWA/Android)
     */
    async issueOfflineToken(storeId: string) {
        const status = await this.getLicenseStatus(storeId);

        const payload = {
            sub: storeId,
            plan: status.plan,
            status: status.status,
            features: status.features,
            limits: status.limits,
            expires_at: status.expires_at,
            iat: Math.floor(Date.now() / 1000),
        };

        return this.jwtService.sign(payload, {
            expiresIn: '7d', // El token offline dura 7 días por defecto
            secret: process.env.JWT_SECRET || 'offline-secret-key'
        });
    }

    /**
     * Verifica si una tienda tiene acceso a una funcionalidad específica
     */
    async checkFeature(storeId: string, feature: string): Promise<boolean> {
        const status = await this.getLicenseStatus(storeId);

        if (status.status !== LicenseStatus.ACTIVE && status.status !== LicenseStatus.PAST_DUE) {
            return false;
        }

        return status.features.includes(feature);
    }

    private async getFreemiumStatus(storeId: string) {
        const freemiumPlan =
            (await this.planRepo.findOne({ where: { code: 'FREEMIUM' } })) ||
            (await this.planRepo.findOne({ where: { code: 'freemium' } }));
        return {
            plan: 'freemium',
            status: LicenseStatus.ACTIVE,
            expires_at: null,
            features: freemiumPlan?.features || [],
            limits: freemiumPlan?.limits || {},
            usage: {},
        };
    }
}
