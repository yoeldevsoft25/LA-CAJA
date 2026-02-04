import { useQuery } from '@tanstack/react-query'
import { exchangeService } from '@/services/exchange.service'
import { customersService } from '@/services/customers.service'
import { paymentsService } from '@/services/payments.service'
import { invoiceSeriesService } from '@/services/invoice-series.service'
import { priceListsService } from '@/services/price-lists.service'
import { promotionsService } from '@/services/promotions.service'
import { warehousesService } from '@/services/warehouses.service'

/**
 * Hook para manejar todas las queries de datos del checkout
 */
export function useCheckoutData(options: {
    storeId: string | undefined
    isOpen: boolean
    customerSearch?: string
    selectedCustomerId?: string | null
}) {
    const {
        storeId,
        isOpen,
        customerSearch,
        selectedCustomerId,
    } = options
    const normalizedSearch = customerSearch?.trim() ?? ''
    const shouldFetchCustomers = isOpen && !!storeId

    // Exchange rate
    const exchangeRateQuery = useQuery({
        queryKey: ['exchange', 'bcv'],
        queryFn: () => exchangeService.getBCVRate(),
        staleTime: 1000 * 60 * 60 * 2, // 2 horas
        gcTime: Infinity,
        enabled: isOpen,
        refetchOnWindowFocus: false,
    })

    // Customers
    const customersQuery = useQuery({
        queryKey: ['customers', storeId, normalizedSearch || 'all', selectedCustomerId || 'none'],
        queryFn: async () => {
            if (normalizedSearch.length >= 2) {
                return customersService.search(normalizedSearch)
            }
            if (selectedCustomerId) {
                try {
                    const customer = await customersService.getById(selectedCustomerId)
                    return customer ? [customer] : []
                } catch {
                    return []
                }
            }
            // Importante para offline-first:
            // precarga clientes base para que el buscador funcione sin internet.
            return customersService.search('')
        },
        enabled: shouldFetchCustomers,
        staleTime: 1000 * 60 * 2, // 2 minutos
        placeholderData: (previous) => previous,
    })

    // Payment configurations
    const paymentConfigsQuery = useQuery({
        queryKey: ['payment-configs', storeId],
        queryFn: () => paymentsService.getPaymentMethodConfigs(),
        enabled: isOpen && !!storeId,
        staleTime: 1000 * 60 * 10, // 10 minutos
    })

    // Invoice series
    const invoiceSeriesQuery = useQuery({
        queryKey: ['invoice-series', storeId],
        queryFn: () => invoiceSeriesService.getSeriesByStore(),
        enabled: isOpen && !!storeId,
        staleTime: 1000 * 60 * 10,
    })

    // Price lists
    const priceListsQuery = useQuery({
        queryKey: ['price-lists', storeId],
        queryFn: () => priceListsService.getAll(),
        enabled: isOpen && !!storeId,
        staleTime: 1000 * 60 * 10,
    })

    // Promotions
    const promotionsQuery = useQuery({
        queryKey: ['promotions', storeId],
        queryFn: () => promotionsService.getActive(),
        enabled: isOpen && !!storeId,
        staleTime: 1000 * 60 * 5,
    })

    // Warehouses
    const warehousesQuery = useQuery({
        queryKey: ['warehouses', storeId],
        queryFn: () => warehousesService.getAll(),
        enabled: isOpen,
        staleTime: 1000 * 60 * 10,
    })

    const isLoading =
        exchangeRateQuery.isLoading ||
        customersQuery.isLoading ||
        paymentConfigsQuery.isLoading ||
        invoiceSeriesQuery.isLoading ||
        priceListsQuery.isLoading ||
        promotionsQuery.isLoading ||
        warehousesQuery.isLoading

    return {
        exchangeRate: exchangeRateQuery.data?.rate || 36,
        isLoadingExchangeRate: exchangeRateQuery.isLoading,

        customers: customersQuery.data || [],
        isLoadingCustomers: customersQuery.isLoading,

        paymentConfigs: paymentConfigsQuery.data || [],
        isLoadingPaymentConfigs: paymentConfigsQuery.isLoading,

        invoiceSeries: invoiceSeriesQuery.data || [],
        isLoadingInvoiceSeries: invoiceSeriesQuery.isLoading,

        priceLists: priceListsQuery.data || [],
        isLoadingPriceLists: priceListsQuery.isLoading,

        promotions: promotionsQuery.data || [],
        isLoadingPromotions: promotionsQuery.isLoading,

        warehouses: warehousesQuery.data || [],
        isLoadingWarehouses: warehousesQuery.isLoading,

        isLoading,
    }
}
