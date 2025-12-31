/**
 * Bancos Venezolanos 2025
 * Lista actualizada de bancos que operan en Venezuela
 */

import { BankOption } from '@/types/split-payment.types'

export const VENEZUELAN_BANKS: BankOption[] = [
  // Bancos Públicos
  {
    code: '0102',
    name: 'Banco de Venezuela',
    supportsPayoMovil: true,
    supportsTransfer: true,
  },
  {
    code: '0104',
    name: 'Banco Venezolano de Crédito',
    supportsPayoMovil: true,
    supportsTransfer: true,
  },
  {
    code: '0108',
    name: 'Banco Provincial',
    supportsPayoMovil: true,
    supportsTransfer: true,
  },
  {
    code: '0114',
    name: 'Bancaribe',
    supportsPayoMovil: true,
    supportsTransfer: true,
  },
  {
    code: '0115',
    name: 'Banco Exterior',
    supportsPayoMovil: true,
    supportsTransfer: true,
  },
  {
    code: '0128',
    name: 'Banco Caroní',
    supportsPayoMovil: true,
    supportsTransfer: true,
  },
  {
    code: '0134',
    name: 'Banesco',
    supportsPayoMovil: true,
    supportsTransfer: true,
  },
  {
    code: '0137',
    name: 'Banco Sofitasa',
    supportsPayoMovil: true,
    supportsTransfer: true,
  },
  {
    code: '0138',
    name: 'Banco Plaza',
    supportsPayoMovil: true,
    supportsTransfer: true,
  },
  {
    code: '0146',
    name: 'Banco de la Gente Emprendedora (Bangente)',
    supportsPayoMovil: true,
    supportsTransfer: true,
  },
  {
    code: '0151',
    name: 'Banco Fondo Común (BFC)',
    supportsPayoMovil: true,
    supportsTransfer: true,
  },
  {
    code: '0156',
    name: '100% Banco',
    supportsPayoMovil: true,
    supportsTransfer: true,
  },
  {
    code: '0157',
    name: 'Banco Del Sur',
    supportsPayoMovil: true,
    supportsTransfer: true,
  },
  {
    code: '0163',
    name: 'Banco del Tesoro',
    supportsPayoMovil: true,
    supportsTransfer: true,
  },
  {
    code: '0166',
    name: 'Banco Agrícola de Venezuela',
    supportsPayoMovil: true,
    supportsTransfer: true,
  },
  {
    code: '0168',
    name: 'Bancrecer',
    supportsPayoMovil: true,
    supportsTransfer: true,
  },
  {
    code: '0169',
    name: 'Mi Banco',
    supportsPayoMovil: true,
    supportsTransfer: true,
  },
  {
    code: '0171',
    name: 'Banco Activo',
    supportsPayoMovil: true,
    supportsTransfer: true,
  },
  {
    code: '0172',
    name: 'Bancamiga',
    supportsPayoMovil: true,
    supportsTransfer: true,
  },
  {
    code: '0173',
    name: 'Banco Internacional de Desarrollo',
    supportsPayoMovil: true,
    supportsTransfer: true,
  },
  {
    code: '0174',
    name: 'Banplus',
    supportsPayoMovil: true,
    supportsTransfer: true,
  },
  {
    code: '0175',
    name: 'Banco Bicentenario',
    supportsPayoMovil: true,
    supportsTransfer: true,
  },
  {
    code: '0177',
    name: 'Banco de la Fuerza Armada Nacional Bolivariana (BANFANB)',
    supportsPayoMovil: true,
    supportsTransfer: true,
  },
  {
    code: '0191',
    name: 'Banco Nacional de Crédito (BNC)',
    supportsPayoMovil: true,
    supportsTransfer: true,
  },
]

export const getBank = (code: string): BankOption | undefined => {
  return VENEZUELAN_BANKS.find((bank) => bank.code === code)
}

export const getBankByName = (name: string): BankOption | undefined => {
  const normalizedName = name.toLowerCase().trim()
  return VENEZUELAN_BANKS.find((bank) =>
    bank.name.toLowerCase().includes(normalizedName)
  )
}

export const getBanksWithPayoMovil = (): BankOption[] => {
  return VENEZUELAN_BANKS.filter((bank) => bank.supportsPayoMovil)
}

export const getBanksWithTransfer = (): BankOption[] => {
  return VENEZUELAN_BANKS.filter((bank) => bank.supportsTransfer)
}
