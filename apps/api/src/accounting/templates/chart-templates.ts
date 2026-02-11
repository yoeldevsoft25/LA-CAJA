import { AccountType } from '../../database/entities/chart-of-accounts.entity';
import { TransactionType } from '../../database/entities/accounting-account-mapping.entity';

interface AccountTemplate {
  code: string;
  name: string;
  type: AccountType;
  level: number;
  parent?: string;
  metadata?: Record<string, any>;
}

export type BusinessType = 'retail' | 'services' | 'restaurant' | 'general';

/**
 * Plan de cuentas para RETAIL/TIENDA
 * ~70 cuentas - Enfocado en inventario, ventas de productos, COGS
 */
export const retailTemplate: AccountTemplate[] = [
  // ========== ACTIVOS ==========
  { code: '1', name: 'ACTIVOS', type: 'asset', level: 1 },

  // Activos Corrientes
  {
    code: '1.01',
    name: 'Activos Corrientes',
    type: 'asset',
    level: 2,
    parent: '1',
  },
  {
    code: '1.01.01',
    name: 'Caja General',
    type: 'asset',
    level: 3,
    parent: '1.01',
  },
  {
    code: '1.01.01.01',
    name: 'Caja Bs',
    type: 'asset',
    level: 4,
    parent: '1.01.01',
  },
  {
    code: '1.01.01.02',
    name: 'Caja USD',
    type: 'asset',
    level: 4,
    parent: '1.01.01',
    metadata: {
      fx_revaluation: { enabled: true, currency: 'USD', rate_type: 'BCV' },
    },
  },
  { code: '1.01.02', name: 'Bancos', type: 'asset', level: 3, parent: '1.01' },
  {
    code: '1.01.02.01',
    name: 'Banco/Transfer Bs',
    type: 'asset',
    level: 4,
    parent: '1.01.02',
  },
  {
    code: '1.01.02.02',
    name: 'Pago Movil Bs',
    type: 'asset',
    level: 4,
    parent: '1.01.02',
  },
  {
    code: '1.01.02.03',
    name: 'Punto de Venta',
    type: 'asset',
    level: 4,
    parent: '1.01.02',
    metadata: {
      fx_revaluation: { enabled: true, currency: 'USD', rate_type: 'BCV' },
    },
  },
  {
    code: '1.01.02.04',
    name: 'Zelle',
    type: 'asset',
    level: 4,
    parent: '1.01.02',
    metadata: {
      fx_revaluation: { enabled: true, currency: 'USD', rate_type: 'BCV' },
    },
  },
  {
    code: '1.01.03',
    name: 'Cuentas por Cobrar Clientes',
    type: 'asset',
    level: 3,
    parent: '1.01',
  },
  {
    code: '1.01.04',
    name: 'IVA Crédito Fiscal',
    type: 'asset',
    level: 3,
    parent: '1.01',
  },
  {
    code: '1.01.05',
    name: 'Anticipo a Proveedores',
    type: 'asset',
    level: 3,
    parent: '1.01',
  },
  {
    code: '1.01.06',
    name: 'Deudores Varios',
    type: 'asset',
    level: 3,
    parent: '1.01',
  },

  // Inventario
  { code: '1.02', name: 'Inventarios', type: 'asset', level: 2, parent: '1' },
  {
    code: '1.02.01',
    name: 'Mercancías en Tránsito',
    type: 'asset',
    level: 3,
    parent: '1.02',
  },
  {
    code: '1.02.02',
    name: 'Inventario de Productos',
    type: 'asset',
    level: 3,
    parent: '1.02',
  },
  {
    code: '1.02.03',
    name: 'Materias Primas',
    type: 'asset',
    level: 3,
    parent: '1.02',
  },
  {
    code: '1.02.04',
    name: 'Productos en Proceso',
    type: 'asset',
    level: 3,
    parent: '1.02',
  },
  {
    code: '1.02.05',
    name: 'Productos Terminados',
    type: 'asset',
    level: 3,
    parent: '1.02',
  },

  // Activos No Corrientes
  { code: '1.03', name: 'Activos Fijos', type: 'asset', level: 2, parent: '1' },
  {
    code: '1.03.01',
    name: 'Terrenos',
    type: 'asset',
    level: 3,
    parent: '1.03',
  },
  {
    code: '1.03.02',
    name: 'Edificaciones',
    type: 'asset',
    level: 3,
    parent: '1.03',
  },
  {
    code: '1.03.03',
    name: 'Mobiliario y Equipos',
    type: 'asset',
    level: 3,
    parent: '1.03',
  },
  {
    code: '1.03.04',
    name: 'Equipos de Computación',
    type: 'asset',
    level: 3,
    parent: '1.03',
  },
  {
    code: '1.03.05',
    name: 'Vehículos',
    type: 'asset',
    level: 3,
    parent: '1.03',
  },
  {
    code: '1.03.06',
    name: 'Maquinaria y Equipos',
    type: 'asset',
    level: 3,
    parent: '1.03',
  },
  {
    code: '1.03.07',
    name: 'Depreciación Acumulada',
    type: 'asset',
    level: 3,
    parent: '1.03',
  },

  // ========== PASIVOS ==========
  { code: '2', name: 'PASIVOS', type: 'liability', level: 1 },

  // Pasivos Corrientes
  {
    code: '2.01',
    name: 'Pasivos Corrientes',
    type: 'liability',
    level: 2,
    parent: '2',
  },
  {
    code: '2.01.01',
    name: 'Cuentas por Pagar Proveedores',
    type: 'liability',
    level: 3,
    parent: '2.01',
  },
  {
    code: '2.01.02',
    name: 'IVA por Pagar',
    type: 'liability',
    level: 3,
    parent: '2.01',
  },
  {
    code: '2.01.03',
    name: 'Retenciones por Pagar',
    type: 'liability',
    level: 3,
    parent: '2.01',
  },
  {
    code: '2.01.04',
    name: 'Préstamos Bancarios Corto Plazo',
    type: 'liability',
    level: 3,
    parent: '2.01',
  },
  {
    code: '2.01.05',
    name: 'Acreedores Varios',
    type: 'liability',
    level: 3,
    parent: '2.01',
  },
  {
    code: '2.01.06',
    name: 'Anticipos de Clientes',
    type: 'liability',
    level: 3,
    parent: '2.01',
  },

  // Pasivos No Corrientes
  {
    code: '2.02',
    name: 'Pasivos No Corrientes',
    type: 'liability',
    level: 2,
    parent: '2',
  },
  {
    code: '2.02.01',
    name: 'Préstamos Bancarios Largo Plazo',
    type: 'liability',
    level: 3,
    parent: '2.02',
  },

  // ========== PATRIMONIO ==========
  { code: '3', name: 'PATRIMONIO', type: 'equity', level: 1 },
  { code: '3.01', name: 'Capital', type: 'equity', level: 2, parent: '3' },
  {
    code: '3.01.01',
    name: 'Capital Social',
    type: 'equity',
    level: 3,
    parent: '3.01',
  },
  {
    code: '3.01.02',
    name: 'Aportes de Socios',
    type: 'equity',
    level: 3,
    parent: '3.01',
  },
  {
    code: '3.02',
    name: 'Ganancias Retenidas',
    type: 'equity',
    level: 2,
    parent: '3',
  },
  {
    code: '3.02.01',
    name: 'Utilidades Acumuladas',
    type: 'equity',
    level: 3,
    parent: '3.02',
  },
  {
    code: '3.02.02',
    name: 'Reservas',
    type: 'equity',
    level: 3,
    parent: '3.02',
  },
  { code: '3.03', name: 'Resultados', type: 'equity', level: 2, parent: '3' },
  {
    code: '3.03.01',
    name: 'Resultado del Ejercicio',
    type: 'equity',
    level: 3,
    parent: '3.03',
  },

  // ========== INGRESOS ==========
  { code: '4', name: 'INGRESOS', type: 'revenue', level: 1 },

  // Ventas
  { code: '4.01', name: 'Ventas', type: 'revenue', level: 2, parent: '4' },
  {
    code: '4.01.01',
    name: 'Ventas de Productos',
    type: 'revenue',
    level: 3,
    parent: '4.01',
  },
  {
    code: '4.01.02',
    name: 'Ventas al Mayor',
    type: 'revenue',
    level: 3,
    parent: '4.01',
  },
  {
    code: '4.01.03',
    name: 'Ventas al Detal',
    type: 'revenue',
    level: 3,
    parent: '4.01',
  },
  {
    code: '4.01.04',
    name: 'Devoluciones en Ventas',
    type: 'revenue',
    level: 3,
    parent: '4.01',
  },
  {
    code: '4.01.05',
    name: 'Descuentos en Ventas',
    type: 'revenue',
    level: 3,
    parent: '4.01',
  },

  // Otros Ingresos
  {
    code: '4.02',
    name: 'Otros Ingresos',
    type: 'revenue',
    level: 2,
    parent: '4',
  },
  {
    code: '4.02.01',
    name: 'Ingresos por Servicios',
    type: 'revenue',
    level: 3,
    parent: '4.02',
  },
  {
    code: '4.02.02',
    name: 'Ingresos Financieros',
    type: 'revenue',
    level: 3,
    parent: '4.02',
  },
  {
    code: '4.02.02.01',
    name: 'Ganancia cambiaria realizada',
    type: 'revenue',
    level: 4,
    parent: '4.02.02',
  },
  {
    code: '4.02.02.02',
    name: 'Ganancia cambiaria no realizada',
    type: 'revenue',
    level: 4,
    parent: '4.02.02',
  },
  {
    code: '4.02.03',
    name: 'Otros Ingresos Operativos',
    type: 'revenue',
    level: 3,
    parent: '4.02',
  },

  // ========== GASTOS ==========
  { code: '5', name: 'GASTOS', type: 'expense', level: 1 },

  // Costo de Ventas
  {
    code: '5.01',
    name: 'Costo de Ventas',
    type: 'expense',
    level: 2,
    parent: '5',
  },
  {
    code: '5.01.01',
    name: 'Costo de Productos Vendidos',
    type: 'expense',
    level: 3,
    parent: '5.01',
  },
  {
    code: '5.01.02',
    name: 'Mano de Obra Directa',
    type: 'expense',
    level: 3,
    parent: '5.01',
  },

  // Gastos Operativos
  {
    code: '5.02',
    name: 'Gastos Operativos',
    type: 'expense',
    level: 2,
    parent: '5',
  },
  {
    code: '5.02.01',
    name: 'Gastos de Personal',
    type: 'expense',
    level: 3,
    parent: '5.02',
  },
  {
    code: '5.02.02',
    name: 'Gastos de Alquiler',
    type: 'expense',
    level: 3,
    parent: '5.02',
  },
  {
    code: '5.02.03',
    name: 'Servicios Públicos',
    type: 'expense',
    level: 3,
    parent: '5.02',
  },
  {
    code: '5.02.04',
    name: 'Gastos de Publicidad',
    type: 'expense',
    level: 3,
    parent: '5.02',
  },
  {
    code: '5.02.05',
    name: 'Gastos de Seguros',
    type: 'expense',
    level: 3,
    parent: '5.02',
  },
  {
    code: '5.02.06',
    name: 'Gastos de Mantenimiento',
    type: 'expense',
    level: 3,
    parent: '5.02',
  },
  {
    code: '5.02.07',
    name: 'Depreciación',
    type: 'expense',
    level: 3,
    parent: '5.02',
  },
  {
    code: '5.02.08',
    name: 'Gastos Generales',
    type: 'expense',
    level: 3,
    parent: '5.02',
  },
  {
    code: '5.02.09',
    name: 'Pérdidas por Deterioro',
    type: 'expense',
    level: 3,
    parent: '5.02',
  },

  // Compras
  { code: '5.03', name: 'Compras', type: 'expense', level: 2, parent: '5' },
  {
    code: '5.03.01',
    name: 'Compras de Mercancía',
    type: 'expense',
    level: 3,
    parent: '5.03',
  },
  {
    code: '5.03.02',
    name: 'Gastos de Compra',
    type: 'expense',
    level: 3,
    parent: '5.03',
  },
  {
    code: '5.03.03',
    name: 'Devoluciones en Compras',
    type: 'expense',
    level: 3,
    parent: '5.03',
  },

  // Gastos No Operativos
  {
    code: '5.04',
    name: 'Gastos No Operativos',
    type: 'expense',
    level: 2,
    parent: '5',
  },
  {
    code: '5.04.01',
    name: 'Gastos Financieros',
    type: 'expense',
    level: 3,
    parent: '5.04',
  },
  {
    code: '5.04.01.01',
    name: 'Pérdida cambiaria realizada',
    type: 'expense',
    level: 4,
    parent: '5.04.01',
  },
  {
    code: '5.04.01.02',
    name: 'Pérdida cambiaria no realizada',
    type: 'expense',
    level: 4,
    parent: '5.04.01',
  },
  {
    code: '5.04.02',
    name: 'Gastos Extraordinarios',
    type: 'expense',
    level: 3,
    parent: '5.04',
  },
];

