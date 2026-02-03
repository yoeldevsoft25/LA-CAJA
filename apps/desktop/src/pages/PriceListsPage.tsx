import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit, DollarSign, CheckCircle, XCircle } from 'lucide-react'
import { priceListsService, PriceList, CreatePriceListDto } from '@/services/price-lists.service'
import { useAuth } from '@/stores/auth.store'
import toast from '@/lib/toast'
import { Button } from '@la-caja/ui-core'
import { Input } from '@la-caja/ui-core'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export default function PriceListsPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingList, setEditingList] = useState<PriceList | null>(null)

  // Obtener listas de precio
  const { data: priceLists = [], isLoading } = useQuery({
    queryKey: ['price-lists'],
    queryFn: () => priceListsService.getAll(),
    enabled: !!user?.store_id,
  })

  // Mutación para crear lista
  const createMutation = useMutation({
    mutationFn: (data: CreatePriceListDto) => priceListsService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['price-lists'] })
      toast.success('Lista de precio creada exitosamente')
      setIsFormOpen(false)
      setEditingList(null)
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Error al crear la lista de precio'
      toast.error(message)
    },
  })

  const handleCreate = () => {
    setEditingList(null)
    setIsFormOpen(true)
  }

  const handleEdit = (list: PriceList) => {
    setEditingList(list)
    setIsFormOpen(true)
  }

  const handleCloseForm = () => {
    setIsFormOpen(false)
    setEditingList(null)
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const data: CreatePriceListDto = {
      name: formData.get('name') as string,
      code: formData.get('code') as string,
      description: (formData.get('description') as string) || null,
      is_default: formData.get('is_default') === 'on',
      is_active: formData.get('is_active') === 'on',
      valid_from: (formData.get('valid_from') as string) || null,
      valid_until: (formData.get('valid_until') as string) || null,
      note: (formData.get('note') as string) || null,
    }

    createMutation.mutate(data)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Listas de Precio</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Gestiona múltiples listas de precio para diferentes tipos de clientes
          </p>
        </div>
        <Button onClick={handleCreate} className="w-full sm:w-auto">
          <Plus className="w-4 h-4 sm:mr-2" />
          <span className="hidden sm:inline">Nueva Lista</span>
          <span className="sm:hidden">Nueva</span>
        </Button>
      </div>

      {/* Lista de listas de precio */}
      {isLoading ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">Cargando...</p>
          </CardContent>
        </Card>
      ) : priceLists.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <DollarSign className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No hay listas de precio creadas</p>
            <Button onClick={handleCreate} className="mt-4">
              Crear primera lista
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {priceLists.map((list) => (
            <Card key={list.id} className="border border-border">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{list.name}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">Código: {list.code}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(list)}
                      className="h-8 w-8"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    {list.is_active ? (
                      <Badge variant="default" className="bg-success">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Activa
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        <XCircle className="w-3 h-3 mr-1" />
                        Inactiva
                      </Badge>
                    )}
                    {list.is_default && (
                      <Badge variant="outline">Por defecto</Badge>
                    )}
                  </div>
                  {list.description && (
                    <p className="text-sm text-muted-foreground">{list.description}</p>
                  )}
                  {list.valid_from || list.valid_until ? (
                    <p className="text-xs text-muted-foreground">
                      Vigencia:{' '}
                      {list.valid_from
                        ? new Date(list.valid_from).toLocaleDateString()
                        : 'Sin inicio'}{' '}
                      -{' '}
                      {list.valid_until
                        ? new Date(list.valid_until).toLocaleDateString()
                        : 'Sin fin'}
                    </p>
                  ) : null}
                  {list.items && list.items.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {list.items.length} producto{list.items.length !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal de formulario */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] sm:max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b border-border flex-shrink-0">
            <DialogTitle className="text-lg sm:text-xl">
              {editingList ? 'Editar Lista de Precio' : 'Nueva Lista de Precio'}
            </DialogTitle>
            <DialogDescription>
              {editingList
                ? 'Modifica los datos de la lista de precio'
                : 'Crea una nueva lista de precio para aplicar precios específicos'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 sm:px-4 md:px-6 py-4 sm:py-5">
              <div className="space-y-4 sm:space-y-5">
              <div>
                <Label htmlFor="name">Nombre *</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={editingList?.name}
                  required
                  maxLength={100}
                />
              </div>
              <div>
                <Label htmlFor="code">Código *</Label>
                <Input
                  id="code"
                  name="code"
                  defaultValue={editingList?.code}
                  required
                  maxLength={50}
                  placeholder="MAYORISTA, MINORISTA, etc."
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Código único para identificar la lista
                </p>
              </div>
              <div>
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  name="description"
                  defaultValue={editingList?.description || ''}
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="valid_from">Fecha de inicio</Label>
                  <Input
                    id="valid_from"
                    name="valid_from"
                    type="date"
                    defaultValue={
                      editingList?.valid_from
                        ? new Date(editingList.valid_from).toISOString().split('T')[0]
                        : ''
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="valid_until">Fecha de fin</Label>
                  <Input
                    id="valid_until"
                    name="valid_until"
                    type="date"
                    defaultValue={
                      editingList?.valid_until
                        ? new Date(editingList.valid_until).toISOString().split('T')[0]
                        : ''
                    }
                  />
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="is_default"
                  name="is_default"
                  defaultChecked={editingList?.is_default}
                  className="w-4 h-4"
                />
                <Label htmlFor="is_default" className="cursor-pointer">
                  Marcar como lista por defecto
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="is_active"
                  name="is_active"
                  defaultChecked={editingList?.is_active ?? true}
                  className="w-4 h-4"
                />
                <Label htmlFor="is_active" className="cursor-pointer">
                  Activa
                </Label>
              </div>
              <div>
                <Label htmlFor="note">Notas</Label>
                <Textarea
                  id="note"
                  name="note"
                  defaultValue={editingList?.note || ''}
                  rows={2}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-t border-border flex-shrink-0">
              <Button type="button" variant="outline" onClick={handleCloseForm}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending
                  ? 'Guardando...'
                  : editingList
                    ? 'Actualizar'
                    : 'Crear'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

