export interface Customer {
    id: string
    store_id: string
    name: string
    document_id: string | null
    phone: string | null
    email: string | null
    credit_limit: number | null
    note: string | null
    debt_cutoff_at?: string | null
    created_at: string
    updated_at: string
}

export interface CreateCustomerDto {
    name: string
    document_id?: string
    phone?: string
    email?: string
    credit_limit?: number | null
    note?: string
}

export interface UpdateCustomerDto {
    name?: string
    document_id?: string
    phone?: string
    email?: string
    credit_limit?: number | null
    note?: string
}

export interface CustomerPurchaseHistory {
    total_purchases: number
    total_amount_usd: number
    total_amount_bs: number
    first_purchase_at: string | null
    last_purchase_at: string | null
    average_purchase_usd: number
    recent_sales: Array<{
        id: string
        sale_number: number | null
        sold_at: string
        total_usd: number
        total_bs: number
        payment_method: string
    }>
}

export interface CreditCheckResult {
    available: boolean
    credit_limit: number | null
    current_debt: number
    available_credit: number
    message: string
}
