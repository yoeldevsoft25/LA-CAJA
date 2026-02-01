import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Settings, Save } from 'lucide-react'
import {
  PeripheralConfig,
  CreatePeripheralConfigRequest,
  UpdatePeripheralConfigRequest,
  PeripheralType,
  ConnectionType,
} from '@/services/peripherals.service'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const peripheralConfigSchema = z.object({
  peripheral_type: z.enum(['scanner', 'printer', 'drawer', 'scale', 'customer_display']),
  name: z.string().min(1, 'El nombre es requerido').max(100, 'Máximo 100 caracteres'),
  connection_type: z.enum(['serial', 'usb', 'network', 'bluetooth', 'web_serial']),
  connection_config: z.object({
    serialPort: z.string().optional(),
    baudRate: z.number().min(1).optional(),
    dataBits: z.number().min(1).optional(),
    stopBits: z.number().min(1).optional(),
    parity: z.string().optional(),
    host: z.string().optional(),
    networkPort: z.number().min(1).optional(),
    deviceId: z.string().optional(),
    printer: z
      .object({
        paperWidth: z.number().optional(),
        encoding: z.string().optional(),
      })
      .optional(),
    scale: z
      .object({
        protocol: z.string().optional(),
        unit: z.string().optional(),
      })
      .optional(),
    scanner: z
      .object({
        prefix: z.string().optional(),
        suffix: z.string().optional(),
        length: z.number().optional(),
      })
      .optional(),
  }),
  is_active: z.boolean().optional(),
  is_default: z.boolean().optional(),
  note: z.string().max(1000).nullable().optional(),
})

type PeripheralConfigFormData = z.infer<typeof peripheralConfigSchema>

const peripheralTypeLabels: Record<PeripheralType, string> = {
  scanner: 'Escáner',
  printer: 'Impresora',
  drawer: 'Gaveta',
  scale: 'Balanza',
  customer_display: 'Visor de Cliente',
}

const connectionTypeLabels: Record<ConnectionType, string> = {
  serial: 'Serial',
  usb: 'USB',
  network: 'Red',
  bluetooth: 'Bluetooth',
  web_serial: 'Web Serial',
}

interface PeripheralConfigModalProps {
  isOpen: boolean
  onClose: () => void
  config: PeripheralConfig | null
  onConfirm: (data: CreatePeripheralConfigRequest | UpdatePeripheralConfigRequest) => void
  isLoading: boolean
}

