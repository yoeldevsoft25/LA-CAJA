import { useState } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import {
  Plus,
  Edit,
  Trash2,
  Star,
  StarOff,
  Power,
  PowerOff,
  Printer,
  Scale,
  ScanLine,
  CreditCard,
  Monitor,
} from 'lucide-react'
import {
  peripheralsService,
  PeripheralConfig,
  PeripheralType,
  CreatePeripheralConfigRequest,
  UpdatePeripheralConfigRequest,
} from '@/services/peripherals.service'
import toast from '@/lib/toast'
import PeripheralConfigModal from './PeripheralConfigModal'
import { Button } from '@la-caja/ui-core'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { cn } from '@la-caja/ui-core'

const peripheralTypeLabels: Record<PeripheralType, string> = {
  scanner: 'Escáner',
  printer: 'Impresora',
  drawer: 'Gaveta',
  scale: 'Balanza',
  customer_display: 'Visor de Cliente',
}

const peripheralTypeIcons: Record<PeripheralType, typeof Printer> = {
  scanner: ScanLine,
  printer: Printer,
  drawer: CreditCard,
  scale: Scale,
  customer_display: Monitor,
}

const connectionTypeLabels: Record<string, string> = {
  serial: 'Serial',
  usb: 'USB',
  network: 'Red',
  bluetooth: 'Bluetooth',
  web_serial: 'Web Serial',
}

interface PeripheralsListProps {
  onConfigClick?: (config: PeripheralConfig) => void
}

export default function PeripheralsList({ onConfigClick }: PeripheralsListProps) {
  const queryClient = useQueryClient()
  const [selectedConfig, setSelectedConfig] = useState<PeripheralConfig | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [configToDelete, setConfigToDelete] = useState<PeripheralConfig | null>(null)
  const [typeFilter, setTypeFilter] = useState<PeripheralType | 'all'>('all')

  const { data: configs, isLoading } = useQuery({
    queryKey: ['peripherals', typeFilter],
    queryFn: () =>
      peripheralsService.getConfigsByStore(
        typeFilter === 'all' ? undefined : typeFilter
      ),
    staleTime: 1000 * 60 * 2, // 2 minutos
  })

  const createMutation = useMutation({
    mutationFn: (data: CreatePeripheralConfigRequest) => peripheralsService.createConfig(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['peripherals'] })
      toast.success('Periférico creado correctamente')
      setIsModalOpen(false)
      setSelectedConfig(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al crear el periférico')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePeripheralConfigRequest }) =>
      peripheralsService.updateConfig(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['peripherals'] })
      toast.success('Periférico actualizado correctamente')
      setIsModalOpen(false)
      setSelectedConfig(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al actualizar el periférico')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => peripheralsService.deleteConfig(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['peripherals'] })
      toast.success('Periférico eliminado correctamente')
      setConfigToDelete(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al eliminar el periférico')
    },
  })

  const setDefaultMutation = useMutation({
    mutationFn: (id: string) => peripheralsService.setAsDefault(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['peripherals'] })
      toast.success('Periférico marcado como por defecto')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al marcar como por defecto')
    },
  })

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      peripheralsService.updateConfig(id, { is_active: !isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['peripherals'] })
      toast.success('Estado del periférico actualizado')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al actualizar el estado')
    },
  })

  const handleEdit = (config: PeripheralConfig, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setSelectedConfig(config)
    setIsModalOpen(true)
  }

  const handleAdd = () => {
    setSelectedConfig(null)
    setIsModalOpen(true)
  }

  const handleConfirm = (data: CreatePeripheralConfigRequest | UpdatePeripheralConfigRequest) => {
    if (selectedConfig) {
      updateMutation.mutate({ id: selectedConfig.id, data: data as UpdatePeripheralConfigRequest })
    } else {
      createMutation.mutate(data as CreatePeripheralConfigRequest)
    }
  }

  const handleSetDefault = (config: PeripheralConfig, e: React.MouseEvent) => {
    e.stopPropagation()
    setDefaultMutation.mutate(config.id)
  }

  const handleToggleActive = (config: PeripheralConfig, e: React.MouseEvent) => {
    e.stopPropagation()
    toggleActiveMutation.mutate({ id: config.id, isActive: config.is_active })
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    )
  }

  return (
    <>
      <div className="space-y-4">
        {/* Filtros y acciones */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-center justify-between">
          <Select
            value={typeFilter}
            onValueChange={(value) => setTypeFilter(value as PeripheralType | 'all')}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filtrar por tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="scanner">Escáneres</SelectItem>
              <SelectItem value="printer">Impresoras</SelectItem>
              <SelectItem value="drawer">Gavetas</SelectItem>
              <SelectItem value="scale">Balanza</SelectItem>
              <SelectItem value="customer_display">Visores</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleAdd}>
            <Plus className="w-5 h-5 mr-2" />
            Nuevo Periférico
          </Button>
        </div>

        {/* Tabla de periféricos */}
        {configs && configs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No hay periféricos configurados. Crea un periférico para comenzar.
          </div>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Conexión</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Por Defecto</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {configs?.map((config) => {
                  const Icon = peripheralTypeIcons[config.peripheral_type]
                  return (
                    <TableRow
                      key={config.id}
                      onClick={() => onConfigClick?.(config)}
                      className={cn(
                        'cursor-pointer',
                        !config.is_active && 'opacity-60'
                      )}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Icon className="w-5 h-5 text-primary" />
                          <span className="font-medium">
                            {peripheralTypeLabels[config.peripheral_type]}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-foreground">{config.name}</p>
                          {config.note && (
                            <p className="text-xs text-muted-foreground">{config.note}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {connectionTypeLabels[config.connection_type] || config.connection_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={config.is_active ? 'default' : 'secondary'}>
                          {config.is_active ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {config.is_default ? (
                          <Badge variant="default" className="bg-primary">
                            <Star className="w-3 h-3 mr-1" />
                            Por Defecto
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {!config.is_default && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => handleSetDefault(config, e)}
                              className="h-8 w-8"
                              title="Marcar como por defecto"
                            >
                              <StarOff className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => handleToggleActive(config, e)}
                            className="h-8 w-8"
                            title={config.is_active ? 'Desactivar' : 'Activar'}
                          >
                            {config.is_active ? (
                              <PowerOff className="w-4 h-4 text-warning" />
                            ) : (
                              <Power className="w-4 h-4 text-success" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => handleEdit(config, e)}
                            className="h-8 w-8 text-primary"
                            title="Editar"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation()
                              setConfigToDelete(config)
                            }}
                            className="h-8 w-8 text-destructive"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Modal de crear/editar */}
      <PeripheralConfigModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedConfig(null)
        }}
        config={selectedConfig}
        onConfirm={handleConfirm}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      {/* Dialog de eliminar */}
      <AlertDialog open={!!configToDelete} onOpenChange={() => setConfigToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar periférico?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará la configuración del periférico{' '}
              {configToDelete && (
                <>
                  <strong>{configToDelete.name}</strong> ({peripheralTypeLabels[configToDelete.peripheral_type]}).
                </>
              )}{' '}
              ¿Estás seguro?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => configToDelete && deleteMutation.mutate(configToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

