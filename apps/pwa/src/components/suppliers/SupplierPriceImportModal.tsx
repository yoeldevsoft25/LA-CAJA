import { useEffect, useRef, useState } from 'react'
import { FileText, Upload } from 'lucide-react'
import toast from '@/lib/toast'
import { supplierPriceListsService, ImportSupplierPriceListResponse } from '@/services/supplier-price-lists.service'
import { Supplier } from '@/services/suppliers.service'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface SupplierPriceImportModalProps {
  isOpen: boolean
  onClose: () => void
  suppliers: Supplier[]
  onImported?: () => void
}

export default function SupplierPriceImportModal({
  isOpen,
  onClose,
  suppliers,
  onImported,
}: SupplierPriceImportModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [supplierId, setSupplierId] = useState<string>('')
  const [listName, setListName] = useState<string>('')
  const [currency, setCurrency] = useState<'USD' | 'BS'>('USD')
  const [isImporting, setIsImporting] = useState(false)
  const [result, setResult] = useState<ImportSupplierPriceListResponse | null>(null)

  useEffect(() => {
    if (!isOpen) {
      setFile(null)
      setSupplierId('')
      setListName('')
      setCurrency('USD')
      setIsImporting(false)
      setResult(null)
    }
  }, [isOpen])

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    if (!selectedFile) return

    if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
      toast.error('Selecciona un archivo CSV')
      return
    }

    setFile(selectedFile)
  }

  const handleImport = async () => {
    if (!file) {
      toast.error('Selecciona un archivo CSV')
      return
    }

    setIsImporting(true)
    try {
      const csv = await file.text()
      const response = await supplierPriceListsService.importCSV({
        csv,
        supplier_id: supplierId || undefined,
        list_name: listName.trim() || undefined,
        currency,
      })
      setResult(response)
      toast.success('Lista de precios importada')
      onImported?.()
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error al importar la lista')
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Importar lista de precios (CSV)
          </DialogTitle>
          <DialogDescription>
            Usa el formato del proveedor: Product_Code, Product_Name, Units_Per_Case, Price_A,
            Price_B, Unit_Price_A, Unit_Price_B, Supplier, Date.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-semibold">Proveedor</Label>
                <Select
                  value={supplierId}
                  onValueChange={(value) =>
                    setSupplierId(value === 'none' ? '' : value)
                  }
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Selecciona un proveedor" />
                  </SelectTrigger>
                  <SelectContent>
                  <SelectItem value="none">Sin proveedor</SelectItem>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                  </SelectContent>
                </Select>
            </div>
            <div>
              <Label className="text-sm font-semibold">Moneda de la lista</Label>
              <Select value={currency} onValueChange={(value) => setCurrency(value as 'USD' | 'BS')}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Selecciona moneda" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="BS">Bs</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-sm font-semibold">Nombre de la lista (opcional)</Label>
            <Input
              value={listName}
              onChange={(event) => setListName(event.target.value)}
              className="mt-2"
              placeholder="Ej: Lista Marzo 2024"
            />
          </div>

          <div>
            <Label className="text-sm font-semibold">Archivo CSV</Label>
            <div className="mt-2 flex items-center gap-3">
              <Input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
              />
            </div>
            {file && (
              <p className="text-xs text-muted-foreground mt-1">
                Archivo seleccionado: {file.name}
              </p>
            )}
          </div>

          {result && (
            <div className="rounded-md border border-border bg-muted/40 p-3 text-sm space-y-2">
              <div className="flex items-center justify-between">
                <span>Filas importadas:</span>
                <span className="font-semibold">{result.imported_rows}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Listas creadas:</span>
                <span className="font-semibold">{result.lists.length}</span>
              </div>
              {result.errors.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  {result.errors.length} fila(s) con errores se omitieron.
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
          <Button onClick={handleImport} disabled={isImporting}>
            {isImporting ? 'Importando...' : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Importar
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
