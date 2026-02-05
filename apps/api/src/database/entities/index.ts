// Core entities
export { Store } from './store.entity';
export { Profile } from './profile.entity';
export { User } from './user.entity';
export { StoreMember } from './store-member.entity';
export { Event } from './event.entity';
export { SecurityAuditLog } from './security-audit-log.entity';
export { RefreshToken } from './refresh-token.entity';
export { EmailVerificationToken } from './email-verification-token.entity';
export { PinRecoveryToken } from './pin-recovery-token.entity';
export { TwoFactorAuth } from './two-factor-auth.entity';

// Product entities
export { Product } from './product.entity';
export { ProductVariant } from './product-variant.entity';
export { ProductLot } from './product-lot.entity';
export { LotMovement } from './lot-movement.entity';
export { ProductSerial } from './product-serial.entity';
export { InventoryMovement } from './inventory-movement.entity';
export { QuickProduct } from './quick-product.entity';
export { RecipeIngredient } from './recipe-ingredient.entity';
export { ProductModifier } from './product-modifier.entity';
export { ProductModifierOption } from './product-modifier-option.entity';
export { CashLedgerEntry } from './cash-ledger-entry.entity';
export { StockEscrow } from './stock-escrow.entity';

// Sales entities
export { Sale } from './sale.entity';
export { SaleItem } from './sale-item.entity';
export { SaleReturn } from './sale-return.entity';
export { SaleReturnItem } from './sale-return-item.entity';
export { InvoiceSeries } from './invoice-series.entity';

// Cash & Sessions entities
export { CashSession } from './cash-session.entity';
export type { CashSessionStatus } from './cash-session.entity';
export { Shift } from './shift.entity';
export type { ShiftStatus } from './shift.entity';
export { ShiftCut } from './shift-cut.entity';
export type { CutType } from './shift-cut.entity';
export { PaymentMethodConfig } from './payment-method-config.entity';
export { CashMovement } from './cash-movement.entity';
export type { CashMovementType } from './cash-movement.entity';

// Customer & Debt entities
export { Customer } from './customer.entity';
export { Debt } from './debt.entity';
export type { DebtStatus } from './debt.entity';
export { DebtPayment } from './debt-payment.entity';

// Order entities
export { Table } from './table.entity';
export { QRCode } from './qr-code.entity';
export { Reservation } from './reservation.entity';
export { Order } from './order.entity';
export { OrderItem } from './order-item.entity';
export { OrderPayment } from './order-payment.entity';

// Configuration entities
export { PeripheralConfig } from './peripheral-config.entity';
export { PriceList } from './price-list.entity';
export { PriceListItem } from './price-list-item.entity';
export { DiscountConfig } from './discount-config.entity';
export { DiscountAuthorization } from './discount-authorization.entity';
export { FastCheckoutConfig } from './fast-checkout-config.entity';

// Promotion entities
export { Promotion } from './promotion.entity';
export { PromotionProduct } from './promotion-product.entity';
export { PromotionUsage } from './promotion-usage.entity';

// Warehouse & Transfer entities
export { Warehouse } from './warehouse.entity';
export { WarehouseStock } from './warehouse-stock.entity';
export { Transfer } from './transfer.entity';
export { TransferItem } from './transfer-item.entity';

// Supplier & Purchase entities
export { Supplier } from './supplier.entity';
export { SupplierPriceList } from './supplier-price-list.entity';
export { SupplierPriceListItem } from './supplier-price-list-item.entity';
export { PurchaseOrder } from './purchase-order.entity';
export { PurchaseOrderItem } from './purchase-order-item.entity';

// Fiscal entities
export { FiscalInvoice } from './fiscal-invoice.entity';
export { FiscalInvoiceItem } from './fiscal-invoice-item.entity';
export { FiscalConfig } from './fiscal-config.entity';

// WhatsApp entities
export { WhatsAppConfig } from './whatsapp-config.entity';
export { WhatsAppMessageQueue } from './whatsapp-message-queue.entity';

// Exchange entities
export { ExchangeRate } from './exchange-rate.entity';
export type { ExchangeRateType } from './exchange-rate.entity';
export { StoreRateConfig } from './store-rate-config.entity';
export { SalePayment } from './sale-payment.entity';
export type { PaymentMethod, PaymentStatus } from './sale-payment.entity';
export { SaleChange } from './sale-change.entity';
export type {
  ChangeMethod,
  ExcessAction,
  ChangeBreakdown,
} from './sale-change.entity';

// ML & Analytics entities
export { DemandPrediction } from './demand-prediction.entity';
export { ProductRecommendation } from './product-recommendation.entity';
export { DetectedAnomaly } from './detected-anomaly.entity';
export { MLModelMetric } from './ml-model-metric.entity';
export { RealTimeMetric } from './real-time-metric.entity';
export { AlertThreshold } from './alert-threshold.entity';
export { RealTimeAlert } from './real-time-alert.entity';
export { SalesHeatmap } from './sales-heatmap.entity';
export { ComparativeMetric } from './comparative-metric.entity';

