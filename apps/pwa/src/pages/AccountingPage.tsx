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
import TrialBalanceReport from '@/components/accounting/TrialBalanceReport'
import GeneralLedgerReport from '@/components/accounting/GeneralLedgerReport'
import CashFlowReport from '@/components/accounting/CashFlowReport'
import ValidationReport from '@/components/accounting/ValidationReport'
import ReconciliationTool from '@/components/accounting/ReconciliationTool'
import { chartOfAccountsService, accountMappingsService } from '@/services/accounting.service'
import type { AccountingEntry, AccountMapping } from '@/types/accounting.types'
import { FileText, BookOpen, Download, Settings, TrendingUp, Plus, BarChart3, ShieldCheck } from 'lucide-react'
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
      queryClient.invalidateQueries({ queryKey: ['accounting', 'accounts', 'tree'] })
      queryClient.invalidateQueries({ queryKey: ['accounting', 'mappings'] })
      if (typeof data.accounts_created === 'number') {
        const mappingsText = typeof data.mappings_created === 'number'
          ? `, ${data.mappings_created} mapeos creados`
          : ''
        toast.success(`Plan de cuentas inicializado: ${data.accounts_created} cuentas creadas${mappingsText}`)
      } else {
        toast.success(data.message || 'Plan de cuentas inicializado')
      }
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
    <div className="h-full max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Contabilidad</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">Gestiona el plan de cuentas, asientos contables y exportaciones</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="accounts" className="text-xs sm:text-sm gap-1.5 sm:gap-2">
            <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
            <span className="hidden sm:inline">Plan de Cuentas</span>
            <span className="sm:hidden">Cuentas</span>
          </TabsTrigger>
          <TabsTrigger value="entries" className="text-xs sm:text-sm gap-1.5 sm:gap-2">
            <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
            <span className="hidden sm:inline">Asientos Contables</span>
            <span className="sm:hidden">Asientos</span>
          </TabsTrigger>
          <TabsTrigger value="mappings" className="text-xs sm:text-sm gap-1.5 sm:gap-2">
            <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
            <span className="hidden sm:inline">Mapeo de Cuentas</span>
            <span className="sm:hidden">Mapeo</span>
          </TabsTrigger>
          <TabsTrigger value="exports" className="text-xs sm:text-sm gap-1.5 sm:gap-2">
            <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
            <span className="hidden sm:inline">Exportaciones</span>
            <span className="sm:hidden">Exportar</span>
          </TabsTrigger>
          <TabsTrigger value="balance" className="text-xs sm:text-sm gap-1.5 sm:gap-2">
            <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
            Balance
          </TabsTrigger>
          <TabsTrigger value="reports" className="text-xs sm:text-sm gap-1.5 sm:gap-2">
            <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
            Reportes
          </TabsTrigger>
          <TabsTrigger value="validations" className="text-xs sm:text-sm gap-1.5 sm:gap-2">
            <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
            <span className="hidden sm:inline">Validaciones</span>
            <span className="sm:hidden">Valid.</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <CardTitle className="text-lg sm:text-xl">Plan de Cuentas</CardTitle>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                  <Button
                    variant="outline"
                    onClick={handleInitialize}
                    disabled={initializeMutation.isPending}
                    className="w-full sm:w-auto text-xs sm:text-sm"
                  >
                    <span className="hidden sm:inline">Inicializar Plan Básico</span>
                    <span className="sm:hidden">Inicializar</span>
                  </Button>
                  <Button onClick={() => setIsAccountFormOpen(true)} className="w-full sm:w-auto">
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
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <CardTitle className="text-lg sm:text-xl">Asientos Contables</CardTitle>
                <Button onClick={() => setIsEntryFormOpen(true)} className="w-full sm:w-auto">
                  <Plus className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Nuevo Asiento</span>
                  <span className="sm:hidden">Nuevo</span>
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
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <CardTitle className="text-lg sm:text-xl">Exportaciones</CardTitle>
                <Button onClick={() => setIsExportFormOpen(true)} className="w-full sm:w-auto">
                  <Plus className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Nueva Exportación</span>
                  <span className="sm:hidden">Nueva</span>
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
              <TabsTrigger value="cash-flow">Flujo de Efectivo</TabsTrigger>
              <TabsTrigger value="trial-balance">Balance de Comprobación</TabsTrigger>
              <TabsTrigger value="general-ledger">Libro Mayor</TabsTrigger>
            </TabsList>
            <TabsContent value="balance-sheet">
              <BalanceSheetReport />
            </TabsContent>
            <TabsContent value="income-statement">
              <IncomeStatementReport />
            </TabsContent>
            <TabsContent value="cash-flow">
              <CashFlowReport />
            </TabsContent>
            <TabsContent value="trial-balance">
              <TrialBalanceReport />
            </TabsContent>
            <TabsContent value="general-ledger">
              <GeneralLedgerReport />
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="validations" className="space-y-4">
          <Tabs defaultValue="validation" className="space-y-4">
            <TabsList>
              <TabsTrigger value="validation">Validación de Integridad</TabsTrigger>
              <TabsTrigger value="reconciliation">Reconciliación de Cuentas</TabsTrigger>
            </TabsList>
            <TabsContent value="validation">
              <ValidationReport />
            </TabsContent>
            <TabsContent value="reconciliation">
              <ReconciliationTool />
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