/**
 * Plan de cuentas para SERVICIOS
 * ~60 cuentas - Enfocado en servicios, proyectos, horas facturables
 */
export const servicesTemplate: AccountTemplate[] = [
  // ========== ACTIVOS ==========
  { code: '1', name: 'ACTIVOS', type: 'asset', level: 1 },

  // Activos Corrientes
  {
    code: '1.01',
    name: 'Activos Corrientes',
    type: 'asset',
    level: 2,
    parent: '1',
  },
  {
    code: '1.01.01',
    name: 'Caja General',
    type: 'asset',
    level: 3,
    parent: '1.01',
  },
  {
    code: '1.01.01.01',
    name: 'Caja Bs',
    type: 'asset',
    level: 4,
    parent: '1.01.01',
  },
  {
    code: '1.01.01.02',
    name: 'Caja USD',
    type: 'asset',
    level: 4,
    parent: '1.01.01',
    metadata: {
      fx_revaluation: { enabled: true, currency: 'USD', rate_type: 'BCV' },
    },
  },
  { code: '1.01.02', name: 'Bancos', type: 'asset', level: 3, parent: '1.01' },
  {
    code: '1.01.02.01',
    name: 'Banco/Transfer Bs',
    type: 'asset',
    level: 4,
    parent: '1.01.02',
  },
  {
    code: '1.01.02.02',
    name: 'Pago Movil Bs',
    type: 'asset',
    level: 4,
    parent: '1.01.02',
  },
  {
    code: '1.01.02.03',
    name: 'Punto de Venta',
    type: 'asset',
    level: 4,
    parent: '1.01.02',
    metadata: {
      fx_revaluation: { enabled: true, currency: 'USD', rate_type: 'BCV' },
    },
  },
  {
    code: '1.01.02.04',
    name: 'Zelle',
    type: 'asset',
    level: 4,
    parent: '1.01.02',
    metadata: {
      fx_revaluation: { enabled: true, currency: 'USD', rate_type: 'BCV' },
    },
  },
  {
    code: '1.01.03',
    name: 'Cuentas por Cobrar Clientes',
    type: 'asset',
    level: 3,
    parent: '1.01',
  },
  {
    code: '1.01.04',
    name: 'IVA Crédito Fiscal',
    type: 'asset',
    level: 3,
    parent: '1.01',
  },
  {
    code: '1.01.05',
    name: 'Anticipos de Clientes',
    type: 'asset',
    level: 3,
    parent: '1.01',
  },
  {
    code: '1.01.06',
    name: 'Deudores Varios',
    type: 'asset',
    level: 3,
    parent: '1.01',
  },

  // Activos No Corrientes
  { code: '1.02', name: 'Activos Fijos', type: 'asset', level: 2, parent: '1' },
  {
    code: '1.02.01',
    name: 'Equipos de Oficina',
    type: 'asset',
    level: 3,
    parent: '1.02',
  },
  {
    code: '1.02.02',
    name: 'Equipos de Computación',
    type: 'asset',
    level: 3,
    parent: '1.02',
  },
  {
    code: '1.02.03',
    name: 'Mobiliario',
    type: 'asset',
    level: 3,
    parent: '1.02',
  },
  {
    code: '1.02.04',
    name: 'Software y Licencias',
    type: 'asset',
    level: 3,
    parent: '1.02',
  },
  {
    code: '1.02.05',
    name: 'Vehículos',
    type: 'asset',
    level: 3,
    parent: '1.02',
  },
  {
    code: '1.02.06',
    name: 'Depreciación Acumulada',
    type: 'asset',
    level: 3,
    parent: '1.02',
  },

  // ========== PASIVOS ==========
  { code: '2', name: 'PASIVOS', type: 'liability', level: 1 },

  {
    code: '2.01',
    name: 'Pasivos Corrientes',
    type: 'liability',
    level: 2,
    parent: '2',
  },
  {
    code: '2.01.01',
    name: 'Cuentas por Pagar Proveedores',
    type: 'liability',
    level: 3,
    parent: '2.01',
  },
  {
    code: '2.01.02',
    name: 'IVA por Pagar',
    type: 'liability',
    level: 3,
    parent: '2.01',
  },
  {
    code: '2.01.03',
    name: 'Sueldos por Pagar',
    type: 'liability',
    level: 3,
    parent: '2.01',
  },
  {
    code: '2.01.04',
    name: 'Préstamos Bancarios',
    type: 'liability',
    level: 3,
    parent: '2.01',
  },
  {
    code: '2.01.05',
    name: 'Acreedores Varios',
    type: 'liability',
    level: 3,
    parent: '2.01',
  },

  // ========== PATRIMONIO ==========
  { code: '3', name: 'PATRIMONIO', type: 'equity', level: 1 },
  { code: '3.01', name: 'Capital', type: 'equity', level: 2, parent: '3' },
  {
    code: '3.01.01',
    name: 'Capital Social',
    type: 'equity',
    level: 3,
    parent: '3.01',
  },
  {
    code: '3.02',
    name: 'Ganancias Retenidas',
    type: 'equity',
    level: 2,
    parent: '3',
  },
  {
    code: '3.02.01',
    name: 'Utilidades Acumuladas',
    type: 'equity',
    level: 3,
    parent: '3.02',
  },
  { code: '3.03', name: 'Resultados', type: 'equity', level: 2, parent: '3' },
  {
    code: '3.03.01',
    name: 'Resultado del Ejercicio',
    type: 'equity',
    level: 3,
    parent: '3.03',
  },

  // ========== INGRESOS ==========
  { code: '4', name: 'INGRESOS', type: 'revenue', level: 1 },

  {
    code: '4.01',
    name: 'Ingresos por Servicios',
    type: 'revenue',
    level: 2,
    parent: '4',
  },
  {
    code: '4.01.01',
    name: 'Ingresos por Consultoría',
    type: 'revenue',
    level: 3,
    parent: '4.01',
  },
  {
    code: '4.01.02',
    name: 'Ingresos por Proyectos',
    type: 'revenue',
    level: 3,
    parent: '4.01',
  },
  {
    code: '4.01.03',
    name: 'Ingresos por Asesorías',
    type: 'revenue',
    level: 3,
    parent: '4.01',
  },
  {
    code: '4.01.04',
    name: 'Ingresos por Horas Facturables',
    type: 'revenue',
    level: 3,
    parent: '4.01',
  },
  {
    code: '4.01.05',
    name: 'Ingresos por Mantenimiento',
    type: 'revenue',
    level: 3,
    parent: '4.01',
  },

  {
    code: '4.02',
    name: 'Otros Ingresos',
    type: 'revenue',
    level: 2,
    parent: '4',
  },
  {
    code: '4.02.01',
    name: 'Ingresos Financieros',
    type: 'revenue',
    level: 3,
    parent: '4.02',
  },
  {
    code: '4.02.01.01',
    name: 'Ganancia cambiaria realizada',
    type: 'revenue',
    level: 4,
    parent: '4.02.01',
  },
  {
    code: '4.02.01.02',
    name: 'Ganancia cambiaria no realizada',
    type: 'revenue',
    level: 4,
    parent: '4.02.01',
  },
  {
    code: '4.02.02',
    name: 'Ingresos Varios',
    type: 'revenue',
    level: 3,
    parent: '4.02',
  },
  {
    code: '4.02.03',
    name: 'Ingresos Financieros',
    type: 'revenue',
    level: 3,
    parent: '4.02',
  },
  {
    code: '4.02.03.01',
    name: 'Ganancia cambiaria realizada',
    type: 'revenue',
    level: 4,
    parent: '4.02.03',
  },
  {
    code: '4.02.03.02',
    name: 'Ganancia cambiaria no realizada',
    type: 'revenue',
    level: 4,
    parent: '4.02.03',
  },

  // ========== GASTOS ==========
  { code: '5', name: 'GASTOS', type: 'expense', level: 1 },

  {
    code: '5.01',
    name: 'Costo de Servicios',
    type: 'expense',
    level: 2,
    parent: '5',
  },
  {
    code: '5.01.01',
    name: 'Costo de Personal Directo',
    type: 'expense',
    level: 3,
    parent: '5.01',
  },
  {
    code: '5.01.02',
    name: 'Subcontrataciones',
    type: 'expense',
    level: 3,
    parent: '5.01',
  },
  {
    code: '5.01.03',
    name: 'Materiales y Suministros',
    type: 'expense',
    level: 3,
    parent: '5.01',
  },

  {
    code: '5.02',
    name: 'Gastos Operativos',
    type: 'expense',
    level: 2,
    parent: '5',
  },
  {
    code: '5.02.01',
    name: 'Gastos de Personal',
    type: 'expense',
    level: 3,
    parent: '5.02',
  },
  {
    code: '5.02.02',
    name: 'Alquileres',
    type: 'expense',
    level: 3,
    parent: '5.02',
  },
  {
    code: '5.02.03',
    name: 'Servicios Públicos',
    type: 'expense',
    level: 3,
    parent: '5.02',
  },
  {
    code: '5.02.04',
    name: 'Servicios Profesionales',
    type: 'expense',
    level: 3,
    parent: '5.02',
  },
  {
    code: '5.02.05',
    name: 'Gastos de Publicidad',
    type: 'expense',
    level: 3,
    parent: '5.02',
  },
  {
    code: '5.02.06',
    name: 'Gastos de Viaje',
    type: 'expense',
    level: 3,
    parent: '5.02',
  },
  {
    code: '5.02.07',
    name: 'Equipos y Herramientas',
    type: 'expense',
    level: 3,
    parent: '5.02',
  },
  {
    code: '5.02.08',
    name: 'Depreciación',
    type: 'expense',
    level: 3,
    parent: '5.02',
  },
  {
    code: '5.02.09',
    name: 'Gastos Generales',
    type: 'expense',
    level: 3,
    parent: '5.02',
  },

  {
    code: '5.03',
    name: 'Gastos No Operativos',
    type: 'expense',
    level: 2,
    parent: '5',
  },
  {
    code: '5.03.01',
    name: 'Gastos Financieros',
    type: 'expense',
    level: 3,
    parent: '5.03',
  },
  {
    code: '5.03.01.01',
    name: 'Pérdida cambiaria realizada',
    type: 'expense',
    level: 4,
    parent: '5.03.01',
  },
  {
    code: '5.03.01.02',
    name: 'Pérdida cambiaria no realizada',
    type: 'expense',
    level: 4,
    parent: '5.03.01',
  },
];