export default function PeripheralConfigModal({
  isOpen,
  onClose,
  config,
  onConfirm,
  isLoading,
}: PeripheralConfigModalProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<PeripheralConfigFormData>({
    resolver: zodResolver(peripheralConfigSchema),
    defaultValues: {
      peripheral_type: 'printer',
      name: '',
      connection_type: 'network',
      connection_config: {},
      is_active: true,
      is_default: false,
      note: null,
    },
  })

  const peripheralType = watch('peripheral_type')
  const connectionType = watch('connection_type')
  const isActive = watch('is_active')
  const isDefault = watch('is_default')
  const connectionConfig = watch('connection_config')

  useEffect(() => {
    if (config) {
      reset({
        peripheral_type: config.peripheral_type,
        name: config.name,
        connection_type: config.connection_type,
        connection_config: config.connection_config || {},
        is_active: config.is_active,
        is_default: config.is_default,
        note: config.note || null,
      })
    } else {
      reset({
        peripheral_type: 'printer',
        name: '',
        connection_type: 'network',
        connection_config: {},
        is_active: true,
        is_default: false,
        note: null,
      })
    }
  }, [config, reset])

  const onSubmit = (data: PeripheralConfigFormData) => {
    const requestData: CreatePeripheralConfigRequest | UpdatePeripheralConfigRequest = {
      peripheral_type: data.peripheral_type,
      name: data.name,
      connection_type: data.connection_type,
      connection_config: data.connection_config,
      is_active: data.is_active ?? true,
      is_default: data.is_default ?? false,
      note: data.note || null,
    }
    onConfirm(requestData)
  }

  const updateConnectionConfig = (key: string, value: any) => {
    setValue('connection_config', {
      ...connectionConfig,
      [key]: value,
    } as any)
  }

  const updateNestedConfig = (parentKey: string, key: string, value: any) => {
    setValue('connection_config', {
      ...connectionConfig,
      [parentKey]: {
        ...((connectionConfig as any)[parentKey] || {}),
        [key]: value,
      },
    } as any)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b border-border flex-shrink-0">
          <DialogTitle className="text-lg sm:text-xl flex items-center">
            <Settings className="w-5 h-5 sm:w-6 sm:h-6 text-primary mr-2" />
            {config ? 'Editar Periférico' : 'Crear Periférico'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {config ? 'Edita la configuración del periférico' : 'Crea una nueva configuración de periférico'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 sm:px-4 md:px-6 py-4 sm:py-6">
            <Tabs defaultValue="general" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="general">General</TabsTrigger>
                <TabsTrigger value="connection">Conexión</TabsTrigger>
              </TabsList>

              <TabsContent value="general" className="space-y-4 mt-4">
                <Alert className="bg-info/5 border-info/50">
                  <AlertDescription className="text-sm text-foreground">
                    Configura los periféricos del sistema (impresoras, balanzas, escáneres, etc.)
                  </AlertDescription>
                </Alert>

                {/* Tipo de periférico */}
                <div>
                  <Label htmlFor="peripheral_type">
                    Tipo de Periférico <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={peripheralType}
                    onValueChange={(value) => setValue('peripheral_type', value as PeripheralType)}
                    disabled={isLoading || !!config}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="scanner">{peripheralTypeLabels.scanner}</SelectItem>
                      <SelectItem value="printer">{peripheralTypeLabels.printer}</SelectItem>
                      <SelectItem value="drawer">{peripheralTypeLabels.drawer}</SelectItem>
                      <SelectItem value="scale">{peripheralTypeLabels.scale}</SelectItem>
                      <SelectItem value="customer_display">
                        {peripheralTypeLabels.customer_display}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Nombre */}
                <div>
                  <Label htmlFor="name">
                    Nombre <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="name"
                    {...register('name')}
                    className="mt-2"
                    placeholder="Ej: Impresora Principal, Balanza 1"
                    maxLength={100}
                    disabled={isLoading}
                  />
                  {errors.name && (
                    <p className="mt-1 text-sm text-destructive">{errors.name.message}</p>
                  )}
                </div>

                {/* Estado */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="is_active" className="text-base">
                      Activo
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Si está desactivado, no se usará este periférico
                    </p>
                  </div>
                  <Switch
                    id="is_active"
                    checked={isActive}
                    onCheckedChange={(checked) => setValue('is_active', checked)}
                    disabled={isLoading}
                  />
                </div>

                {/* Por defecto */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="is_default" className="text-base">
                      Periférico por Defecto
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Si está activado, será el periférico por defecto de este tipo
                    </p>
                  </div>
                  <Switch
                    id="is_default"
                    checked={isDefault}
                    onCheckedChange={(checked) => setValue('is_default', checked)}
                    disabled={isLoading}
                  />
                </div>

                {/* Nota */}
                <div>
                  <Label htmlFor="note">Nota (Opcional)</Label>
                  <Textarea
                    id="note"
                    {...register('note')}
                    rows={3}
                    className="mt-2 resize-none"
                    placeholder="Notas adicionales sobre el periférico..."
                    maxLength={1000}
                    disabled={isLoading}
                  />
                </div>
              </TabsContent>

              <TabsContent value="connection" className="space-y-4 mt-4">
                {/* Tipo de conexión */}
                <div>
                  <Label htmlFor="connection_type">
                    Tipo de Conexión <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={connectionType}
                    onValueChange={(value) => setValue('connection_type', value as ConnectionType)}
                    disabled={isLoading}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="serial">{connectionTypeLabels.serial}</SelectItem>
                      <SelectItem value="usb">{connectionTypeLabels.usb}</SelectItem>
                      <SelectItem value="network">{connectionTypeLabels.network}</SelectItem>
                      <SelectItem value="bluetooth">{connectionTypeLabels.bluetooth}</SelectItem>
                      <SelectItem value="web_serial">{connectionTypeLabels.web_serial}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Configuración según tipo de conexión */}
                {connectionType === 'serial' && (
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="serialPort">Puerto Serial</Label>
                      <Input
                        id="serialPort"
                        value={connectionConfig.serialPort || ''}
                        onChange={(e) => updateConnectionConfig('serialPort', e.target.value)}
                        className="mt-2"
                        placeholder="Ej: COM3, /dev/ttyUSB0"
                        disabled={isLoading}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="baudRate">Baud Rate</Label>
                        <Input
                          id="baudRate"
                          type="number"
                          value={connectionConfig.baudRate || ''}
                          onChange={(e) =>
                            updateConnectionConfig('baudRate', parseInt(e.target.value) || undefined)
                          }
                          className="mt-2"
                          placeholder="9600"
                          disabled={isLoading}
                        />
                      </div>
                      <div>
                        <Label htmlFor="dataBits">Data Bits</Label>
                        <Input
                          id="dataBits"
                          type="number"
                          value={connectionConfig.dataBits || ''}
                          onChange={(e) =>
                            updateConnectionConfig('dataBits', parseInt(e.target.value) || undefined)
                          }
                          className="mt-2"
                          placeholder="8"
                          disabled={isLoading}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {connectionType === 'network' && (
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="host">Host / IP</Label>
                      <Input
                        id="host"
                        value={connectionConfig.host || ''}
                        onChange={(e) => updateConnectionConfig('host', e.target.value)}
                        className="mt-2"
                        placeholder="Ej: 192.168.1.100"
                        disabled={isLoading}
                      />
                    </div>
                    <div>
                      <Label htmlFor="networkPort">Puerto</Label>
                      <Input
                        id="networkPort"
                        type="number"
                        value={connectionConfig.networkPort || ''}
                        onChange={(e) =>
                          updateConnectionConfig('networkPort', parseInt(e.target.value) || undefined)
                        }
                        className="mt-2"
                        placeholder="9100"
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                )}

                {/* Configuración específica por tipo de periférico */}
                {peripheralType === 'printer' && (
                  <div className="space-y-3 border-t border-border pt-4">
                    <h3 className="font-semibold text-foreground">Configuración de Impresora</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="paperWidth">Ancho de Papel (mm)</Label>
                        <Input
                          id="paperWidth"
                          type="number"
                          value={connectionConfig.printer?.paperWidth || ''}
                          onChange={(e) =>
                            updateNestedConfig(
                              'printer',
                              'paperWidth',
                              parseInt(e.target.value) || undefined
                            )
                          }
                          className="mt-2"
                          placeholder="80"
                          disabled={isLoading}
                        />
                      </div>
                      <div>
                        <Label htmlFor="encoding">Codificación</Label>
                        <Input
                          id="encoding"
                          value={connectionConfig.printer?.encoding || ''}
                          onChange={(e) =>
                            updateNestedConfig('printer', 'encoding', e.target.value)
                          }
                          className="mt-2"
                          placeholder="utf-8"
                          disabled={isLoading}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {peripheralType === 'scale' && (
                  <div className="space-y-3 border-t border-border pt-4">
                    <h3 className="font-semibold text-foreground">Configuración de Balanza</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="protocol">Protocolo</Label>
                        <Input
                          id="protocol"
                          value={connectionConfig.scale?.protocol || ''}
                          onChange={(e) => updateNestedConfig('scale', 'protocol', e.target.value)}
                          className="mt-2"
                          placeholder="Ej: mettler_toledo"
                          disabled={isLoading}
                        />
                      </div>
                      <div>
                        <Label htmlFor="unit">Unidad</Label>
                        <Select
                          value={connectionConfig.scale?.unit || 'kg'}
                          onValueChange={(value) => updateNestedConfig('scale', 'unit', value)}
                          disabled={isLoading}
                        >
                          <SelectTrigger className="mt-2">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="kg">Kilogramos (kg)</SelectItem>
                            <SelectItem value="g">Gramos (g)</SelectItem>
                            <SelectItem value="lb">Libras (lb)</SelectItem>
                            <SelectItem value="oz">Onzas (oz)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                )}

                {peripheralType === 'scanner' && (
                  <div className="space-y-3 border-t border-border pt-4">
                    <h3 className="font-semibold text-foreground">Configuración de Escáner</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="prefix">Prefijo</Label>
                        <Input
                          id="prefix"
                          value={connectionConfig.scanner?.prefix || ''}
                          onChange={(e) => updateNestedConfig('scanner', 'prefix', e.target.value)}
                          className="mt-2"
                          placeholder="Ej: *"
                          disabled={isLoading}
                        />
                      </div>
                      <div>
                        <Label htmlFor="suffix">Sufijo</Label>
                        <Input
                          id="suffix"
                          value={connectionConfig.scanner?.suffix || ''}
                          onChange={(e) => updateNestedConfig('scanner', 'suffix', e.target.value)}
                          className="mt-2"
                          placeholder="Ej: #"
                          disabled={isLoading}
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="length">Longitud</Label>
                      <Input
                        id="length"
                        type="number"
                        value={connectionConfig.scanner?.length || ''}
                        onChange={(e) =>
                          updateNestedConfig('scanner', 'length', parseInt(e.target.value) || undefined)
                        }
                        className="mt-2"
                        placeholder="13"
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>

          {/* Footer */}
          <div className="flex-shrink-0 border-t border-border px-3 sm:px-4 md:px-6 py-3 sm:py-4">
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="flex-1"
                disabled={isLoading}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5 mr-2" />
                    {config ? 'Actualizar' : 'Crear'} Periférico
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

