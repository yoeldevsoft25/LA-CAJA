import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit, Tag, CheckCircle, XCircle, Calendar } from 'lucide-react'
import {
  promotionsService,
  Promotion,
  CreatePromotionDto,
} from '@/services/promotions.service'
import { useAuth } from '@/stores/auth.store'
import toast from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

export default function PromotionsPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null)
  const [promotionType, setPromotionType] = useState<
    'percentage' | 'fixed_amount' | 'buy_x_get_y' | 'bundle'
  >('percentage')

  // Obtener promociones activas
  const { data: promotions = [], isLoading } = useQuery({
    queryKey: ['promotions', 'active'],
    queryFn: () => promotionsService.getActive(),
    enabled: !!user?.store_id,
  })

  // Mutación para crear promoción
  const createMutation = useMutation({
    mutationFn: (data: CreatePromotionDto) => promotionsService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotions'] })
      toast.success('Promoción creada exitosamente')
      setIsFormOpen(false)
      setEditingPromotion(null)
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Error al crear la promoción'
      toast.error(message)
    },
  })

  const handleCreate = () => {
    setEditingPromotion(null)
    setPromotionType('percentage')
    setIsFormOpen(true)
  }

  const handleEdit = (promotion: Promotion) => {
    setEditingPromotion(promotion)
    setPromotionType(promotion.promotion_type)
    setIsFormOpen(true)
  }

  const handleCloseForm = () => {
    setIsFormOpen(false)
    setEditingPromotion(null)
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)

    const data: CreatePromotionDto = {
      name: formData.get('name') as string,
      code: (formData.get('code') as string) || null,
      description: (formData.get('description') as string) || null,
      promotion_type: promotionType,
      discount_percentage:
        promotionType === 'percentage'
          ? parseFloat(formData.get('discount_percentage') as string) || null
          : null,
      discount_amount_bs:
        promotionType === 'fixed_amount'
          ? parseFloat(formData.get('discount_amount_bs') as string) || null
          : null,
      discount_amount_usd:
        promotionType === 'fixed_amount'
          ? parseFloat(formData.get('discount_amount_usd') as string) || null
          : null,
      min_purchase_bs: parseFloat(formData.get('min_purchase_bs') as string) || null,
      min_purchase_usd: parseFloat(formData.get('min_purchase_usd') as string) || null,
      max_discount_bs: parseFloat(formData.get('max_discount_bs') as string) || null,
      max_discount_usd: parseFloat(formData.get('max_discount_usd') as string) || null,
      valid_from: formData.get('valid_from') as string,
      valid_until: formData.get('valid_until') as string,
      is_active: formData.get('is_active') === 'on',
      usage_limit: formData.get('usage_limit')
        ? parseInt(formData.get('usage_limit') as string)
        : null,
      customer_limit: formData.get('customer_limit')
        ? parseInt(formData.get('customer_limit') as string)
        : null,
      note: (formData.get('note') as string) || null,
    }

    createMutation.mutate(data)
  }

  const formatPromotionType = (type: string) => {
    const types: Record<string, string> = {
      percentage: 'Porcentaje',
      fixed_amount: 'Monto Fijo',
      buy_x_get_y: 'Compra X Lleva Y',
      bundle: 'Paquete',
    }
    return types[type] || type
  }

  const formatDiscount = (promotion: Promotion) => {
    if (promotion.promotion_type === 'percentage') {
      return `${promotion.discount_percentage}%`
    } else if (promotion.promotion_type === 'fixed_amount') {
      if (promotion.discount_amount_usd) {
        return `$${Number(promotion.discount_amount_usd).toFixed(2)} USD`
      }
      return `Bs. ${Number(promotion.discount_amount_bs).toFixed(2)}`
    }
    return promotion.promotion_type
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Promociones</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Gestiona ofertas y promociones con descuentos y vigencia
          </p>
        </div>
        <Button onClick={handleCreate} className="w-full sm:w-auto">
          <Plus className="w-4 h-4 sm:mr-2" />
          <span className="hidden sm:inline">Nueva Promoción</span>
          <span className="sm:hidden">Nueva</span>
        </Button>
      </div>

      {/* Lista de promociones */}
      {isLoading ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">Cargando...</p>
          </CardContent>
        </Card>
      ) : promotions.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <Tag className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No hay promociones activas</p>
            <Button onClick={handleCreate} className="mt-4">
              Crear primera promoción
            </Button>
          </CardContent>
        </Card>
      ) : (
        <motion.div
          layout
          className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
        >
          <AnimatePresence mode="popLayout">
            {promotions.map((promotion) => (
              <motion.div
                key={promotion.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                layout
              >
                <Card className="group relative overflow-hidden border-2 border-border hover:border-primary/50 transition-all duration-300 shadow-sm hover:shadow-xl">
                  {/* Decoración superior según tipo */}
                  <div className={cn(
                    "h-1.5 w-full",
                    promotion.promotion_type === 'percentage' ? "bg-blue-500" :
                      promotion.promotion_type === 'fixed_amount' ? "bg-emerald-500" :
                        "bg-orange-500"
                  )} />

                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <CardTitle className="text-xl font-black tracking-tight group-hover:text-primary transition-colors">
                          {promotion.name}
                        </CardTitle>
                        {promotion.code && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Código:</span>
                            <Badge variant="secondary" className="font-mono text-xs py-0 px-2 rounded-md">
                              {promotion.code}
                            </Badge>
                          </div>
                        )}
                      </div>
                      <Button
                        variant="secondary"
                        size="icon"
                        onClick={() => handleEdit(promotion)}
                        className="h-9 w-9 rounded-full bg-card hover:bg-primary hover:text-white transition-all duration-300"
                      >
                        <Edit className="w-4.5 h-4.5" />
                      </Button>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-5">
                    {/* Badge y Tipo */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={cn(
                        "font-bold px-3 py-1 rounded-full border-none",
                        promotion.is_active
                          ? "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20"
                          : "bg-card border border-border/70 text-muted-foreground"
                      )}>
                        {promotion.is_active ? <CheckCircle className="w-3.5 h-3.5 mr-1.5" /> : <XCircle className="w-3.5 h-3.5 mr-1.5" />}
                        {promotion.is_active ? 'Activa' : 'Pausada'}
                      </Badge>
                      <Badge variant="outline" className="border-2 font-semibold">
                        {formatPromotionType(promotion.promotion_type)}
                      </Badge>
                    </div>

                    {/* Descuento Principal */}
                    <div className="p-4 bg-card rounded-2xl flex items-center justify-between border border-border/50">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-primary/10 rounded-xl">
                          <Tag className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Ahorro</p>
                          <p className="text-2xl font-black text-foreground leading-none mt-0.5">
                            {formatDiscount(promotion)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {promotion.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed italic">
                        "{promotion.description}"
                      </p>
                    )}

                    {/* Footer Info */}
                    <div className="pt-4 border-t border-dashed border-border flex flex-col gap-2.5">
                      <div className="flex items-center justify-between text-xs font-medium">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Calendar className="w-4 h-4" />
                          <span>Vigencia</span>
                        </div>
                        <span className="text-foreground">
                          {new Date(promotion.valid_from).toLocaleDateString()} - {new Date(promotion.valid_until).toLocaleDateString()}
                        </span>
                      </div>

                      {promotion.usage_limit && (
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                            <span>Progreso de usos</span>
                            <span>{promotion.usage_count || 0} / {promotion.usage_limit}</span>
                          </div>
                          <div className="h-1.5 w-full bg-card border border-border/70 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(100, ((promotion.usage_count || 0) / promotion.usage_limit) * 100)}%` }}
                              className="h-full bg-primary"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Modal de formulario */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-3xl h-[85vh] flex flex-col p-0 gap-0 overflow-hidden bg-card">
          <div className="bg-primary/5 px-6 py-6 border-b">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-primary/10 rounded-2xl">
                  <Tag className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <DialogTitle className="text-2xl font-black">
                    {editingPromotion ? 'Ajustar Configuración' : 'Configurar Nueva Promo'}
                  </DialogTitle>
                  <DialogDescription className="text-xs font-medium uppercase tracking-widest opacity-70">
                    {editingPromotion
                      ? 'Estás editando una campaña existente'
                      : 'Define reglas de descuento y límites de uso'}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>

          <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
            <ScrollArea className="flex-1 px-8 py-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Nombre *</Label>
                  <Input
                    id="name"
                    name="name"
                    defaultValue={editingPromotion?.name}
                    required
                    maxLength={100}
                  />
                </div>
                <div>
                  <Label htmlFor="code">Código (Opcional)</Label>
                  <Input
                    id="code"
                    name="code"
                    defaultValue={editingPromotion?.code || ''}
                    maxLength={50}
                    placeholder="DESC20, VERANO2024, etc."
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Código para aplicar la promoción en el checkout
                  </p>
                </div>
                <div>
                  <Label htmlFor="description">Descripción</Label>
                  <Textarea
                    id="description"
                    name="description"
                    defaultValue={editingPromotion?.description || ''}
                    rows={3}
                  />
                </div>
                <div>
                  <Label htmlFor="promotion_type">Tipo de Promoción *</Label>
                  <Select
                    value={promotionType}
                    onValueChange={(value: any) => setPromotionType(value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Porcentaje</SelectItem>
                      <SelectItem value="fixed_amount">Monto Fijo</SelectItem>
                      <SelectItem value="buy_x_get_y">Compra X Lleva Y</SelectItem>
                      <SelectItem value="bundle">Paquete</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {promotionType === 'percentage' && (
                  <>
                    <div>
                      <Label htmlFor="discount_percentage">Porcentaje de Descuento (%) *</Label>
                      <Input
                        id="discount_percentage"
                        name="discount_percentage"
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        defaultValue={editingPromotion?.discount_percentage || ''}
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="max_discount_bs">Descuento Máximo (Bs)</Label>
                        <Input
                          id="max_discount_bs"
                          name="max_discount_bs"
                          type="number"
                          step="0.01"
                          min="0"
                          defaultValue={editingPromotion?.max_discount_bs || ''}
                        />
                      </div>
                      <div>
                        <Label htmlFor="max_discount_usd">Descuento Máximo (USD)</Label>
                        <Input
                          id="max_discount_usd"
                          name="max_discount_usd"
                          type="number"
                          step="0.01"
                          min="0"
                          defaultValue={editingPromotion?.max_discount_usd || ''}
                        />
                      </div>
                    </div>
                  </>
                )}
                {promotionType === 'fixed_amount' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="discount_amount_bs">Descuento (Bs) *</Label>
                      <Input
                        id="discount_amount_bs"
                        name="discount_amount_bs"
                        type="number"
                        step="0.01"
                        min="0"
                        defaultValue={editingPromotion?.discount_amount_bs || ''}
                        required={!editingPromotion?.discount_amount_usd}
                      />
                    </div>
                    <div>
                      <Label htmlFor="discount_amount_usd">Descuento (USD) *</Label>
                      <Input
                        id="discount_amount_usd"
                        name="discount_amount_usd"
                        type="number"
                        step="0.01"
                        min="0"
                        defaultValue={editingPromotion?.discount_amount_usd || ''}
                        required={!editingPromotion?.discount_amount_bs}
                      />
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="min_purchase_bs">Compra Mínima (Bs)</Label>
                    <Input
                      id="min_purchase_bs"
                      name="min_purchase_bs"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={editingPromotion?.min_purchase_bs || ''}
                    />
                  </div>
                  <div>
                    <Label htmlFor="min_purchase_usd">Compra Mínima (USD)</Label>
                    <Input
                      id="min_purchase_usd"
                      name="min_purchase_usd"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={editingPromotion?.min_purchase_usd || ''}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="valid_from">Fecha de Inicio *</Label>
                    <Input
                      id="valid_from"
                      name="valid_from"
                      type="datetime-local"
                      defaultValue={
                        editingPromotion?.valid_from
                          ? new Date(editingPromotion.valid_from)
                            .toISOString()
                            .slice(0, 16)
                          : ''
                      }
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="valid_until">Fecha de Fin *</Label>
                    <Input
                      id="valid_until"
                      name="valid_until"
                      type="datetime-local"
                      defaultValue={
                        editingPromotion?.valid_until
                          ? new Date(editingPromotion.valid_until)
                            .toISOString()
                            .slice(0, 16)
                          : ''
                      }
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="usage_limit">Límite de Usos</Label>
                    <Input
                      id="usage_limit"
                      name="usage_limit"
                      type="number"
                      min="1"
                      defaultValue={editingPromotion?.usage_limit || ''}
                      placeholder="Ilimitado si se deja vacío"
                    />
                  </div>
                  <div>
                    <Label htmlFor="customer_limit">Límite por Cliente</Label>
                    <Input
                      id="customer_limit"
                      name="customer_limit"
                      type="number"
                      min="1"
                      defaultValue={editingPromotion?.customer_limit || ''}
                      placeholder="Ilimitado si se deja vacío"
                    />
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="is_active"
                    name="is_active"
                    defaultChecked={editingPromotion?.is_active ?? true}
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
                    defaultValue={editingPromotion?.note || ''}
                    rows={2}
                  />
                </div>
              </div>
            </ScrollArea>

            <div className="p-6 bg-card border-t flex flex-col-reverse sm:flex-row items-center justify-between gap-4">
              <Button type="button" variant="outline" onClick={handleCloseForm} className="font-bold uppercase tracking-widest text-xs btn-glass-neutral">
                Descartar Cambios
              </Button>
              <Button type="submit" disabled={createMutation.isPending} className="w-full sm:w-auto px-10 h-12 bg-primary text-white font-black rounded-xl shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]">
                {createMutation.isPending
                  ? 'PROCESANDO...'
                  : editingPromotion
                    ? 'GUARDAR CAMBIOS'
                    : 'LANZAR PROMOCIÓN'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

