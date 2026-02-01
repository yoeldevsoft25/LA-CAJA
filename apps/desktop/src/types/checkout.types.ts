export type CheckoutPaymentMode = 'SINGLE' | 'SPLIT'

export type SinglePaymentMethod = 'CASH_BS' | 'CASH_USD' | 'PAGO_MOVIL' | 'TRANSFER' | 'OTHER' | 'FIAO'

export interface CustomerData {
    id?: string | null
    name: string
    documentId: string
    phone?: string
    note?: string
}

export type CashChangeRoundingMode = 'EXACT' | 'CUSTOMER' | 'MERCHANT'

export interface CashPaymentData {
    receivedUsd: number
    receivedBs: number
    giveChangeInBs: boolean
    changeRoundingMode: CashChangeRoundingMode
    changeRoundingConsent: boolean
}

export interface InvoiceConfig {
    seriesId: string | null
    priceListId: string | null
    promotionId: string | null
    warehouseId: string | null
    generateFiscalInvoice: boolean
}

export interface CheckoutState {
    // Payment
    paymentMode: CheckoutPaymentMode
    selectedMethod: SinglePaymentMethod

    // Customer
    customerData: {
        selectedId: string | null
        name: string
        documentId: string
        phone: string
        note: string
        search: string
    }

    // Cash handling
    cash: CashPaymentData

    // Invoice configuration
    invoice: InvoiceConfig

    // Notes
    saleNote: string

    // Error
    error: string
}

export type CheckoutAction =
    | { type: 'SET_PAYMENT_MODE'; payload: CheckoutPaymentMode }
    | { type: 'SET_PAYMENT_METHOD'; payload: SinglePaymentMethod }
    | { type: 'SET_CUSTOMER_ID'; payload: string | null }
    | { type: 'SET_CUSTOMER_NAME'; payload: string }
    | { type: 'SET_CUSTOMER_DOCUMENT'; payload: string }
    | { type: 'SET_CUSTOMER_PHONE'; payload: string }
    | { type: 'SET_CUSTOMER_NOTE'; payload: string }
    | { type: 'SET_CUSTOMER_SEARCH'; payload: string }
    | { type: 'SET_RECEIVED_USD'; payload: number }
    | { type: 'SET_RECEIVED_BS'; payload: number }
    | { type: 'SET_GIVE_CHANGE_IN_BS'; payload: boolean }
    | { type: 'SET_CHANGE_ROUNDING_MODE'; payload: CashChangeRoundingMode }
    | { type: 'SET_CHANGE_ROUNDING_CONSENT'; payload: boolean }
    | { type: 'SET_INVOICE_SERIES'; payload: string | null }
    | { type: 'SET_PRICE_LIST'; payload: string | null }
    | { type: 'SET_PROMOTION'; payload: string | null }
    | { type: 'SET_WAREHOUSE'; payload: string | null }
    | { type: 'SET_GENERATE_FISCAL_INVOICE'; payload: boolean }
    | { type: 'SET_SALE_NOTE'; payload: string }
    | { type: 'SET_ERROR'; payload: string }
    | { type: 'RESET' }