/**
 * Plan de cuentas para RESTAURANTE
 * ~75 cuentas - Enfocado en alimentos, bebidas, inventario perecedero, COGS
 */
export const restaurantTemplate: AccountTemplate[] = [
  // ========== ACTIVOS ==========
  { code: '1', name: 'ACTIVOS', type: 'asset', level: 1 },

  // Activos Corrientes
  {
    code: '1.01',
    name: 'Activos Corrientes',
    type: 'asset',
    level: 2,
    parent: '1',
  },
  {
    code: '1.01.01',
    name: 'Caja General',
    type: 'asset',
    level: 3,
    parent: '1.01',
  },
  {
    code: '1.01.01.01',
    name: 'Caja Bs',
    type: 'asset',
    level: 4,
    parent: '1.01.01',
  },
  {
    code: '1.01.01.02',
    name: 'Caja USD',
    type: 'asset',
    level: 4,
    parent: '1.01.01',
    metadata: {
      fx_revaluation: { enabled: true, currency: 'USD', rate_type: 'BCV' },
    },
  },
  { code: '1.01.02', name: 'Bancos', type: 'asset', level: 3, parent: '1.01' },
  {
    code: '1.01.02.01',
    name: 'Banco/Transfer Bs',
    type: 'asset',
    level: 4,
    parent: '1.01.02',
  },
  {
    code: '1.01.02.02',
    name: 'Pago Movil Bs',
    type: 'asset',
    level: 4,
    parent: '1.01.02',
  },
  {
    code: '1.01.02.03',
    name: 'Punto de Venta',
    type: 'asset',
    level: 4,
    parent: '1.01.02',
    metadata: {
      fx_revaluation: { enabled: true, currency: 'USD', rate_type: 'BCV' },
    },
  },
  {
    code: '1.01.02.04',
    name: 'Zelle',
    type: 'asset',
    level: 4,
    parent: '1.01.02',
    metadata: {
      fx_revaluation: { enabled: true, currency: 'USD', rate_type: 'BCV' },
    },
  },
  {
    code: '1.01.03',
    name: 'Cuentas por Cobrar',
    type: 'asset',
    level: 3,
    parent: '1.01',
  },
  {
    code: '1.01.04',
    name: 'IVA Crédito Fiscal',
    type: 'asset',
    level: 3,
    parent: '1.01',
  },

  // Inventario
  { code: '1.02', name: 'Inventarios', type: 'asset', level: 2, parent: '1' },
  {
    code: '1.02.01',
    name: 'Inventario de Alimentos',
    type: 'asset',
    level: 3,
    parent: '1.02',
  },
  {
    code: '1.02.02',
    name: 'Inventario de Bebidas',
    type: 'asset',
    level: 3,
    parent: '1.02',
  },
  {
    code: '1.02.03',
    name: 'Inventario de Víveres',
    type: 'asset',
    level: 3,
    parent: '1.02',
  },
  {
    code: '1.02.04',
    name: 'Inventario de Materiales',
    type: 'asset',
    level: 3,
    parent: '1.02',
  },

  // Activos Fijos
  { code: '1.03', name: 'Activos Fijos', type: 'asset', level: 2, parent: '1' },
  {
    code: '1.03.01',
    name: 'Equipos de Cocina',
    type: 'asset',
    level: 3,
    parent: '1.03',
  },
  {
    code: '1.03.02',
    name: 'Mobiliario y Utensilios',
    type: 'asset',
    level: 3,
    parent: '1.03',
  },
  {
    code: '1.03.03',
    name: 'Equipos de Refrigeración',
    type: 'asset',
    level: 3,
    parent: '1.03',
  },
  {
    code: '1.03.04',
    name: 'Equipos de Computación',
    type: 'asset',
    level: 3,
    parent: '1.03',
  },
  {
    code: '1.03.05',
    name: 'Vehículos',
    type: 'asset',
    level: 3,
    parent: '1.03',
  },
  {
    code: '1.03.06',
    name: 'Depreciación Acumulada',
    type: 'asset',
    level: 3,
    parent: '1.03',
  },

  // ========== PASIVOS ==========
  { code: '2', name: 'PASIVOS', type: 'liability', level: 1 },

  {
    code: '2.01',
    name: 'Pasivos Corrientes',
    type: 'liability',
    level: 2,
    parent: '2',
  },
  {
    code: '2.01.01',
    name: 'Cuentas por Pagar Proveedores',
    type: 'liability',
    level: 3,
    parent: '2.01',
  },
  {
    code: '2.01.02',
    name: 'IVA por Pagar',
    type: 'liability',
    level: 3,
    parent: '2.01',
  },
  {
    code: '2.01.03',
    name: 'Sueldos por Pagar',
    type: 'liability',
    level: 3,
    parent: '2.01',
  },
  {
    code: '2.01.04',
    name: 'Acreedores Varios',
    type: 'liability',
    level: 3,
    parent: '2.01',
  },

  // ========== PATRIMONIO ==========
  { code: '3', name: 'PATRIMONIO', type: 'equity', level: 1 },
  { code: '3.01', name: 'Capital', type: 'equity', level: 2, parent: '3' },
  {
    code: '3.01.01',
    name: 'Capital Social',
    type: 'equity',
    level: 3,
    parent: '3.01',
  },
  {
    code: '3.02',
    name: 'Ganancias Retenidas',
    type: 'equity',
    level: 2,
    parent: '3',
  },
  {
    code: '3.02.01',
    name: 'Utilidades Acumuladas',
    type: 'equity',
    level: 3,
    parent: '3.02',
  },
  { code: '3.03', name: 'Resultados', type: 'equity', level: 2, parent: '3' },
  {
    code: '3.03.01',
    name: 'Resultado del Ejercicio',
    type: 'equity',
    level: 3,
    parent: '3.03',
  },

  // ========== INGRESOS ==========
  { code: '4', name: 'INGRESOS', type: 'revenue', level: 1 },

  {
    code: '4.01',
    name: 'Ingresos por Ventas',
    type: 'revenue',
    level: 2,
    parent: '4',
  },
  {
    code: '4.01.01',
    name: 'Ventas de Alimentos',
    type: 'revenue',
    level: 3,
    parent: '4.01',
  },
  {
    code: '4.01.02',
    name: 'Ventas de Bebidas',
    type: 'revenue',
    level: 3,
    parent: '4.01',
  },
  {
    code: '4.01.03',
    name: 'Ventas de Postres',
    type: 'revenue',
    level: 3,
    parent: '4.01',
  },
  {
    code: '4.01.04',
    name: 'Servicio de Mesa',
    type: 'revenue',
    level: 3,
    parent: '4.01',
  },
  {
    code: '4.01.05',
    name: 'Delivery/Comida Para Llevar',
    type: 'revenue',
    level: 3,
    parent: '4.01',
  },
  {
    code: '4.01.06',
    name: 'Eventos y Catering',
    type: 'revenue',
    level: 3,
    parent: '4.01',
  },

  {
    code: '4.02',
    name: 'Otros Ingresos',
    type: 'revenue',
    level: 2,
    parent: '4',
  },
  {
    code: '4.02.01',
    name: 'Propinas',
    type: 'revenue',
    level: 3,
    parent: '4.02',
  },
  {
    code: '4.02.02',
    name: 'Ingresos Varios',
    type: 'revenue',
    level: 3,
    parent: '4.02',
  },

  // ========== GASTOS ==========
  { code: '5', name: 'GASTOS', type: 'expense', level: 1 },

  {
    code: '5.01',
    name: 'Costo de Ventas',
    type: 'expense',
    level: 2,
    parent: '5',
  },
  {
    code: '5.01.01',
    name: 'Costo de Alimentos',
    type: 'expense',
    level: 3,
    parent: '5.01',
  },
  {
    code: '5.01.02',
    name: 'Costo de Bebidas',
    type: 'expense',
    level: 3,
    parent: '5.01',
  },
  {
    code: '5.01.03',
    name: 'Costo de Víveres',
    type: 'expense',
    level: 3,
    parent: '5.01',
  },
  {
    code: '5.01.04',
    name: 'Costo de Materiales de Cocina',
    type: 'expense',
    level: 3,
    parent: '5.01',
  },

  {
    code: '5.02',
    name: 'Gastos Operativos',
    type: 'expense',
    level: 2,
    parent: '5',
  },
  {
    code: '5.02.01',
    name: 'Gastos de Personal',
    type: 'expense',
    level: 3,
    parent: '5.02',
  },
  {
    code: '5.02.02',
    name: 'Sueldos de Cocina',
    type: 'expense',
    level: 3,
    parent: '5.02',
  },
  {
    code: '5.02.03',
    name: 'Sueldos de Meseros',
    type: 'expense',
    level: 3,
    parent: '5.02',
  },
  {
    code: '5.02.04',
    name: 'Alquileres',
    type: 'expense',
    level: 3,
    parent: '5.02',
  },
  {
    code: '5.02.05',
    name: 'Servicios Públicos',
    type: 'expense',
    level: 3,
    parent: '5.02',
  },
  {
    code: '5.02.06',
    name: 'Gastos de Publicidad',
    type: 'expense',
    level: 3,
    parent: '5.02',
  },
  {
    code: '5.02.07',
    name: 'Gastos de Mantenimiento',
    type: 'expense',
    level: 3,
    parent: '5.02',
  },
  {
    code: '5.02.08',
    name: 'Limpieza y Aseo',
    type: 'expense',
    level: 3,
    parent: '5.02',
  },
  {
    code: '5.02.09',
    name: 'Depreciación',
    type: 'expense',
    level: 3,
    parent: '5.02',
  },
  {
    code: '5.02.10',
    name: 'Gastos Generales',
    type: 'expense',
    level: 3,
    parent: '5.02',
  },
  {
    code: '5.02.11',
    name: 'Mermas y Pérdidas de Inventario',
    type: 'expense',
    level: 3,
    parent: '5.02',
  },

  { code: '5.03', name: 'Compras', type: 'expense', level: 2, parent: '5' },
  {
    code: '5.03.01',
    name: 'Compras de Alimentos',
    type: 'expense',
    level: 3,
    parent: '5.03',
  },
  {
    code: '5.03.02',
    name: 'Compras de Bebidas',
    type: 'expense',
    level: 3,
    parent: '5.03',
  },
  {
    code: '5.03.03',
    name: 'Gastos de Compra',
    type: 'expense',
    level: 3,
    parent: '5.03',
  },
  // Gastos No Operativos
  {
    code: '5.04',
    name: 'Gastos No Operativos',
    type: 'expense',
    level: 2,
    parent: '5',
  },
  {
    code: '5.04.01',
    name: 'Gastos Financieros',
    type: 'expense',
    level: 3,
    parent: '5.04',
  },
  {
    code: '5.04.01.01',
    name: 'Pérdida cambiaria realizada',
    type: 'expense',
    level: 4,
    parent: '5.04.01',
  },
  {
    code: '5.04.01.02',
    name: 'Pérdida cambiaria no realizada',
    type: 'expense',
    level: 4,
    parent: '5.04.01',
  },
];

