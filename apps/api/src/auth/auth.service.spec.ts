import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../notifications/services/email.service';
import { UsageService } from '../licenses/usage.service';
import { DataSource } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Store } from '../database/entities/store.entity';
import { Profile } from '../database/entities/profile.entity';
import { StoreMember } from '../database/entities/store-member.entity';
import { RefreshToken } from '../database/entities/refresh-token.entity';
import { EmailVerificationToken } from '../database/entities/email-verification-token.entity';
import { PinRecoveryToken } from '../database/entities/pin-recovery-token.entity';
import { TwoFactorAuth } from '../database/entities/two-factor-auth.entity';
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt', () => ({
    hash: jest.fn().mockResolvedValue('hashed_secret'),
    compare: jest.fn().mockResolvedValue(true),
}));

const mockRepository = () => ({
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
});

const mockJwtService = () => ({
    sign: jest.fn(() => 'access_token'),
});

const mockConfigService = () => ({
    get: jest.fn(),
});

const mockEmailService = () => ({
    sendEmail: jest.fn(),
    isAvailable: jest.fn(() => true),
});

const mockUsageService = () => ({
    increment: jest.fn(),
});

const mockDataSource = () => ({
    createQueryRunner: jest.fn(() => ({
        connect: jest.fn(),
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
        manager: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
        },
        isTransactionActive: true,
    })),
});

describe('AuthService', () => {
    let service: AuthService;
    let refreshTokenRepository: any;
    let storeMemberRepository: any;
    let storeRepository: any;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthService,
                { provide: JwtService, useFactory: mockJwtService },
                { provide: ConfigService, useFactory: mockConfigService },
                { provide: EmailService, useFactory: mockEmailService },
                { provide: UsageService, useFactory: mockUsageService },
                { provide: DataSource, useFactory: mockDataSource },
                { provide: getRepositoryToken(Store), useFactory: mockRepository },
                { provide: getRepositoryToken(Profile), useFactory: mockRepository },
                { provide: getRepositoryToken(StoreMember), useFactory: mockRepository },
                { provide: getRepositoryToken(RefreshToken), useFactory: mockRepository },
                { provide: getRepositoryToken(EmailVerificationToken), useFactory: mockRepository },
                { provide: getRepositoryToken(PinRecoveryToken), useFactory: mockRepository },
                { provide: getRepositoryToken(TwoFactorAuth), useFactory: mockRepository },
            ],
        }).compile();

        service = module.get<AuthService>(AuthService);
        refreshTokenRepository = module.get(getRepositoryToken(RefreshToken));
        storeMemberRepository = module.get(getRepositoryToken(StoreMember));
        storeRepository = module.get(getRepositoryToken(Store));
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('refreshToken', () => {
        const refreshTokenValue = 'valid_token';
        const storeId = 'store_1';
        const userId = 'user_1';

        it('should refresh token successfully', async () => {
            const mockRefreshToken = {
                token: expect.any(String),
                user_id: userId,
                store_id: storeId,
                expires_at: new Date(Date.now() + 100000),
                revoked_at: null,
                store: {
                    license_status: 'active',
                    license_expires_at: new Date(Date.now() + 100000),
                },
            };

            refreshTokenRepository.findOne.mockResolvedValue(mockRefreshToken);
            storeMemberRepository.findOne.mockResolvedValue({
                role: 'owner',
            });
            refreshTokenRepository.create.mockReturnValue({});
            refreshTokenRepository.save.mockResolvedValue({});

            const result = await service.refreshToken(refreshTokenValue);

            expect(result).toHaveProperty('access_token');
            expect(result).toHaveProperty('refresh_token');
        });

        it('should throw UnauthorizedException if token not found', async () => {
            refreshTokenRepository.findOne.mockResolvedValue(null);
            await expect(service.refreshToken('invalid_token')).rejects.toThrow(UnauthorizedException);
        });

        it('should throw UnauthorizedException if token expired', async () => {
            const mockRefreshToken = {
                token: expect.any(String),
                user_id: userId,
                store_id: storeId,
                expires_at: new Date(Date.now() - 1000), // Expired
                revoked_at: null,
                store: {},
            };

            refreshTokenRepository.findOne.mockResolvedValue(mockRefreshToken);
            await expect(service.refreshToken(refreshTokenValue)).rejects.toThrow(UnauthorizedException);
        });

        it('should throw UnauthorizedException if token revoked', async () => {
            const mockRefreshToken = {
                token: expect.any(String),
                user_id: userId,
                store_id: storeId,
                expires_at: new Date(Date.now() + 100000),
                revoked_at: new Date(),
                revoked_reason: 'logout',
                store: {},
            };

            refreshTokenRepository.findOne.mockResolvedValue(mockRefreshToken);
            await expect(service.refreshToken(refreshTokenValue)).rejects.toThrow(UnauthorizedException);
        });

        it('should throw ForbiddenException if license invalid', async () => {
            const mockRefreshToken = {
                token: expect.any(String),
                user_id: userId,
                store_id: storeId,
                expires_at: new Date(Date.now() + 100000),
                revoked_at: null,
                store: {
                    license_status: 'suspended',
                },
            };

            refreshTokenRepository.findOne.mockResolvedValue(mockRefreshToken);
            await expect(service.refreshToken(refreshTokenValue)).rejects.toThrow(ForbiddenException);
        });
    });

    describe('login - session limit', () => {
        const loginDto = { store_id: 'store_1', pin: '1234' };
        const mockMember = {
            user_id: 'user_1',
            store_id: 'store_1',
            role: 'owner',
            pin_hash: 'hashed_pin',
            profile: { full_name: 'Test' },
            locked_until: null,
            resetFailedAttempts: jest.fn(),
            isLocked: jest.fn(() => false),
        };

        beforeEach(() => {
            // Mock valid user check
            storeMemberRepository.find.mockResolvedValue([mockMember]);
        });

        it('should revoke oldest session if limit exceeded', async () => {
            // Mock store check
            storeRepository.findOne.mockResolvedValue({
                id: 'store_1',
                license_status: 'active',
                license_expires_at: new Date(Date.now() + 100000),
            });

            // Mock session counting
            // We will mock count to return 3 (max is 3, so activeSessions >= MAX)
            refreshTokenRepository.count.mockResolvedValue(3);

            // Mock finding oldest sessions
            const oldestSession = { id: 'old_session', revoked_at: null };
            refreshTokenRepository.find.mockResolvedValue([oldestSession]);
            refreshTokenRepository.create.mockReturnValue({});

            await service.login(loginDto);

            // Expect finding oldest sessions to be called
            expect(refreshTokenRepository.find).toHaveBeenCalledWith(expect.objectContaining({
                order: { created_at: 'ASC' },
                take: 1, // 3 - 3 + 1 = 1
            }));

            // Expect oldest session revocation
            expect(refreshTokenRepository.save).toHaveBeenCalledWith(expect.objectContaining({
                id: 'old_session',
                revoked_reason: 'max_concurrent_sessions'
            }));
        });
    });
});
