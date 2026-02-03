import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Button } from '@la-caja/ui-core'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { accountBalanceService, chartOfAccountsService } from '@/services/accounting.service'
import { Calendar as CalendarIcon } from 'lucide-react'
import { cn } from '@la-caja/ui-core'

export default function AccountBalanceView() {
  const [selectedAccountId, setSelectedAccountId] = useState<string>('')
  const [startDate, setStartDate] = useState<Date | undefined>(new Date(new Date().getFullYear(), 0, 1))
  const [endDate, setEndDate] = useState<Date | undefined>(new Date())

  const { data: accounts } = useQuery({
    queryKey: ['accounting', 'accounts'],
    queryFn: () => chartOfAccountsService.getAll(),
  })

  const { data: balance, isLoading } = useQuery({
    queryKey: ['accounting', 'balance', selectedAccountId, startDate, endDate],
    queryFn: () =>
      accountBalanceService.getBalance(selectedAccountId, {
        start_date: format(startDate!, 'yyyy-MM-dd'),
        end_date: format(endDate!, 'yyyy-MM-dd'),
      }),
    enabled: !!selectedAccountId && !!startDate && !!endDate,
  })

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Cuenta *</Label>
              <Select value={selectedAccountId || undefined} onValueChange={setSelectedAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar cuenta" />
                </SelectTrigger>
                <SelectContent>
                  {accounts?.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.account_code} - {account.account_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Fecha Inicio *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn('w-full justify-start text-left font-normal', !startDate && 'text-muted-foreground')}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, 'dd/MM/yyyy') : 'Seleccionar'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={startDate} onSelect={setStartDate} />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Fecha Fin *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn('w-full justify-start text-left font-normal', !endDate && 'text-muted-foreground')}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, 'dd/MM/yyyy') : 'Seleccionar'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={endDate} onSelect={setEndDate} />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Balance */}
      {selectedAccountId && startDate && endDate && (
        <Card>
          <CardHeader>
            <CardTitle>Balance de Cuenta</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : balance ? (
              <div className="space-y-6">
                {/* Información de la cuenta */}
                <div className="border-b pb-4">
                  <h3 className="font-semibold text-lg">{balance.account_name}</h3>
                  <p className="text-sm text-muted-foreground font-mono">{balance.account_code}</p>
                </div>

                {/* Saldos en Bolívares */}
                <div>
                  <h4 className="font-semibold mb-4">Bolívares (BS)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="border rounded-lg p-4">
                      <p className="text-sm text-muted-foreground mb-1">Saldo Inicial</p>
                      <p className="text-2xl font-bold font-mono">
                        {Number(balance.opening_balance_bs).toFixed(2)}
                      </p>
                    </div>
                    <div className="border rounded-lg p-4">
                      <p className="text-sm text-muted-foreground mb-1">Débitos</p>
                      <p className="text-2xl font-bold font-mono text-green-600">
                        {Number(balance.total_debit_bs).toFixed(2)}
                      </p>
                    </div>
                    <div className="border rounded-lg p-4">
                      <p className="text-sm text-muted-foreground mb-1">Créditos</p>
                      <p className="text-2xl font-bold font-mono text-red-600">
                        {Number(balance.total_credit_bs).toFixed(2)}
                      </p>
                    </div>
                    <div className="border rounded-lg p-4 bg-muted">
                      <p className="text-sm text-muted-foreground mb-1">Saldo Final</p>
                      <p className="text-2xl font-bold font-mono">
                        {Number(balance.closing_balance_bs).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Saldos en Dólares */}
                <div>
                  <h4 className="font-semibold mb-4">Dólares (USD)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="border rounded-lg p-4">
                      <p className="text-sm text-muted-foreground mb-1">Saldo Inicial</p>
                      <p className="text-2xl font-bold font-mono">
                        ${Number(balance.opening_balance_usd).toFixed(2)}
                      </p>
                    </div>
                    <div className="border rounded-lg p-4">
                      <p className="text-sm text-muted-foreground mb-1">Débitos</p>
                      <p className="text-2xl font-bold font-mono text-green-600">
                        ${Number(balance.total_debit_usd).toFixed(2)}
                      </p>
                    </div>
                    <div className="border rounded-lg p-4">
                      <p className="text-sm text-muted-foreground mb-1">Créditos</p>
                      <p className="text-2xl font-bold font-mono text-red-600">
                        ${Number(balance.total_credit_usd).toFixed(2)}
                      </p>
                    </div>
                    <div className="border rounded-lg p-4 bg-muted">
                      <p className="text-sm text-muted-foreground mb-1">Saldo Final</p>
                      <p className="text-2xl font-bold font-mono">
                        ${Number(balance.closing_balance_usd).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                No hay datos de balance para los filtros seleccionados
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {!selectedAccountId && (
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">
              Selecciona una cuenta y rango de fechas para ver el balance
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