// Notification entities
export { Notification } from './notification.entity';
export { NotificationPreference } from './notification-preference.entity';
export { NotificationSubscription } from './notification-subscription.entity';
export { NotificationDelivery } from './notification-delivery.entity';
export { NotificationBadge } from './notification-badge.entity';
export { NotificationTemplate } from './notification-template.entity';
export { MLInsight } from './ml-insight.entity';
export { NotificationAnalytics } from './notification-analytics.entity';
export { EmailQueue } from './email-queue.entity';

// Accounting entities
export { ChartOfAccount } from './chart-of-accounts.entity';
export { JournalEntry } from './journal-entry.entity';
export { JournalEntryLine } from './journal-entry-line.entity';
export { AccountingAccountMapping } from './accounting-account-mapping.entity';
export { AccountBalance } from './account-balance.entity';
export { AccountingExport } from './accounting-export.entity';
export { AccountingERPSync } from './accounting-erp-sync.entity';
export { AccountingPeriod } from './accounting-period.entity';
export type { AccountingPeriodStatus } from './accounting-period.entity';

// License payment entities
export {
  LicensePayment,
  LicensePaymentStatus,
  LicensePaymentMethod,
  LicensePlan,
  BillingPeriod,
} from './license-payment.entity';
export {
  LicensePaymentDocument,
  DocumentFileType,
} from './license-payment-document.entity';
export {
  LicensePaymentVerification,
  VerificationMethod,
  VerificationStatus,
} from './license-payment-verification.entity';
export { SubscriptionPlan } from './license-plan.entity';
export {
  StoreLicense,
  LicenseStatus,
  SubscriptionPeriod,
} from './store-license.entity';
export { LicenseUsage } from './license-usage.entity';

// Export all entities as an array for TypeORM configuration
import { Store } from './store.entity';
import { Profile } from './profile.entity';
import { User } from './user.entity';
import { StoreMember } from './store-member.entity';
import { Product } from './product.entity';
import { ProductVariant } from './product-variant.entity';
import { ProductLot } from './product-lot.entity';
import { LotMovement } from './lot-movement.entity';
import { ProductSerial } from './product-serial.entity';
import { InvoiceSeries } from './invoice-series.entity';
import { Table } from './table.entity';
import { Order } from './order.entity';
import { OrderItem } from './order-item.entity';
import { OrderPayment } from './order-payment.entity';
import { PeripheralConfig } from './peripheral-config.entity';
import { PriceList } from './price-list.entity';
import { PriceListItem } from './price-list-item.entity';
import { Promotion } from './promotion.entity';
import { PromotionProduct } from './promotion-product.entity';
import { PromotionUsage } from './promotion-usage.entity';
import { InventoryMovement } from './inventory-movement.entity';
import { Sale } from './sale.entity';
import { SaleItem } from './sale-item.entity';
import { SaleReturn } from './sale-return.entity';
import { SaleReturnItem } from './sale-return-item.entity';
import { CashSession } from './cash-session.entity';
import { Shift } from './shift.entity';
import { ShiftCut } from './shift-cut.entity';
import { PaymentMethodConfig } from './payment-method-config.entity';
import { CashMovement } from './cash-movement.entity';
import { DiscountConfig } from './discount-config.entity';
import { DiscountAuthorization } from './discount-authorization.entity';
import { FastCheckoutConfig } from './fast-checkout-config.entity';
import { QuickProduct } from './quick-product.entity';
import { Customer } from './customer.entity';
import { Debt } from './debt.entity';
import { DebtPayment } from './debt-payment.entity';
import { ExchangeRate } from './exchange-rate.entity';
import { StoreRateConfig } from './store-rate-config.entity';
import { SalePayment } from './sale-payment.entity';
import { SaleChange } from './sale-change.entity';
import { Warehouse } from './warehouse.entity';
import { WarehouseStock } from './warehouse-stock.entity';
import { Transfer } from './transfer.entity';
import { TransferItem } from './transfer-item.entity';
import { Supplier } from './supplier.entity';
import { SupplierPriceList } from './supplier-price-list.entity';
import { SupplierPriceListItem } from './supplier-price-list-item.entity';
import { PurchaseOrder } from './purchase-order.entity';
import { PurchaseOrderItem } from './purchase-order-item.entity';
import { FiscalInvoice } from './fiscal-invoice.entity';
import { FiscalInvoiceItem } from './fiscal-invoice-item.entity';
import { FiscalConfig } from './fiscal-config.entity';
import { WhatsAppConfig } from './whatsapp-config.entity';
import { WhatsAppMessageQueue } from './whatsapp-message-queue.entity';
import { DemandPrediction } from './demand-prediction.entity';
import { ProductRecommendation } from './product-recommendation.entity';
import { DetectedAnomaly } from './detected-anomaly.entity';
import { MLModelMetric } from './ml-model-metric.entity';
import { RealTimeMetric } from './real-time-metric.entity';
import { AlertThreshold } from './alert-threshold.entity';
import { RealTimeAlert } from './real-time-alert.entity';
import { SalesHeatmap } from './sales-heatmap.entity';
import { ComparativeMetric } from './comparative-metric.entity';
import { Notification } from './notification.entity';
import { NotificationPreference } from './notification-preference.entity';
import { NotificationSubscription } from './notification-subscription.entity';
import { NotificationDelivery } from './notification-delivery.entity';
import { NotificationBadge } from './notification-badge.entity';
import { NotificationTemplate } from './notification-template.entity';
import { MLInsight } from './ml-insight.entity';
import { NotificationAnalytics } from './notification-analytics.entity';
import { EmailQueue } from './email-queue.entity';
import { ChartOfAccount } from './chart-of-accounts.entity';
import { JournalEntry } from './journal-entry.entity';
import { JournalEntryLine } from './journal-entry-line.entity';
import { AccountingAccountMapping } from './accounting-account-mapping.entity';
import { AccountBalance } from './account-balance.entity';
import { AccountingExport } from './accounting-export.entity';
import { AccountingERPSync } from './accounting-erp-sync.entity';
import { AccountingPeriod } from './accounting-period.entity';
import { Event } from './event.entity';
import { SecurityAuditLog } from './security-audit-log.entity';
import { RefreshToken } from './refresh-token.entity';
import { EmailVerificationToken } from './email-verification-token.entity';
import { PinRecoveryToken } from './pin-recovery-token.entity';
import { TwoFactorAuth } from './two-factor-auth.entity';
import { LicensePayment } from './license-payment.entity';
import { LicensePaymentDocument } from './license-payment-document.entity';
import { LicensePaymentVerification } from './license-payment-verification.entity';
import { QRCode } from './qr-code.entity';
import { Reservation } from './reservation.entity';
import { SubscriptionPlan } from './license-plan.entity';
import { StoreLicense } from './store-license.entity';
import { LicenseUsage } from './license-usage.entity';
import { RecipeIngredient } from './recipe-ingredient.entity';
import { ProductModifier } from './product-modifier.entity';
import { ProductModifierOption } from './product-modifier-option.entity';
import { CashLedgerEntry } from './cash-ledger-entry.entity';
import { StockEscrow } from './stock-escrow.entity';

