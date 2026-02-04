import { useState } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { Search, Plus, Edit, Users, Phone, CreditCard, FileText, History, Mail, DollarSign, Trash2, AlertTriangle, Printer, MessageCircle } from 'lucide-react'
import { customersService, Customer } from '@/services/customers.service'
import { debtsService, DebtSummary } from '@/services/debts.service'
import { useAuth } from '@/stores/auth.store'
import CustomerFormModal from '@/components/customers/CustomerFormModal'
import CustomerHistoryModal from '@/components/customers/CustomerHistoryModal'
import CustomerStatementModal from '@/components/customers/CustomerStatementModal'
import LegacyDebtModal from '@/components/customers/LegacyDebtModal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import toast from '@/lib/toast'

export default function CustomersPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [isStatementOpen, setIsStatementOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null)
  const [customerDebtSummary, setCustomerDebtSummary] = useState<DebtSummary | null>(null)
  const [isLoadingDebt, setIsLoadingDebt] = useState(false)
  const [isLegacyDebtOpen, setIsLegacyDebtOpen] = useState(false)
  const queryClient = useQueryClient()
  const { user } = useAuth()

  // Obtener datos del prefetch como placeholderData
  const prefetchedCustomers = queryClient.getQueryData<Customer[]>(['customers', ''])

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['customers', searchQuery],
    queryFn: () => customersService.search(searchQuery || undefined),
    placeholderData: searchQuery === '' ? prefetchedCustomers : undefined,
    staleTime: 1000 * 60 * 30, // 30 minutos
    gcTime: Infinity,
    refetchOnMount: false,
  })

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer)
    setIsFormOpen(true)
  }

  const handleViewHistory = (customer: Customer) => {
    setSelectedCustomer(customer)
    setIsHistoryOpen(true)
  }

  const handleViewStatement = (customer: Customer) => {
    setSelectedCustomer(customer)
    setIsStatementOpen(true)
  }

  const handleCloseStatement = () => {
    setIsStatementOpen(false)
    setSelectedCustomer(null)
  }

  const handleOpenLegacyDebt = (customer: Customer) => {
    setSelectedCustomer(customer)
    setIsLegacyDebtOpen(true)
  }

  const handleCloseLegacyDebt = () => {
    setIsLegacyDebtOpen(false)
    setSelectedCustomer(null)
  }

  const handleCreate = () => {
    setEditingCustomer(null)
    setIsFormOpen(true)
  }

  const handleCloseForm = () => {
    setIsFormOpen(false)
    setEditingCustomer(null)
  }

  const handleCloseHistory = () => {
    setIsHistoryOpen(false)
    setSelectedCustomer(null)
  }

  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['customers'] })
    handleCloseForm()
  }

  // Handlers para comunicación con clientes
  const handleCall = (phone: string) => {
    if (!phone) {
      toast.error('El cliente no tiene teléfono registrado')
      return
    }
    const cleanPhone = phone.replace(/\D/g, '') // Remover caracteres no numéricos
    const telUrl = `tel:${cleanPhone}`
    window.location.href = telUrl
  }

  const handleWhatsApp = (phone: string, customerName: string) => {
    if (!phone) {
      toast.error('El cliente no tiene teléfono registrado')
      return
    }
    const cleanPhone = phone.replace(/\D/g, '') // Remover caracteres no numéricos
    // Formato para WhatsApp: solo números sin + ni espacios
    const whatsappPhone = cleanPhone.startsWith('58') ? cleanPhone : `58${cleanPhone}`
    const message = encodeURIComponent(`Hola ${customerName},`)
    const whatsappUrl = `https://wa.me/${whatsappPhone}?text=${message}`
    window.open(whatsappUrl, '_blank')
  }

  // Mutación para eliminar cliente
  const deleteMutation = useMutation({
    mutationFn: (id: string) => customersService.delete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['customers'] })
      const previousCustomers = queryClient.getQueryData(['customers', ''])

      queryClient.setQueriesData({ queryKey: ['customers'] }, (old: any) => {
        if (!Array.isArray(old)) return old
        return old.filter((c: Customer) => c.id !== id)
      })

      return { previousCustomers }
    },
    onSuccess: () => {
      toast.success('Cliente eliminado exitosamente')
      setShowDeleteConfirm(false)
      setCustomerToDelete(null)
      setCustomerDebtSummary(null)
    },
    onError: async (error: any, id, context) => {
      // ✅ OFFLINE-FIRST
      if (error.isOffline || error.code === 'ERR_INTERNET_DISCONNECTED' || !navigator.onLine) {
        try {
          const { syncService } = await import('@/services/sync.service')

          await syncService.enqueueEvent({
            event_id: crypto.randomUUID(),
            type: 'customers.deleted',
            payload: { id },
            created_at: Date.now(),
            seq: 0,
            store_id: user?.store_id || '',
            device_id: localStorage.getItem('device_id') || 'unknown',
            version: 1,
            actor: {
              user_id: user?.user_id || 'unknown',
              role: (user?.role as any) || 'cashier',
            },
          })

          toast.success('Eliminación guardada localmente')
          setShowDeleteConfirm(false)
          setCustomerToDelete(null)
          return
        } catch (queueError) {
          console.error('Error al encolar offline:', queueError)
        }
      }

      if (context?.previousCustomers) {
        queryClient.setQueriesData({ queryKey: ['customers'] }, context.previousCustomers)
      }

      const message = error.response?.data?.message || 'Error al eliminar el cliente'
      toast.error(message)
    },
    onSettled: () => {
      if (navigator.onLine) {
        queryClient.invalidateQueries({ queryKey: ['customers'] })
      }
    }
  })

  // Manejar solicitud de eliminar (verificar deudas primero)
  const handleDeleteRequest = async (customer: Customer) => {
    setCustomerToDelete(customer)
    setIsLoadingDebt(true)
    setCustomerDebtSummary(null)
    setShowDeleteConfirm(true)

    try {
      const summary = await debtsService.getCustomerSummary(customer.id)
      setCustomerDebtSummary(summary)
    } catch (error) {
      // Si no hay deudas o error, mostrar como sin deuda
      setCustomerDebtSummary(null)
    } finally {
      setIsLoadingDebt(false)
    }
  }

  // Confirmar eliminación
  const confirmDelete = () => {
    if (customerToDelete) {
      deleteMutation.mutate(customerToDelete.id)
    }
  }

  // Cancelar eliminación
  const cancelDelete = () => {
    setShowDeleteConfirm(false)
    setCustomerToDelete(null)
    setCustomerDebtSummary(null)
  }

  // Verificar si el cliente tiene deuda pendiente
  const hasOpenDebt = customerDebtSummary && customerDebtSummary.remaining_usd > 0

  return (
    <div className="h-full max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Gestión de Clientes</h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              {customers.length} {customers.length === 1 ? 'cliente' : 'clientes'} registrados
            </p>
          </div>
          <Button
            onClick={handleCreate}
            variant="default"
          >
            <Plus className="w-5 h-5 mr-2" />
            Nuevo Cliente
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4 sm:mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5 z-10" />
          <Input
            type="text"
            placeholder="Buscar por nombre, cédula, teléfono o email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4 py-2.5 sm:py-3 text-base sm:text-lg"
            autoFocus
          />
        </div>
      </div>

      {/* Customer List */}
      <Card className="border border-border">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="flex flex-col items-center justify-center py-8">
                <Users className="w-12 h-12 mx-auto mb-3 text-muted-foreground animate-pulse" />
                <p className="text-muted-foreground">Cargando clientes...</p>
              </div>
            </div>
          ) : customers.length === 0 ? (
            <div className="p-8 text-center">
              <div className="flex flex-col items-center justify-center py-8">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Users className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-lg font-medium text-foreground mb-1">
                  {searchQuery ? 'No se encontraron clientes' : 'No hay clientes registrados'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {searchQuery
                    ? 'Intenta con otro término de búsqueda'
                    : 'Haz clic en "Nuevo Cliente" para comenzar'}
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
                        Cliente
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
                        Cédula
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
                        Contacto
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
                        Crédito
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-foreground uppercase tracking-wider">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-background divide-y divide-border">
                    {customers.map((customer) => (
                      <tr key={customer.id} className="hover:bg-accent/50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center">
                            <Avatar className="w-10 h-10 mr-3">
                              <AvatarFallback className="bg-primary/10 text-primary">
                                {customer.name.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-semibold text-foreground">{customer.name}</p>
                              {customer.note && (
                                <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                                  {customer.note}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {customer.document_id || '-'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm space-y-0.5">
                            {customer.phone && (
                              <div className="flex items-center text-muted-foreground">
                                <Phone className="w-3.5 h-3.5 mr-1.5" />
                                {customer.phone}
                              </div>
                            )}
                            {customer.email && (
                              <div className="flex items-center text-muted-foreground">
                                <Mail className="w-3.5 h-3.5 mr-1.5" />
                                <span className="truncate max-w-[150px]">{customer.email}</span>
                              </div>
                            )}
                            {!customer.phone && !customer.email && '-'}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {customer.credit_limit !== null && customer.credit_limit > 0 ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              <DollarSign className="w-3 h-3 mr-1" />
                              {Number(customer.credit_limit).toFixed(2)}
                            </Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">Sin crédito</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {customer.phone && (
                              <>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleCall(customer.phone!)}
                                        className="h-9 w-9 min-h-[44px] min-w-[44px] text-green-600 hover:text-green-700 hover:bg-green-50"
                                        aria-label="Llamar"
                                      >
                                        <Phone className="w-4 h-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Llamar a {customer.phone}</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleWhatsApp(customer.phone!, customer.name)}
                                        className="h-9 w-9 min-h-[44px] min-w-[44px] text-green-600 hover:text-green-700 hover:bg-green-50"
                                        aria-label="WhatsApp"
                                      >
                                        <MessageCircle className="w-4 h-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Enviar WhatsApp</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </>
                            )}
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleViewHistory(customer)}
                                    className="h-9 w-9 min-h-[44px] min-w-[44px]"
                                  >
                                    <History className="w-4 h-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Ver historial de compras</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleViewStatement(customer)}
                                    className="h-9 w-9 min-h-[44px] min-w-[44px]"
                                  >
                                    <Printer className="w-4 h-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Estado de cuenta</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleEdit(customer)}
                                    className="h-9 w-9 min-h-[44px] min-w-[44px]"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Editar cliente</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDeleteRequest(customer)}
                                    className="h-9 w-9 min-h-[44px] min-w-[44px] text-destructive hover:text-destructive hover:bg-destructive/10"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Eliminar cliente</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden divide-y divide-border">
                {customers.map((customer) => (
                  <div key={customer.id} className="p-4 hover:bg-accent/50 transition-colors">
                    {/* Header: Avatar + Name + Credit Limit */}
                    <div className="flex items-start gap-3 mb-3">
                      <Avatar className="w-14 h-14 flex-shrink-0">
                        <AvatarFallback className="bg-primary/10 text-primary text-base font-bold">
                          {customer.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground text-base mb-1 truncate">{customer.name}</p>
                        {customer.credit_limit !== null && customer.credit_limit > 0 && (
                          <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                            <DollarSign className="w-3 h-3 mr-1" />
                            Crédito: ${Number(customer.credit_limit).toFixed(2)}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Contact Info Grid */}
                    <div className="grid grid-cols-1 gap-2 mb-3">
                      {customer.document_id && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <CreditCard className="w-4 h-4 flex-shrink-0 text-muted-foreground/70" />
                          <span className="truncate">{customer.document_id}</span>
                        </div>
                      )}
                      {customer.phone && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Phone className="w-4 h-4 flex-shrink-0 text-muted-foreground/70" />
                          <span className="truncate">{customer.phone}</span>
                        </div>
                      )}
                      {customer.email && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Mail className="w-4 h-4 flex-shrink-0 text-muted-foreground/70" />
                          <span className="truncate">{customer.email}</span>
                        </div>
                      )}
                      {customer.note && (
                        <div className="flex items-start gap-2 text-sm text-muted-foreground pt-1">
                          <FileText className="w-4 h-4 flex-shrink-0 text-muted-foreground/70 mt-0.5" />
                          <span className="line-clamp-2">{customer.note}</span>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-3 border-t border-border/50 space-y-2">
                      {customer.phone && (
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCall(customer.phone!)}
                            className="h-10 text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700"
                          >
                            <Phone className="w-4 h-4 mr-2" />
                            Llamar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleWhatsApp(customer.phone!, customer.name)}
                            className="h-10 text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700"
                          >
                            <MessageCircle className="w-4 h-4 mr-2" />
                            WhatsApp
                          </Button>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewHistory(customer)}
                          className="h-10"
                        >
                          <History className="w-4 h-4 mr-2" />
                          Historial
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewStatement(customer)}
                          className="h-10"
                        >
                          <Printer className="w-4 h-4 mr-2" />
                          Estado
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenLegacyDebt(customer)}
                          className="h-10 text-amber-600 border-amber-200 hover:bg-amber-50 hover:text-amber-700"
                        >
                          <DollarSign className="w-4 h-4 mr-2" />
                          Deuda Antigua
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(customer)}
                          className="h-10 flex-1"
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Editar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteRequest(customer)}
                          className="h-10 flex-1 text-destructive border-destructive/20 hover:bg-destructive/10"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Eliminar
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Form Modal */}
      <CustomerFormModal
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        customer={editingCustomer}
        onSuccess={handleSuccess}
      />

      {/* History Modal */}
      <CustomerHistoryModal
        isOpen={isHistoryOpen}
        onClose={handleCloseHistory}
        customer={selectedCustomer}
      />

      {/* Statement Modal */}
      <CustomerStatementModal
        isOpen={isStatementOpen}
        onClose={handleCloseStatement}
        customer={selectedCustomer}
      />

      {/* Legacy Debt Modal */}
      <LegacyDebtModal
        isOpen={isLegacyDebtOpen}
        onClose={handleCloseLegacyDebt}
        customer={selectedCustomer}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Cliente</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  ¿Estás seguro de eliminar al cliente{' '}
                  <span className="font-semibold text-foreground">
                    "{customerToDelete?.name}"
                  </span>
                  ?
                </p>

                {isLoadingDebt && (
                  <p className="text-sm text-muted-foreground animate-pulse">
                    Verificando deudas pendientes...
                  </p>
                )}

                {!isLoadingDebt && hasOpenDebt && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>¡Atención!</strong> Este cliente tiene una deuda pendiente de{' '}
                      <span className="font-bold">
                        ${customerDebtSummary?.remaining_usd.toFixed(2)} USD
                      </span>{' '}
                      ({customerDebtSummary?.remaining_bs.toFixed(2)} Bs).
                      <br />
                      Eliminar este cliente <strong>no cancelará</strong> la deuda pendiente.
                    </AlertDescription>
                  </Alert>
                )}

                {!isLoadingDebt && !hasOpenDebt && customerDebtSummary && (
                  <p className="text-sm text-green-600">
                    ✓ Este cliente no tiene deudas pendientes.
                  </p>
                )}

                <p className="text-sm text-muted-foreground">
                  Esta acción no se puede deshacer.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelDelete}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteMutation.isPending || isLoadingDebt}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? 'Eliminando...' : 'Eliminar Cliente'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
