import { useReducer, useCallback } from 'react'
import { CheckoutState, CheckoutAction, CheckoutPaymentMode, SinglePaymentMethod, CashChangeRoundingMode } from '@/types/checkout.types'

const initialState: CheckoutState = {
    paymentMode: 'SINGLE',
    selectedMethod: 'CASH_USD',
    customerData: {
        selectedId: null,
        name: '',
        documentId: '',
        phone: '',
        note: '',
        search: '',
    },
    cash: {
        receivedUsd: 0,
        receivedBs: 0,
        giveChangeInBs: false,
        changeRoundingMode: 'CUSTOMER',
        changeRoundingConsent: false,
    },
    invoice: {
        seriesId: null,
        priceListId: null,
        promotionId: null,
        warehouseId: null,
        generateFiscalInvoice: false,
    },
    saleNote: '',
    error: '',
}

function checkoutReducer(state: CheckoutState, action: CheckoutAction): CheckoutState {
    switch (action.type) {
        case 'SET_PAYMENT_MODE':
            return { ...state, paymentMode: action.payload }
        case 'SET_PAYMENT_METHOD':
            return { ...state, selectedMethod: action.payload }
        case 'SET_CUSTOMER_ID':
            return { ...state, customerData: { ...state.customerData, selectedId: action.payload } }
        case 'SET_CUSTOMER_NAME':
            return { ...state, customerData: { ...state.customerData, name: action.payload } }
        case 'SET_CUSTOMER_DOCUMENT':
            return { ...state, customerData: { ...state.customerData, documentId: action.payload } }
        case 'SET_CUSTOMER_PHONE':
            return { ...state, customerData: { ...state.customerData, phone: action.payload } }
        case 'SET_CUSTOMER_NOTE':
            return { ...state, customerData: { ...state.customerData, note: action.payload } }
        case 'SET_CUSTOMER_SEARCH':
            return { ...state, customerData: { ...state.customerData, search: action.payload } }
        case 'SET_RECEIVED_USD':
            return { ...state, cash: { ...state.cash, receivedUsd: action.payload } }
        case 'SET_RECEIVED_BS':
            return { ...state, cash: { ...state.cash, receivedBs: action.payload } }
        case 'SET_GIVE_CHANGE_IN_BS':
            return { ...state, cash: { ...state.cash, giveChangeInBs: action.payload } }
        case 'SET_CHANGE_ROUNDING_MODE':
            return { ...state, cash: { ...state.cash, changeRoundingMode: action.payload } }
        case 'SET_CHANGE_ROUNDING_CONSENT':
            return { ...state, cash: { ...state.cash, changeRoundingConsent: action.payload } }
        case 'SET_INVOICE_SERIES':
            return { ...state, invoice: { ...state.invoice, seriesId: action.payload } }
        case 'SET_PRICE_LIST':
            return { ...state, invoice: { ...state.invoice, priceListId: action.payload } }
        case 'SET_PROMOTION':
            return { ...state, invoice: { ...state.invoice, promotionId: action.payload } }
        case 'SET_WAREHOUSE':
            return { ...state, invoice: { ...state.invoice, warehouseId: action.payload } }
        case 'SET_GENERATE_FISCAL_INVOICE':
            return { ...state, invoice: { ...state.invoice, generateFiscalInvoice: action.payload } }
        case 'SET_SALE_NOTE':
            return { ...state, saleNote: action.payload }
        case 'SET_ERROR':
            return { ...state, error: action.payload }
        case 'RESET':
            return initialState
        default:
            return state
    }
}

export function useCheckoutState() {
    const [state, dispatch] = useReducer(checkoutReducer, initialState)

    const actions = {
        setPaymentMode: useCallback((mode: CheckoutPaymentMode) => {
            dispatch({ type: 'SET_PAYMENT_MODE', payload: mode })
        }, []),

        setPaymentMethod: useCallback((method: SinglePaymentMethod) => {
            dispatch({ type: 'SET_PAYMENT_METHOD', payload: method })
        }, []),

        setCustomerId: useCallback((id: string | null) => {
            dispatch({ type: 'SET_CUSTOMER_ID', payload: id })
        }, []),

        setCustomerName: useCallback((name: string) => {
            dispatch({ type: 'SET_CUSTOMER_NAME', payload: name })
        }, []),

        setCustomerDocument: useCallback((doc: string) => {
            dispatch({ type: 'SET_CUSTOMER_DOCUMENT', payload: doc })
        }, []),

        setCustomerPhone: useCallback((phone: string) => {
            dispatch({ type: 'SET_CUSTOMER_PHONE', payload: phone })
        }, []),

        setCustomerNote: useCallback((note: string) => {
            dispatch({ type: 'SET_CUSTOMER_NOTE', payload: note })
        }, []),

        setCustomerSearch: useCallback((search: string) => {
            dispatch({ type: 'SET_CUSTOMER_SEARCH', payload: search })
        }, []),

        setReceivedUsd: useCallback((amount: number) => {
            dispatch({ type: 'SET_RECEIVED_USD', payload: amount })
        }, []),

        setReceivedBs: useCallback((amount: number) => {
            dispatch({ type: 'SET_RECEIVED_BS', payload: amount })
        }, []),

        setGiveChangeInBs: useCallback((value: boolean) => {
            dispatch({ type: 'SET_GIVE_CHANGE_IN_BS', payload: value })
        }, []),

        setChangeRoundingMode: useCallback((mode: CashChangeRoundingMode) => {
            dispatch({ type: 'SET_CHANGE_ROUNDING_MODE', payload: mode })
        }, []),

        setChangeRoundingConsent: useCallback((value: boolean) => {
            dispatch({ type: 'SET_CHANGE_ROUNDING_CONSENT', payload: value })
        }, []),

        setInvoiceSeries: useCallback((id: string | null) => {
            dispatch({ type: 'SET_INVOICE_SERIES', payload: id })
        }, []),

        setPriceList: useCallback((id: string | null) => {
            dispatch({ type: 'SET_PRICE_LIST', payload: id })
        }, []),

        setPromotion: useCallback((id: string | null) => {
            dispatch({ type: 'SET_PROMOTION', payload: id })
        }, []),

        setWarehouse: useCallback((id: string | null) => {
            dispatch({ type: 'SET_WAREHOUSE', payload: id })
        }, []),

        setGenerateFiscalInvoice: useCallback((value: boolean) => {
            dispatch({ type: 'SET_GENERATE_FISCAL_INVOICE', payload: value })
        }, []),

        setSaleNote: useCallback((note: string) => {
            dispatch({ type: 'SET_SALE_NOTE', payload: note })
        }, []),

        setError: useCallback((error: string) => {
            dispatch({ type: 'SET_ERROR', payload: error })
        }, []),

        reset: useCallback(() => {
            dispatch({ type: 'RESET' })
        }, []),
    }

    return { state, actions }
}