/**
 * Array con todas las entidades de TypeORM para configuración centralizada
 * Esto reduce el tamaño del objeto serializado en NestJS y mejora el rendimiento
 * Nota: No usar 'as const' para permitir que TypeORM acepte el array
 */
export const ALL_ENTITIES = [
  Store,
  Profile,
  User,
  StoreMember,
  Product,
  ProductVariant,
  ProductLot,
  LotMovement,
  ProductSerial,
  InvoiceSeries,
  Table,
  QRCode,
  Reservation,
  Order,
  OrderItem,
  OrderPayment,
  PeripheralConfig,
  PriceList,
  PriceListItem,
  Promotion,
  PromotionProduct,
  PromotionUsage,
  InventoryMovement,
  Sale,
  SaleItem,
  SaleReturn,
  SaleReturnItem,
  CashSession,
  Shift,
  ShiftCut,
  PaymentMethodConfig,
  CashMovement,
  DiscountConfig,
  DiscountAuthorization,
  FastCheckoutConfig,
  QuickProduct,
  Customer,
  Debt,
  DebtPayment,
  ExchangeRate,
  StoreRateConfig,
  SalePayment,
  SaleChange,
  Warehouse,
  WarehouseStock,
  Transfer,
  TransferItem,
  Supplier,
  SupplierPriceList,
  SupplierPriceListItem,
  PurchaseOrder,
  PurchaseOrderItem,
  FiscalInvoice,
  FiscalInvoiceItem,
  FiscalConfig,
  WhatsAppConfig,
  WhatsAppMessageQueue,
  DemandPrediction,
  ProductRecommendation,
  DetectedAnomaly,
  MLModelMetric,
  RealTimeMetric,
  AlertThreshold,
  RealTimeAlert,
  SalesHeatmap,
  ComparativeMetric,
  Notification,
  NotificationPreference,
  NotificationSubscription,
  NotificationDelivery,
  NotificationBadge,
  NotificationTemplate,
  MLInsight,
  NotificationAnalytics,
  EmailQueue,
  ChartOfAccount,
  JournalEntry,
  JournalEntryLine,
  AccountingAccountMapping,
  AccountBalance,
  AccountingExport,
  AccountingERPSync,
  AccountingPeriod,
  Event,
  SecurityAuditLog,
  RefreshToken,
  EmailVerificationToken,
  PinRecoveryToken,
  TwoFactorAuth,
  LicensePayment,
  LicensePaymentDocument,
  LicensePaymentVerification,
  SubscriptionPlan,
  StoreLicense,
  LicenseUsage,
  RecipeIngredient,
  ProductModifier,
  ProductModifierOption,
  CashLedgerEntry,
  StockEscrow,
];
