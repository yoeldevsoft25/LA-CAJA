import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@la-caja/ui-core'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { chartOfAccountsService } from '@/services/accounting.service'
import type { ChartOfAccountTree, AccountType } from '@/types/accounting.types'
import { ChevronRight, ChevronDown, Plus, Edit, Trash2 } from 'lucide-react'
import AccountFormModal from './AccountFormModal'
import { cn } from '@la-caja/ui-core'
import toast from '@/lib/toast'

const accountTypeLabels: Record<AccountType, string> = {
  asset: 'Activo',
  liability: 'Pasivo',
  equity: 'Patrimonio',
  revenue: 'Ingreso',
  expense: 'Gasto',
}

const accountTypeColors: Record<AccountType, string> = {
  asset: 'bg-blue-100 text-blue-800',
  liability: 'bg-red-100 text-red-800',
  equity: 'bg-blue-100 text-blue-800',
  revenue: 'bg-green-100 text-green-800',
  expense: 'bg-orange-100 text-orange-800',
}

interface ChartOfAccountsTreeProps {
  onSelectAccount?: (account: ChartOfAccountTree) => void
}

export default function ChartOfAccountsTree({ onSelectAccount }: ChartOfAccountsTreeProps) {
  const queryClient = useQueryClient()
  const [selectedAccount, setSelectedAccount] = useState<ChartOfAccountTree | null>(null)
  const [isFormModalOpen, setIsFormModalOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<ChartOfAccountTree | null>(null)

  const { data: tree, isLoading } = useQuery({
    queryKey: ['accounting', 'accounts', 'tree'],
    queryFn: () => chartOfAccountsService.getTree(),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => chartOfAccountsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounting', 'accounts'] })
      toast.success('Cuenta eliminada exitosamente')
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Error al eliminar la cuenta'
      toast.error(message)
    },
  })

  const handleEdit = (account: ChartOfAccountTree, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingAccount(account)
    setIsFormModalOpen(true)
  }

  const handleDelete = (account: ChartOfAccountTree, e: React.MouseEvent) => {
    e.stopPropagation()
    if (window.confirm(`¿Estás seguro de eliminar la cuenta ${account.account_code} - ${account.account_name}?`)) {
      deleteMutation.mutate(account.id)
    }
  }

  const handleAddChild = (_parent: ChartOfAccountTree, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingAccount(null)
    setIsFormModalOpen(true)
  }

  const handleAccountClick = (account: ChartOfAccountTree) => {
    setSelectedAccount(account)
    onSelectAccount?.(account)
  }

  const renderAccount = (account: ChartOfAccountTree, level: number = 0): React.ReactNode => {
    const hasChildren = account.children && account.children.length > 0
    const isSelected = selectedAccount?.id === account.id

    return (
      <div key={account.id} className="w-full">
        <div
          className={cn(
            'flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2 p-2 sm:p-2 rounded-md hover:bg-accent cursor-pointer transition-colors',
            isSelected && 'bg-accent'
          )}
          style={{ paddingLeft: `${level * 1.5 + 0.5}rem` }}
          onClick={() => handleAccountClick(account)}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {hasChildren ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 opacity-0" />
            )}

            <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
                <span className="font-mono text-xs sm:text-sm font-semibold flex-shrink-0">{account.account_code}</span>
                <span className="flex-1 truncate text-sm sm:text-base">{account.account_name}</span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
                <Badge className={cn('text-[10px] sm:text-xs whitespace-nowrap', accountTypeColors[account.account_type])}>
                  {accountTypeLabels[account.account_type]}
                </Badge>
                {!account.is_active && (
                  <Badge variant="secondary" className="text-[10px] sm:text-xs whitespace-nowrap">
                    Inactiva
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0 sm:ml-auto" onClick={(e) => e.stopPropagation()}>
            {account.level < 4 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 sm:h-7 sm:w-7"
                onClick={(e) => handleAddChild(account, e)}
                title="Agregar cuenta hija"
              >
                <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 sm:h-7 sm:w-7"
              onClick={(e) => handleEdit(account, e)}
              title="Editar cuenta"
            >
              <Edit className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 sm:h-7 sm:w-7 text-destructive hover:text-destructive"
              onClick={(e) => handleDelete(account, e)}
              title="Eliminar cuenta"
            >
              <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Button>
          </div>
        </div>

        {hasChildren && (
          <div className="ml-4">
            {account.children!.map((child) => renderAccount(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  if (!tree || tree.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No hay cuentas configuradas</p>
        <Button
          className="mt-4"
          onClick={() => {
            setEditingAccount(null)
            setIsFormModalOpen(true)
          }}
        >
          Crear primera cuenta
        </Button>
      </div>
    )
  }

  // Agrupar por tipo de cuenta
  const groupedByType = tree.reduce((acc, account) => {
    if (!acc[account.account_type]) {
      acc[account.account_type] = []
    }
    acc[account.account_type].push(account)
    return acc
  }, {} as Record<AccountType, ChartOfAccountTree[]>)

  return (
    <>
      <div className="space-y-4">
        {Object.entries(groupedByType).map(([type, accounts]) => (
          <div key={type} className="border rounded-lg p-3 sm:p-4">
            <h3 className="font-semibold mb-3 flex flex-col sm:flex-row sm:items-center gap-2">
              <Badge className={cn(accountTypeColors[type as AccountType], "text-xs sm:text-sm")}>
                {accountTypeLabels[type as AccountType]}
              </Badge>
              <span className="text-xs sm:text-sm text-muted-foreground">
                {accounts.length} cuenta{accounts.length !== 1 ? 's' : ''}
              </span>
            </h3>
            <div className="space-y-1 overflow-x-hidden">
              {accounts.map((account) => renderAccount(account))}
            </div>
          </div>
        ))}
      </div>

      <AccountFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false)
          setEditingAccount(null)
        }}
        account={editingAccount}
        onSuccess={() => {
          setIsFormModalOpen(false)
          setEditingAccount(null)
        }}
      />
    </>
  )
}