/**
 * Plan de cuentas GENERAL (default básico, compatible con el anterior)
 * ~50 cuentas - Versión mejorada del plan básico
 */
export const generalTemplate: AccountTemplate[] = [
  // Activos
  { code: '1', name: 'ACTIVOS', type: 'asset', level: 1 },
  {
    code: '1.01',
    name: 'Activos Corrientes',
    type: 'asset',
    level: 2,
    parent: '1',
  },
  { code: '1.01.01', name: 'Caja', type: 'asset', level: 3, parent: '1.01' },
  {
    code: '1.01.01.01',
    name: 'Caja Bs',
    type: 'asset',
    level: 4,
    parent: '1.01.01',
  },
  {
    code: '1.01.01.02',
    name: 'Caja USD',
    type: 'asset',
    level: 4,
    parent: '1.01.01',
    metadata: {
      fx_revaluation: { enabled: true, currency: 'USD', rate_type: 'BCV' },
    },
  },
  { code: '1.01.02', name: 'Bancos', type: 'asset', level: 3, parent: '1.01' },
  {
    code: '1.01.02.01',
    name: 'Banco/Transfer Bs',
    type: 'asset',
    level: 4,
    parent: '1.01.02',
  },
  {
    code: '1.01.02.02',
    name: 'Pago Movil Bs',
    type: 'asset',
    level: 4,
    parent: '1.01.02',
  },
  {
    code: '1.01.02.03',
    name: 'Punto de Venta',
    type: 'asset',
    level: 4,
    parent: '1.01.02',
    metadata: {
      fx_revaluation: { enabled: true, currency: 'USD', rate_type: 'BCV' },
    },
  },
  {
    code: '1.01.02.04',
    name: 'Zelle',
    type: 'asset',
    level: 4,
    parent: '1.01.02',
    metadata: {
      fx_revaluation: { enabled: true, currency: 'USD', rate_type: 'BCV' },
    },
  },
  {
    code: '1.01.03',
    name: 'Cuentas por Cobrar',
    type: 'asset',
    level: 3,
    parent: '1.01',
  },
  {
    code: '1.01.04',
    name: 'IVA Crédito Fiscal',
    type: 'asset',
    level: 3,
    parent: '1.01',
  },
  {
    code: '1.01.05',
    name: 'Deudores Varios',
    type: 'asset',
    level: 3,
    parent: '1.01',
  },
  {
    code: '1.02',
    name: 'Activos No Corrientes',
    type: 'asset',
    level: 2,
    parent: '1',
  },
  {
    code: '1.02.01',
    name: 'Inventario',
    type: 'asset',
    level: 3,
    parent: '1.02',
  },
  {
    code: '1.02.02',
    name: 'Activos Fijos',
    type: 'asset',
    level: 3,
    parent: '1.02',
  },
  {
    code: '1.02.03',
    name: 'Depreciación Acumulada',
    type: 'asset',
    level: 3,
    parent: '1.02',
  },

  // Pasivos
  { code: '2', name: 'PASIVOS', type: 'liability', level: 1 },
  {
    code: '2.01',
    name: 'Pasivos Corrientes',
    type: 'liability',
    level: 2,
    parent: '2',
  },
  {
    code: '2.01.01',
    name: 'Cuentas por Pagar',
    type: 'liability',
    level: 3,
    parent: '2.01',
  },
  {
    code: '2.01.02',
    name: 'IVA por Pagar',
    type: 'liability',
    level: 3,
    parent: '2.01',
  },
  {
    code: '2.01.03',
    name: 'Retenciones por Pagar',
    type: 'liability',
    level: 3,
    parent: '2.01',
  },
  {
    code: '2.01.04',
    name: 'Acreedores Varios',
    type: 'liability',
    level: 3,
    parent: '2.01',
  },

  // Patrimonio
  { code: '3', name: 'PATRIMONIO', type: 'equity', level: 1 },
  { code: '3.01', name: 'Capital', type: 'equity', level: 2, parent: '3' },
  {
    code: '3.01.01',
    name: 'Capital Social',
    type: 'equity',
    level: 3,
    parent: '3.01',
  },
  {
    code: '3.02',
    name: 'Ganancias Retenidas',
    type: 'equity',
    level: 2,
    parent: '3',
  },
  {
    code: '3.02.01',
    name: 'Utilidades Acumuladas',
    type: 'equity',
    level: 3,
    parent: '3.02',
  },

  // Ingresos
  { code: '4', name: 'INGRESOS', type: 'revenue', level: 1 },
  { code: '4.01', name: 'Ventas', type: 'revenue', level: 2, parent: '4' },
  {
    code: '4.01.01',
    name: 'Ventas de Productos',
    type: 'revenue',
    level: 3,
    parent: '4.01',
  },
  {
    code: '4.01.02',
    name: 'Ventas de Servicios',
    type: 'revenue',
    level: 3,
    parent: '4.01',
  },
  {
    code: '4.02',
    name: 'Otros Ingresos',
    type: 'revenue',
    level: 2,
    parent: '4',
  },
  {
    code: '4.02.01',
    name: 'Ingresos Varios',
    type: 'revenue',
    level: 3,
    parent: '4.02',
  },
  {
    code: '4.02.02',
    name: 'Ingresos Financieros',
    type: 'revenue',
    level: 3,
    parent: '4.02',
  },
  {
    code: '4.02.02.01',
    name: 'Ganancia cambiaria realizada',
    type: 'revenue',
    level: 4,
    parent: '4.02.02',
  },
  {
    code: '4.02.02.02',
    name: 'Ganancia cambiaria no realizada',
    type: 'revenue',
    level: 4,
    parent: '4.02.02',
  },

  // Gastos
  { code: '5', name: 'GASTOS', type: 'expense', level: 1 },
  {
    code: '5.01',
    name: 'Costo de Ventas',
    type: 'expense',
    level: 2,
    parent: '5',
  },
  {
    code: '5.01.01',
    name: 'Costo de Productos Vendidos',
    type: 'expense',
    level: 3,
    parent: '5.01',
  },
  {
    code: '5.01.02',
    name: 'Costo de Servicios',
    type: 'expense',
    level: 3,
    parent: '5.01',
  },
  {
    code: '5.02',
    name: 'Gastos Operativos',
    type: 'expense',
    level: 2,
    parent: '5',
  },
  {
    code: '5.02.01',
    name: 'Gastos Generales',
    type: 'expense',
    level: 3,
    parent: '5.02',
  },
  {
    code: '5.02.02',
    name: 'Gastos de Personal',
    type: 'expense',
    level: 3,
    parent: '5.02',
  },
  {
    code: '5.02.03',
    name: 'Gastos de Alquiler',
    type: 'expense',
    level: 3,
    parent: '5.02',
  },
  {
    code: '5.02.04',
    name: 'Servicios Públicos',
    type: 'expense',
    level: 3,
    parent: '5.02',
  },
  {
    code: '5.02.05',
    name: 'Gastos de Publicidad',
    type: 'expense',
    level: 3,
    parent: '5.02',
  },
  {
    code: '5.02.06',
    name: 'Depreciación',
    type: 'expense',
    level: 3,
    parent: '5.02',
  },
  { code: '5.03', name: 'Compras', type: 'expense', level: 2, parent: '5' },
  {
    code: '5.03.01',
    name: 'Compras de Inventario',
    type: 'expense',
    level: 3,
    parent: '5.03',
  },
  {
    code: '5.03.02',
    name: 'Gastos de Compra',
    type: 'expense',
    level: 3,
    parent: '5.03',
  },
  {
    code: '5.04',
    name: 'Gastos No Operativos',
    type: 'expense',
    level: 2,
    parent: '5',
  },
  {
    code: '5.04.01',
    name: 'Gastos Financieros',
    type: 'expense',
    level: 3,
    parent: '5.04',
  },
  {
    code: '5.04.01.01',
    name: 'Pérdida cambiaria realizada',
    type: 'expense',
    level: 4,
    parent: '5.04.01',
  },
  {
    code: '5.04.01.02',
    name: 'Pérdida cambiaria no realizada',
    type: 'expense',
    level: 4,
    parent: '5.04.01',
  },
];

