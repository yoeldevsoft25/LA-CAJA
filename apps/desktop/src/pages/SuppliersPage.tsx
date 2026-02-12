import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, Edit, Trash2, Truck, BarChart3, Package, Phone, Mail, ShoppingBag, FileText } from 'lucide-react'
import { suppliersService, Supplier } from '@/services/suppliers.service'
import SupplierPriceImportModal from '@/components/suppliers/SupplierPriceImportModal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import toast from '@/lib/toast'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const supplierSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  code: z.string().optional(),
  contact_name: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  tax_id: z.string().optional(),
  payment_terms: z.string().optional(),
  note: z.string().optional(),
})

type SupplierFormData = z.infer<typeof supplierSchema>

export default function SuppliersPage() {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isPriceImportOpen, setIsPriceImportOpen] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)
  const [activeTab, setActiveTab] = useState<string>('list')
  const queryClient = useQueryClient()

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ['suppliers', searchQuery],
    queryFn: () => suppliersService.getAll(),
    staleTime: 1000 * 60 * 5, // 5 minutos
  })

  // Filtrar proveedores por búsqueda
  const filteredSuppliers = suppliers.filter((supplier) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      supplier.name.toLowerCase().includes(query) ||
      supplier.code?.toLowerCase().includes(query) ||
      supplier.phone?.toLowerCase().includes(query) ||
      supplier.email?.toLowerCase().includes(query)
    )
  })

  // Estadísticas del proveedor seleccionado
  const { data: statistics } = useQuery({
    queryKey: ['suppliers', selectedSupplier?.id, 'statistics'],
    queryFn: () => suppliersService.getStatistics(selectedSupplier!.id),
    enabled: !!selectedSupplier && activeTab === 'statistics',
  })

  // Órdenes del proveedor seleccionado
  const { data: purchaseOrders = [] } = useQuery({
    queryKey: ['suppliers', selectedSupplier?.id, 'purchase-orders'],
    queryFn: () => suppliersService.getPurchaseOrders(selectedSupplier!.id),
    enabled: !!selectedSupplier && activeTab === 'orders',
  })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SupplierFormData>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      name: '',
      code: '',
      contact_name: '',
      email: '',
      phone: '',
      address: '',
      tax_id: '',
      payment_terms: '',
      note: '',
    },
  })

  const [isActive, setIsActive] = useState(true)

  useEffect(() => {
    if (editingSupplier) {
      reset({
        name: editingSupplier.name,
        code: editingSupplier.code || '',
        contact_name: editingSupplier.contact_name || '',
        email: editingSupplier.email || '',
        phone: editingSupplier.phone || '',
        address: editingSupplier.address || '',
        tax_id: editingSupplier.tax_id || '',
        payment_terms: editingSupplier.payment_terms || '',
        note: editingSupplier.note || '',
      })
      setIsActive(editingSupplier.is_active)
    } else {
      reset({
        name: '',
        code: '',
        contact_name: '',
        email: '',
        phone: '',
        address: '',
        tax_id: '',
        payment_terms: '',
        note: '',
      })
      setIsActive(true)
    }
  }, [editingSupplier, reset])

  const createMutation = useMutation({
    mutationFn: (data: SupplierFormData) => suppliersService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      toast.success('Proveedor creado correctamente')
      setIsFormOpen(false)
      reset()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al crear el proveedor')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: SupplierFormData & { is_active?: boolean } }) =>
      suppliersService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      toast.success('Proveedor actualizado correctamente')
      setIsFormOpen(false)
      setEditingSupplier(null)
      reset()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al actualizar el proveedor')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => suppliersService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      toast.success('Proveedor eliminado correctamente')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al eliminar el proveedor')
    },
  })

  const onSubmit = (data: SupplierFormData) => {
    if (editingSupplier) {
      updateMutation.mutate({
        id: editingSupplier.id,
        data: { ...data, is_active: isActive },
      })
    } else {
      createMutation.mutate(data)
    }
  }

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier)
    setIsFormOpen(true)
  }

  const handleCreate = () => {
    setEditingSupplier(null)
    setIsFormOpen(true)
  }

  const handleDelete = async (supplier: Supplier) => {
    if (!confirm(`¿Estás seguro de eliminar a ${supplier.name}?`)) return
    deleteMutation.mutate(supplier.id)
  }

  const handleViewDetails = (supplier: Supplier) => {
    setSelectedSupplier(supplier)
    setActiveTab('statistics')
  }

  return (
    <div className="h-full max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Gestión de Proveedores</h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              {filteredSuppliers.length} {filteredSuppliers.length === 1 ? 'proveedor' : 'proveedores'} registrados
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button onClick={() => setIsPriceImportOpen(true)} variant="outline">
              <FileText className="w-5 h-5 mr-2" />
              Importar Lista CSV
            </Button>
            <Button onClick={handleCreate} variant="default">
              <Plus className="w-5 h-5 mr-2" />
              Nuevo Proveedor
            </Button>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4 sm:mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5 z-10" />
          <Input
            type="text"
            placeholder="Buscar por nombre, código, teléfono o email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4 py-2.5 sm:py-3 text-base sm:text-lg"
            autoFocus
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="list">Lista</TabsTrigger>
          {selectedSupplier && (
            <>
              <TabsTrigger value="statistics">Estadísticas</TabsTrigger>
              <TabsTrigger value="orders">Órdenes</TabsTrigger>
            </>
          )}
        </TabsList>

        {/* List Tab */}
        <TabsContent value="list" className="space-y-4">
          <Card className="border border-border">
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-8 text-center">
                  <div className="flex flex-col items-center justify-center py-8">
                    <Truck className="w-12 h-12 mx-auto mb-3 text-muted-foreground animate-pulse" />
                    <p className="text-muted-foreground">Cargando proveedores...</p>
                  </div>
                </div>
              ) : filteredSuppliers.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="flex flex-col items-center justify-center py-8">
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                      <Truck className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <p className="text-lg font-medium text-foreground mb-1">
                      {searchQuery ? 'No se encontraron proveedores' : 'No hay proveedores registrados'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {searchQuery
                        ? 'Intenta con otro término de búsqueda'
                        : 'Haz clic en "Nuevo Proveedor" para comenzar'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {/* Desktop Table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-card">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
                            Proveedor
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
                            Contacto
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
                            Estado
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-foreground uppercase tracking-wider">
                            Acciones
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-background divide-y divide-border">
                        {filteredSuppliers.map((supplier) => (
                          <tr key={supplier.id} className="hover:bg-accent/50 transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex items-center">
                                <Avatar className="w-10 h-10 mr-3">
                                  <AvatarFallback className="bg-primary/10 text-primary">
                                    {supplier.name.charAt(0).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-semibold text-foreground">{supplier.name}</p>
                                  {supplier.code && (
                                    <p className="text-xs text-muted-foreground">Código: {supplier.code}</p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="space-y-1">
                                {supplier.phone && (
                                  <p className="text-sm text-muted-foreground flex items-center">
                                    <Phone className="w-3.5 h-3.5 mr-1.5" />
                                    {supplier.phone}
                                  </p>
                                )}
                                {supplier.email && (
                                  <p className="text-sm text-muted-foreground flex items-center">
                                    <Mail className="w-3.5 h-3.5 mr-1.5" />
                                    {supplier.email}
                                  </p>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant={supplier.is_active ? 'default' : 'secondary'}>
                                {supplier.is_active ? 'Activo' : 'Inactivo'}
                              </Badge>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleViewDetails(supplier)}
                                  className="h-8 w-8"
                                  title="Ver detalles"
                                >
                                  <BarChart3 className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEdit(supplier)}
                                  className="h-8 w-8"
                                  title="Editar"
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDelete(supplier)}
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  title="Eliminar"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Cards */}
                  <div className="md:hidden divide-y divide-border">
                    {filteredSuppliers.map((supplier) => (
                      <div key={supplier.id} className="p-4 hover:bg-accent/50 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center flex-1">
                            <Avatar className="w-12 h-12 mr-3">
                              <AvatarFallback className="bg-primary/10 text-primary text-lg font-bold">
                                {supplier.name.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <p className="font-semibold text-foreground text-lg">{supplier.name}</p>
                              {supplier.code && (
                                <p className="text-xs text-muted-foreground mt-0.5">Código: {supplier.code}</p>
                              )}
                              <div className="mt-2 space-y-1">
                                {supplier.phone && (
                                  <p className="text-sm text-muted-foreground flex items-center">
                                    <Phone className="w-3.5 h-3.5 mr-1.5" />
                                    {supplier.phone}
                                  </p>
                                )}
                                {supplier.email && (
                                  <p className="text-sm text-muted-foreground flex items-center">
                                    <Mail className="w-3.5 h-3.5 mr-1.5" />
                                    {supplier.email}
                                  </p>
                                )}
                              </div>
                              <Badge variant={supplier.is_active ? 'default' : 'secondary'} className="mt-2">
                                {supplier.is_active ? 'Activo' : 'Inactivo'}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex flex-col gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleViewDetails(supplier)}
                              className="h-8 w-8"
                              title="Ver detalles"
                            >
                              <BarChart3 className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(supplier)}
                              className="h-8 w-8"
                              title="Editar"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(supplier)}
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              title="Eliminar"
                            >
                              <Trash2 className="w-4 h-4" />
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
        </TabsContent>

        {/* Statistics Tab */}
        {selectedSupplier && (
          <TabsContent value="statistics" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Estadísticas de {selectedSupplier.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {statistics ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-2xl font-bold">{statistics.total_orders}</div>
                        <p className="text-xs text-muted-foreground">Total de Órdenes</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-2xl font-bold">{statistics.pending_orders}</div>
                        <p className="text-xs text-muted-foreground">Órdenes Pendientes</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-2xl font-bold">{statistics.completed_orders}</div>
                        <p className="text-xs text-muted-foreground">Órdenes Completadas</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-2xl font-bold">
                          {statistics.total_amount_bs.toFixed(2)} Bs
                        </div>
                        <p className="text-xs text-muted-foreground">Total en Bs</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-2xl font-bold">
                          ${statistics.total_amount_usd.toFixed(2)} USD
                        </div>
                        <p className="text-xs text-muted-foreground">Total en USD</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-2xl font-bold">
                          {statistics.last_order_date
                            ? new Date(statistics.last_order_date).toLocaleDateString()
                            : 'N/A'}
                        </div>
                        <p className="text-xs text-muted-foreground">Última Orden</p>
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">Cargando estadísticas...</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Orders Tab */}
        {selectedSupplier && (
          <TabsContent value="orders" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    Órdenes de Compra de {selectedSupplier.name}
                  </CardTitle>
                  <Button
                    onClick={() => navigate(`/purchase-orders?supplier_id=${selectedSupplier.id}`)}
                    size="sm"
                  >
                    <ShoppingBag className="w-4 h-4 mr-2" />
                    Nueva Orden
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {purchaseOrders.length === 0 ? (
                  <div className="text-center py-8">
                    <Package className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                    <p className="text-muted-foreground">No hay órdenes de compra registradas</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {purchaseOrders.map((order: any) => (
                      <Card key={order.id}>
                        <CardContent className="pt-6">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-semibold">Orden #{order.order_number}</p>
                              <p className="text-sm text-muted-foreground">
                                {new Date(order.created_at).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="text-right">
                              <Badge
                                variant={
                                  order.status === 'completed'
                                    ? 'default'
                                    : order.status === 'cancelled'
                                    ? 'destructive'
                                    : 'secondary'
                                }
                              >
                                {order.status}
                              </Badge>
                              <p className="text-sm font-semibold mt-1">
                                {order.total_amount_bs.toFixed(2)} Bs / ${order.total_amount_usd.toFixed(2)} USD
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Form Modal */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] sm:max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b border-border flex-shrink-0">
            <DialogTitle className="text-lg sm:text-xl">{editingSupplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}</DialogTitle>
            <DialogDescription>
              {editingSupplier
                ? 'Modifica la información del proveedor'
                : 'Completa los datos para crear un nuevo proveedor'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 sm:px-4 md:px-6 py-4 sm:py-5">
              <div className="space-y-4 sm:space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">
                  Nombre <span className="text-destructive">*</span>
                </Label>
                <Input id="name" {...register('name')} className="mt-2" />
                {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
              </div>
              <div>
                <Label htmlFor="code">Código</Label>
                <Input id="code" {...register('code')} className="mt-2" />
              </div>
              <div>
                <Label htmlFor="contact_name">Nombre de Contacto</Label>
                <Input id="contact_name" {...register('contact_name')} className="mt-2" />
              </div>
              <div>
                <Label htmlFor="phone">Teléfono</Label>
                <Input id="phone" {...register('phone')} className="mt-2" />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" {...register('email')} className="mt-2" />
                {errors.email && <p className="text-sm text-destructive mt-1">{errors.email.message}</p>}
              </div>
              <div>
                <Label htmlFor="tax_id">RIF / NIT</Label>
                <Input id="tax_id" {...register('tax_id')} className="mt-2" />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="address">Dirección</Label>
                <Input id="address" {...register('address')} className="mt-2" />
              </div>
              <div>
                <Label htmlFor="payment_terms">Términos de Pago</Label>
                <Input id="payment_terms" {...register('payment_terms')} className="mt-2" placeholder="Ej: 30 días" />
              </div>
              {editingSupplier && (
                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_active"
                    checked={isActive}
                    onCheckedChange={setIsActive}
                  />
                  <Label htmlFor="is_active">Activo</Label>
                </div>
              )}
              <div className="md:col-span-2">
                <Label htmlFor="note">Notas</Label>
                <Textarea id="note" {...register('note')} rows={3} className="mt-2" />
              </div>
                </div>
              </div>
            </div>
            <DialogFooter className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-t border-border flex-shrink-0">
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {createMutation.isPending || updateMutation.isPending
                  ? 'Guardando...'
                  : editingSupplier
                  ? 'Actualizar'
                  : 'Crear'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <SupplierPriceImportModal
        isOpen={isPriceImportOpen}
        onClose={() => setIsPriceImportOpen(false)}
        suppliers={suppliers}
        onImported={() => setIsPriceImportOpen(false)}
      />
    </div>
  )
}
