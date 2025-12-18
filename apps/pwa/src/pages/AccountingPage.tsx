import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import ChartOfAccountsTree from '@/components/accounting/ChartOfAccountsTree'
import AccountFormModal from '@/components/accounting/AccountFormModal'
import EntriesList from '@/components/accounting/EntriesList'
import EntryFormModal from '@/components/accounting/EntryFormModal'
import EntryDetailModal from '@/components/accounting/EntryDetailModal'
import AccountMappingsList from '@/components/accounting/AccountMappingsList'
import MappingFormModal from '@/components/accounting/MappingFormModal'
import ExportsList from '@/components/accounting/ExportsList'
import ExportFormModal from '@/components/accounting/ExportFormModal'
import AccountBalanceView from '@/components/accounting/AccountBalanceView'
import BalanceSheetReport from '@/components/accounting/BalanceSheetReport'
import IncomeStatementReport from '@/components/accounting/IncomeStatementReport'
import { chartOfAccountsService, accountMappingsService } from '@/services/accounting.service'
import type { AccountingEntry, AccountMapping } from '@/types/accounting.types'
import { FileText, BookOpen, Download, Settings, TrendingUp, Plus, BarChart3 } from 'lucide-react'
import toast from 'react-hot-toast'

/**
 * Página principal del módulo contable
 */
export default function AccountingPage() {
  const queryClient = useQueryClient()
  const [isAccountFormOpen, setIsAccountFormOpen] = useState(false)
  const [isEntryFormOpen, setIsEntryFormOpen] = useState(false)
  const [isEntryDetailOpen, setIsEntryDetailOpen] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<AccountingEntry | null>(null)
  const [isMappingFormOpen, setIsMappingFormOpen] = useState(false)
  const [editingMapping, setEditingMapping] = useState<AccountMapping | null>(null)
  const [isExportFormOpen, setIsExportFormOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('accounts')

  const initializeMutation = useMutation({
    mutationFn: () => chartOfAccountsService.initialize(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['accounting', 'accounts'] })
      toast.success(`Plan de cuentas inicializado: ${data.accounts_created} cuentas creadas`)
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Error al inicializar el plan de cuentas'
      toast.error(message)
    },
  })

  const deleteMappingMutation = useMutation({
    mutationFn: (id: string) => accountMappingsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounting', 'mappings'] })
      toast.success('Mapeo eliminado exitosamente')
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Error al eliminar el mapeo'
      toast.error(message)
    },
  })

  const handleInitialize = () => {
    if (window.confirm('¿Estás seguro de inicializar el plan básico de cuentas? Esto creará las cuentas estándar.')) {
      initializeMutation.mutate()
    }
  }

  const handleViewEntry = (entry: AccountingEntry) => {
    setSelectedEntry(entry)
    setIsEntryDetailOpen(true)
  }

  const handleEditMapping = (mapping: AccountMapping) => {
    setEditingMapping(mapping)
    setIsMappingFormOpen(true)
  }

  const handleDeleteMapping = (id: string) => {
    deleteMappingMutation.mutate(id)
  }

  const handleAddMapping = () => {
    setEditingMapping(null)
    setIsMappingFormOpen(true)
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Contabilidad</h1>
          <p className="text-muted-foreground">Gestiona el plan de cuentas, asientos contables y exportaciones</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="accounts">
            <BookOpen className="w-4 h-4 mr-2" />
            Plan de Cuentas
          </TabsTrigger>
          <TabsTrigger value="entries">
            <FileText className="w-4 h-4 mr-2" />
            Asientos Contables
          </TabsTrigger>
          <TabsTrigger value="mappings">
            <Settings className="w-4 h-4 mr-2" />
            Mapeo de Cuentas
          </TabsTrigger>
          <TabsTrigger value="exports">
            <Download className="w-4 h-4 mr-2" />
            Exportaciones
          </TabsTrigger>
          <TabsTrigger value="balance">
            <TrendingUp className="w-4 h-4 mr-2" />
            Balance
          </TabsTrigger>
          <TabsTrigger value="reports">
            <BarChart3 className="w-4 h-4 mr-2" />
            Reportes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Plan de Cuentas</CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleInitialize}
                    disabled={initializeMutation.isPending}
                  >
                    Inicializar Plan Básico
                  </Button>
                  <Button onClick={() => setIsAccountFormOpen(true)}>
                    Nueva Cuenta
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ChartOfAccountsTree />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="entries" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Asientos Contables</CardTitle>
                <Button onClick={() => setIsEntryFormOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Nuevo Asiento
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <EntriesList onViewEntry={handleViewEntry} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mappings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Mapeo de Cuentas</CardTitle>
            </CardHeader>
            <CardContent>
              <AccountMappingsList
                onEdit={handleEditMapping}
                onDelete={handleDeleteMapping}
                onAdd={handleAddMapping}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="exports" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Exportaciones</CardTitle>
                <Button onClick={() => setIsExportFormOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Nueva Exportación
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ExportsList />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="balance" className="space-y-4">
          <AccountBalanceView />
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <Tabs defaultValue="balance-sheet" className="space-y-4">
            <TabsList>
              <TabsTrigger value="balance-sheet">Balance General</TabsTrigger>
              <TabsTrigger value="income-statement">Estado de Resultados</TabsTrigger>
            </TabsList>
            <TabsContent value="balance-sheet">
              <BalanceSheetReport />
            </TabsContent>
            <TabsContent value="income-statement">
              <IncomeStatementReport />
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>

      {/* Modales */}
      <AccountFormModal
        isOpen={isAccountFormOpen}
        onClose={() => setIsAccountFormOpen(false)}
        onSuccess={() => setIsAccountFormOpen(false)}
      />

      <EntryFormModal
        isOpen={isEntryFormOpen}
        onClose={() => setIsEntryFormOpen(false)}
        onSuccess={() => {
          setIsEntryFormOpen(false)
          queryClient.invalidateQueries({ queryKey: ['accounting', 'entries'] })
        }}
      />

      <EntryDetailModal
        isOpen={isEntryDetailOpen}
        onClose={() => {
          setIsEntryDetailOpen(false)
          setSelectedEntry(null)
        }}
        entry={selectedEntry}
        onSuccess={() => {
          setIsEntryDetailOpen(false)
          setSelectedEntry(null)
        }}
      />

      <MappingFormModal
        isOpen={isMappingFormOpen}
        onClose={() => {
          setIsMappingFormOpen(false)
          setEditingMapping(null)
        }}
        mapping={editingMapping}
        onSuccess={() => {
          setIsMappingFormOpen(false)
          setEditingMapping(null)
        }}
      />

      <ExportFormModal
        isOpen={isExportFormOpen}
        onClose={() => setIsExportFormOpen(false)}
        onSuccess={() => setIsExportFormOpen(false)}
      />
    </div>
  )
}