/**
 * Obtener template según tipo de negocio
 */
export function getChartTemplate(
  businessType: BusinessType,
): AccountTemplate[] {
  switch (businessType) {
    case 'retail':
      return retailTemplate;
    case 'services':
      return servicesTemplate;
    case 'restaurant':
      return restaurantTemplate;
    case 'general':
    default:
      return generalTemplate;
  }
}

/**
 * Mapeos de cuentas por defecto según tipo de negocio
 */
export function getDefaultMappings(businessType: BusinessType): Array<{
  transaction_type: TransactionType;
  account_code: string;
  is_default?: boolean;
  conditions?: Record<string, any> | null;
}> {
  const baseMappings: Array<{
    transaction_type: TransactionType;
    account_code: string;
    is_default?: boolean;
    conditions?: Record<string, any> | null;
  }> = [
      {
        transaction_type: 'cash_asset' as TransactionType,
        account_code: '1.01.01',
        is_default: true,
      },
      // Mapeos por método de pago (no-default; se usan cuando conditions.method coincide)
      {
        transaction_type: 'cash_asset' as TransactionType,
        account_code: '1.01.01.01',
        is_default: false,
        conditions: { method: 'CASH_BS' },
      },
      {
        transaction_type: 'cash_asset' as TransactionType,
        account_code: '1.01.01.02',
        is_default: false,
        conditions: { method: 'CASH_USD' },
      },
      {
        transaction_type: 'cash_asset' as TransactionType,
        account_code: '1.01.02.01',
        is_default: false,
        conditions: { method: 'TRANSFER' },
      },
      {
        transaction_type: 'cash_asset' as TransactionType,
        account_code: '1.01.02.02',
        is_default: false,
        conditions: { method: 'PAGO_MOVIL' },
      },
      {
        transaction_type: 'cash_asset' as TransactionType,
        account_code: '1.01.02.03',
        is_default: false,
        conditions: { method: 'POINT_OF_SALE' },
      },
      {
        transaction_type: 'cash_asset' as TransactionType,
        account_code: '1.01.02.04',
        is_default: false,
        conditions: { method: 'ZELLE' },
      },
      {
        transaction_type: 'accounts_receivable' as TransactionType,
        account_code: '1.01.03',
        is_default: true,
      },
      {
        transaction_type: 'sale_tax' as TransactionType,
        account_code: '2.01.02',
        is_default: true,
      },
      {
        transaction_type: 'purchase_tax' as TransactionType,
        account_code: '1.01.04',
        is_default: true,
      },
      {
        transaction_type: 'accounts_payable' as TransactionType,
        account_code: '2.01.01',
        is_default: true,
      },
      {
        transaction_type: 'transfer' as TransactionType,
        account_code: '1.01.02',
        is_default: true,
      },
    ];

  // Mapeos específicos según tipo de negocio
  switch (businessType) {
    case 'retail':
      return [
        ...baseMappings,
        {
          transaction_type: 'inventory_asset' as TransactionType,
          account_code: '1.02.02',
        }, // Inventario de Productos
        {
          transaction_type: 'sale_revenue' as TransactionType,
          account_code: '4.01.01',
        }, // Ventas de Productos
        {
          transaction_type: 'sale_cost' as TransactionType,
          account_code: '5.01.01',
        }, // Costo de Productos Vendidos
        {
          transaction_type: 'purchase_expense' as TransactionType,
          account_code: '5.03.01',
        }, // Compras de Mercancía
        {
          transaction_type: 'expense' as TransactionType,
          account_code: '5.02.01',
        }, // Gastos de Personal
        {
          transaction_type: 'income' as TransactionType,
          account_code: '4.02.01',
        }, // Ingresos Financieros
        {
          transaction_type: 'adjustment' as TransactionType,
          account_code: '5.02.08',
          is_default: true,
        }, // Gastos Generales
        {
          transaction_type: 'fx_gain_realized' as TransactionType,
          account_code: '4.02.02.01',
          is_default: true,
        },
        {
          transaction_type: 'fx_gain_unrealized' as TransactionType,
          account_code: '4.02.02.02',
          is_default: true,
        },
        {
          transaction_type: 'fx_loss_realized' as TransactionType,
          account_code: '5.04.01.01',
          is_default: true,
        },
        {
          transaction_type: 'fx_loss_unrealized' as TransactionType,
          account_code: '5.04.01.02',
          is_default: true,
        },
      ];
    case 'services':
      return [
        ...baseMappings,
        {
          transaction_type: 'inventory_asset' as TransactionType,
          account_code: '1.01.01',
        }, // No hay inventario, usar caja
        {
          transaction_type: 'sale_revenue' as TransactionType,
          account_code: '4.01.01',
        }, // Ingresos por Consultoría
        {
          transaction_type: 'sale_cost' as TransactionType,
          account_code: '5.01.01',
        }, // Costo de Personal Directo
        {
          transaction_type: 'purchase_expense' as TransactionType,
          account_code: '5.01.03',
        }, // Materiales y Suministros
        {
          transaction_type: 'expense' as TransactionType,
          account_code: '5.02.01',
        }, // Gastos de Personal
        {
          transaction_type: 'income' as TransactionType,
          account_code: '4.02.01',
        }, // Ingresos Financieros
        {
          transaction_type: 'adjustment' as TransactionType,
          account_code: '5.02.09',
          is_default: true,
        }, // Gastos Generales
        {
          transaction_type: 'fx_gain_realized' as TransactionType,
          account_code: '4.02.01.01',
          is_default: true,
        },
        {
          transaction_type: 'fx_gain_unrealized' as TransactionType,
          account_code: '4.02.01.02',
          is_default: true,
        },
        {
          transaction_type: 'fx_loss_realized' as TransactionType,
          account_code: '5.03.01.01',
          is_default: true,
        },
        {
          transaction_type: 'fx_loss_unrealized' as TransactionType,
          account_code: '5.03.01.02',
          is_default: true,
        },
      ];
    case 'restaurant':
      return [
        ...baseMappings,
        {
          transaction_type: 'inventory_asset' as TransactionType,
          account_code: '1.02.01',
        }, // Inventario de Alimentos
        {
          transaction_type: 'sale_revenue' as TransactionType,
          account_code: '4.01.01',
        }, // Ventas de Alimentos
        {
          transaction_type: 'sale_cost' as TransactionType,
          account_code: '5.01.01',
        }, // Costo de Alimentos
        {
          transaction_type: 'purchase_expense' as TransactionType,
          account_code: '5.03.01',
        }, // Compras de Alimentos
        {
          transaction_type: 'expense' as TransactionType,
          account_code: '5.02.01',
        }, // Gastos de Personal
        {
          transaction_type: 'income' as TransactionType,
          account_code: '4.02.02',
        }, // Ingresos Varios
        {
          transaction_type: 'adjustment' as TransactionType,
          account_code: '5.02.11',
          is_default: true,
        }, // Mermas y Pérdidas
        {
          transaction_type: 'fx_gain_realized' as TransactionType,
          account_code: '4.02.03.01',
          is_default: true,
        },
        {
          transaction_type: 'fx_gain_unrealized' as TransactionType,
          account_code: '4.02.03.02',
          is_default: true,
        },
        {
          transaction_type: 'fx_loss_realized' as TransactionType,
          account_code: '5.04.01.01',
          is_default: true,
        },
        {
          transaction_type: 'fx_loss_unrealized' as TransactionType,
          account_code: '5.04.01.02',
          is_default: true,
        },
      ];
    case 'general':
    default:
      return [
        ...baseMappings,
        {
          transaction_type: 'inventory_asset' as TransactionType,
          account_code: '1.02.01',
        }, // Inventario
        {
          transaction_type: 'sale_revenue' as TransactionType,
          account_code: '4.01.01',
        }, // Ventas de Productos
        {
          transaction_type: 'sale_cost' as TransactionType,
          account_code: '5.01.01',
        }, // Costo de Productos Vendidos
        {
          transaction_type: 'purchase_expense' as TransactionType,
          account_code: '5.03.01',
        }, // Compras de Inventario
        {
          transaction_type: 'expense' as TransactionType,
          account_code: '5.02.01',
          is_default: true,
        }, // Gastos Generales
        {
          transaction_type: 'income' as TransactionType,
          account_code: '4.02.01',
          is_default: true,
        }, // Ingresos Varios
        {
          transaction_type: 'adjustment' as TransactionType,
          account_code: '5.02.01',
          is_default: true,
        }, // Gastos Generales
        {
          transaction_type: 'fx_gain_realized' as TransactionType,
          account_code: '4.02.02.01',
          is_default: true,
        },
        {
          transaction_type: 'fx_gain_unrealized' as TransactionType,
          account_code: '4.02.02.02',
          is_default: true,
        },
        {
          transaction_type: 'fx_loss_realized' as TransactionType,
          account_code: '5.04.01.01',
          is_default: true,
        },
        {
          transaction_type: 'fx_loss_unrealized' as TransactionType,
          account_code: '5.04.01.02',
          is_default: true,
        },
      ];
  }
}
