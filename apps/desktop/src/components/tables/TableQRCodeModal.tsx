import { useEffect, useState } from 'react'
import { QrCode, Download, Copy, Check, ExternalLink } from 'lucide-react'
import { Table } from '@/services/tables.service'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from '@/lib/toast'

interface TableQRCodeModalProps {
  isOpen: boolean
  onClose: () => void
  table: Table | null
}

/**
 * Genera un código QR usando la API de QR Server (gratuita)
 * Alternativa: usar una librería como qrcode.react si se prefiere
 */
function generateQRCodeURL(text: string, size: number = 300): string {
  // Usar API pública gratuita para generar QR codes
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}`
}

export default function TableQRCodeModal({
  isOpen,
  onClose,
  table,
}: TableQRCodeModalProps) {
  const [copied, setCopied] = useState(false)
  const qrCodeUrl = table?.qrCode?.public_url || ''

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [copied])

  const handleCopyURL = async () => {
    if (!qrCodeUrl) {
      toast.error('No hay URL disponible')
      return
    }

    try {
      await navigator.clipboard.writeText(qrCodeUrl)
      setCopied(true)
      toast.success('URL copiada al portapapeles')
    } catch (error) {
      toast.error('Error al copiar la URL')
    }
  }

  const handleDownloadQR = () => {
    if (!qrCodeUrl) {
      toast.error('No hay URL disponible')
      return
    }

    const qrImageUrl = generateQRCodeURL(qrCodeUrl, 512)
    const link = document.createElement('a')
    link.href = qrImageUrl
    link.download = `QR-Mesa-${table?.table_number || 'unknown'}.png`
    link.click()
    toast.success('Código QR descargado')
  }

  const handleOpenURL = () => {
    if (!qrCodeUrl) {
      toast.error('No hay URL disponible')
      return
    }

    window.open(qrCodeUrl, '_blank')
  }

  if (!table) return null

  const qrCodeImageUrl = qrCodeUrl ? generateQRCodeURL(qrCodeUrl, 400) : null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b border-border flex-shrink-0 pr-12">
          <DialogTitle className="text-base sm:text-lg md:text-xl flex items-center">
            <QrCode className="w-5 h-5 sm:w-6 sm:h-6 text-primary mr-2" />
            Código QR - Mesa {table.table_number}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Escanea este código para acceder al menú de esta mesa
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!table.qrCode ? (
            <Alert variant="destructive">
              <AlertDescription>
                Esta mesa no tiene un código QR asociado. Por favor, guarda la mesa nuevamente para generar el código QR.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              {/* Código QR */}
              <div className="flex justify-center p-8 bg-white rounded-3xl border-2 border-dashed border-primary/20 shadow-inner">
                {qrCodeImageUrl ? (
                  <div className="relative group">
                    <img
                      src={qrCodeImageUrl}
                      alt={`QR Code Mesa ${table.table_number}`}
                      className="w-full max-w-[240px] h-auto rounded-xl shadow-lg border-4 border-white"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-card/90 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl">
                      <QrCode className="w-12 h-12 text-primary animate-pulse" />
                    </div>
                  </div>
                ) : (
                  <div className="w-[240px] h-[240px] flex items-center justify-center text-muted-foreground font-medium">
                    Generando código QR...
                  </div>
                )}
              </div>

              {/* URL */}
              <div className="space-y-2 px-1">
                <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">URL del Menú Digital</Label>
                <div className="flex gap-2">
                  <Input
                    value={qrCodeUrl}
                    readOnly
                    className="h-12 font-mono text-xs bg-muted/30 border-muted/40"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleCopyURL}
                    className="h-12 w-12 border border-muted/40 hover:bg-white text-primary"
                    title="Copiar URL"
                  >
                    {copied ? (
                      <Check className="w-5 h-5 text-green-600" />
                    ) : (
                      <Copy className="w-5 h-5" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Información */}
              <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20">
                <p className="text-[10px] font-black text-primary/70 uppercase tracking-widest mb-3">Recomendaciones</p>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2 text-xs font-medium text-foreground">
                    <Check className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                    Descarga e imprime este código para la mesa.
                  </li>
                  <li className="flex items-start gap-2 text-xs font-medium text-foreground">
                    <Check className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                    Pégalo en un lugar visible de la mesa.
                  </li>
                  <li className="flex items-start gap-2 text-xs font-medium text-foreground">
                    <Check className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                    Tus clientes podrán pedir directamente desde su móvil.
                  </li>
                </ul>
              </div>

              {/* Acciones */}
              <div className="flex flex-col-reverse sm:flex-row gap-2.5 pt-4">
                <Button
                  variant="ghost"
                  onClick={onClose}
                  className="h-12 flex-1 font-bold text-muted-foreground"
                >
                  Cerrar
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDownloadQR}
                  className="h-12 flex-1 border-muted/40 font-bold hover:bg-white"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Descargar
                </Button>
                <Button
                  variant="default"
                  onClick={handleOpenURL}
                  className="h-12 flex-1 bg-primary text-primary-foreground font-black shadow-lg shadow-primary/20"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Ver Menú
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
