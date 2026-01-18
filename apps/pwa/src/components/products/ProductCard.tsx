import { Product } from '@/services/products.service'
import { StockStatus } from '@/services/inventory.service'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Package,
  MoreVertical,
  Edit,
  DollarSign,
  Layers,
  Boxes,
  Hash,
  Trash2,
  CheckCircle,
  Barcode,
  AlertTriangle,
  Copy,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type WeightUnit = 'kg' | 'g' | 'lb' | 'oz'

/**
 * Genera un color consistente para una categoría usando hash
 * Retorna una tupla [bgColor, textColor, borderColor]
 */
const getCategoryColor = (category: string): [string, string, string] => {
  // Paleta de colores predefinida para mejor contraste y accesibilidad
  const colorPalette: Array<[string, string, string]> = [
    ['bg-blue-100', 'text-blue-700', 'border-blue-300'], // Azul
    ['bg-green-100', 'text-green-700', 'border-green-300'], // Verde
    ['bg-purple-100', 'text-purple-700', 'border-purple-300'], // Púrpura
    ['bg-orange-100', 'text-orange-700', 'border-orange-300'], // Naranja
    ['bg-pink-100', 'text-pink-700', 'border-pink-300'], // Rosa
    ['bg-cyan-100', 'text-cyan-700', 'border-cyan-300'], // Cian
    ['bg-amber-100', 'text-amber-700', 'border-amber-300'], // Ámbar
    ['bg-indigo-100', 'text-indigo-700', 'border-indigo-300'], // Índigo
    ['bg-teal-100', 'text-teal-700', 'border-teal-300'], // Verde azulado
    ['bg-rose-100', 'text-rose-700', 'border-rose-300'], // Rosa oscuro
    ['bg-violet-100', 'text-violet-700', 'border-violet-300'], // Violeta
    ['bg-emerald-100', 'text-emerald-700', 'border-emerald-300'], // Esmeralda
  ]

  // Genera un hash simple del nombre de categoría
  let hash = 0
  for (let i = 0; i < category.length; i++) {
    hash = ((hash << 5) - hash) + category.charCodeAt(i)
    hash = hash & hash // Convierte a entero de 32 bits
  }

  // Usa el hash para seleccionar un color de la paleta
  const index = Math.abs(hash) % colorPalette.length
  return colorPalette[index]
}

const WEIGHT_UNIT_TO_KG: Record<WeightUnit, number> = {
  kg: 1,
  g: 0.001,
  lb: 0.45359237,
  oz: 0.028349523125,
}

const formatKg = (value: number) => {
  const fixed = value.toFixed(3)
  return fixed.replace(/\.?0+$/, '')
}

const formatStockValue = (product: Product, stock?: StockStatus) => {
  const isWeight = stock?.is_weight_product ?? product.is_weight_product ?? false
  if (!isWeight) return `${stock?.current_stock ?? 0}`
  const unit = (stock?.weight_unit || product.weight_unit || 'kg') as WeightUnit
  const value = stock?.current_stock ?? 0
  const kgValue = value * WEIGHT_UNIT_TO_KG[unit]
  return `${formatKg(kgValue)} kg`
}

interface ProductCardProps {
  product: Product
  stock?: StockStatus
  onEdit: (product: Product) => void
  onDuplicate?: (product: Product) => void
  onChangePrice: (product: Product) => void
  onManageVariants: (product: Product) => void
  onManageLots: (product: Product) => void
  onManageSerials: (product: Product) => void
  onDeactivate: (product: Product) => void
  onActivate: (product: Product) => void
  isDeactivating?: boolean
  isActivating?: boolean
}

export default function ProductCard({
  product,
  stock,
  onEdit,
  onDuplicate,
  onChangePrice,
  onManageVariants,
  onManageLots,
  onManageSerials,
  onDeactivate,
  onActivate,
  isDeactivating,
  isActivating,
}: ProductCardProps) {
  const isLowStock = stock?.is_low_stock ?? false

  return (
    <Card
      className={cn(
        'transition-all hover:shadow-md',
        !product.is_active && 'opacity-60 bg-muted/30'
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          {/* Icono y info principal */}
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div
              className={cn(
                'w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0',
                product.is_active
                  ? 'bg-primary/10 text-primary'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              <Package className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h3
                className="font-semibold text-foreground text-sm line-clamp-2"
                title={product.name}
              >
                {product.name}
              </h3>
              {product.category && (
                <Badge 
                  variant="outline" 
                  className={cn(
                    getCategoryColor(product.category),
                    "border font-medium text-[10px] mt-0.5 w-fit"
                  )}
                >
                  {product.category}
                </Badge>
              )}
              {product.barcode && (
                <div className="flex items-center gap-1 mt-1">
                  <Barcode className="w-3 h-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground font-mono">
                    {product.barcode}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Menú de acciones */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => onEdit(product)}>
                <Edit className="w-4 h-4 mr-2" />
                Editar producto
              </DropdownMenuItem>
              {onDuplicate && (
                <DropdownMenuItem onClick={() => onDuplicate(product)}>
                  <Copy className="w-4 h-4 mr-2" />
                  Duplicar producto
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => onChangePrice(product)}>
                <DollarSign className="w-4 h-4 mr-2" />
                Cambiar precio
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onManageVariants(product)}>
                <Layers className="w-4 h-4 mr-2" />
                Variantes
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onManageLots(product)}>
                <Boxes className="w-4 h-4 mr-2" />
                Lotes
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onManageSerials(product)}>
                <Hash className="w-4 h-4 mr-2" />
                Seriales
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {product.is_active ? (
                <DropdownMenuItem
                  onClick={() => onDeactivate(product)}
                  disabled={isDeactivating}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Desactivar
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  onClick={() => onActivate(product)}
                  disabled={isActivating}
                  className="text-green-600 focus:text-green-600"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Activar
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Precios y stock */}
        <div className="mt-3 flex items-end justify-between gap-4">
          <div>
            <p className="text-lg font-bold text-foreground">
              ${Number(product.price_usd).toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground">
              Bs. {Number(product.price_bs).toFixed(2)}
            </p>
          </div>

          <div className="text-right">
            {stock ? (
              <div className="flex flex-col items-end gap-1">
                <span
                  className={cn(
                    'text-sm font-semibold',
                    isLowStock ? 'text-destructive' : 'text-foreground'
                  )}
                >
                  {formatStockValue(product, stock)}
                </span>
                {isLowStock && (
                  <Badge variant="destructive" className="text-[10px] gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Stock bajo
                  </Badge>
                )}
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">Sin stock</span>
            )}
          </div>
        </div>

        {/* Estado */}
        <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
          {product.is_active ? (
            <Badge variant="default" className="bg-green-600/10 text-green-600 hover:bg-green-600/20">
              Activo
            </Badge>
          ) : (
            <Badge variant="secondary">Inactivo</Badge>
          )}
          {product.sku && (
            <span className="text-xs text-muted-foreground font-mono">
              SKU: {product.sku}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
