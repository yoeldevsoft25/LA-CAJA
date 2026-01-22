import { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { adminService, AdminStore, AdminMember } from '@/services/admin.service'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { toast } from '@/lib/toast'
import { addDays, format, formatDistanceToNowStrict, isAfter, parseISO } from 'date-fns'
import { MoreHorizontal, ShieldCheck, ShieldOff, Sparkles, CreditCard, Calendar, Trash2, AlertTriangle } from 'lucide-react'

function formatDate(value: string | null) {
  if (!value) return '—'
  try {
    return format(parseISO(value), 'yyyy-MM-dd')
  } catch {
    return value
  }
}

function formatDistance(value: string | null) {
  if (!value) return '—'
  try {
    return formatDistanceToNowStrict(parseISO(value), { addSuffix: true })
  } catch {
    return value
  }
}

function statusBadge(store: AdminStore) {
  const now = new Date()
  const expires = store.license_expires_at ? parseISO(store.license_expires_at) : null
  const isExpired = expires ? isAfter(now, expires) : false
  if (store.license_status === 'suspended') {
    return <Badge variant="destructive">Suspendida</Badge>
  }
  if (isExpired) {
    return <Badge variant="destructive">Expirada</Badge>
  }
  return <Badge className="bg-emerald-600 text-white hover:bg-emerald-700">Activa</Badge>
}

export default function AdminPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [planFilter, setPlanFilter] = useState<string>('all')
  const [expiringIn, setExpiringIn] = useState<string>('none')
  const [adminKey, setAdminKey] = useState<string>(() => adminService.getKey() || '')
  const [userSheetStore, setUserSheetStore] = useState<AdminStore | null>(null)
  const [planSheetStore, setPlanSheetStore] = useState<AdminStore | null>(null)
  const [newPlan, setNewPlan] = useState<string>('')
  const [planExpiryDays, setPlanExpiryDays] = useState<string>('')
  const [newUser, setNewUser] = useState<{ full_name: string; role: 'owner' | 'cashier'; pin: string }>({
    full_name: '',
    role: 'cashier',
    pin: '',
  })
  const [newStore, setNewStore] = useState<{ name: string; plan: string; days: string; notes: string }>({
    name: '',
    plan: '',
    days: '',
    notes: '',
  })
  const [deleteConfirmStore, setDeleteConfirmStore] = useState<AdminStore | null>(null)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const { data: stores, isLoading, refetch, error } = useQuery<AdminStore[], Error>({
    queryKey: ['admin-stores', statusFilter, planFilter, expiringIn, adminKey],
    queryFn: () =>
      adminService.listStores({
        status: statusFilter === 'all' ? undefined : statusFilter,
        plan: planFilter === 'all' ? undefined : planFilter,
        expiring_in_days: expiringIn === 'none' ? undefined : Number(expiringIn),
      }),
    enabled: !!adminKey,
    staleTime: 1000 * 30,
  })

  useEffect(() => {
    if (adminKey) adminService.setKey(adminKey)
  }, [adminKey])

  const mutation = useMutation({
    mutationFn: (payload: { storeId: string; data: any }) =>
      adminService.updateLicense(payload.storeId, payload.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-stores'] })
      toast.success('Licencia actualizada')
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || 'Error'
      toast.error(msg)
    },
  })

  const trialMutation = useMutation({
    mutationFn: (storeId: string) => adminService.startTrial(storeId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-stores'] })
      toast.success('Trial reiniciado')
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || 'Error'
      toast.error(msg)
    },
  })

  const sorted = useMemo<AdminStore[]>(() => {
    if (!stores) return []
    return [...stores]
      .filter((s) => {
        if (statusFilter === 'expired') {
          return s.license_expires_at ? isAfter(new Date(), parseISO(s.license_expires_at)) : false
        }
        return true
      })
      .sort((a, b) => {
        const aDate = a.license_expires_at || ''
        const bDate = b.license_expires_at || ''
        return aDate.localeCompare(bDate)
      })
  }, [stores, statusFilter])

  const stats = useMemo(() => {
    if (!stores) return { total: 0, active: 0, suspended: 0, expiringSoon: 0 }
    const now = new Date()
    return {
      total: stores.length,
      active: stores.filter((s) => s.license_status === 'active').length,
      suspended: stores.filter((s) => s.license_status === 'suspended').length,
      expiringSoon: stores.filter((s) => {
        if (!s.license_expires_at) return false
        const diff = parseISO(s.license_expires_at).getTime() - now.getTime()
        return diff > 0 && diff < 1000 * 60 * 60 * 24 * 7
      }).length,
    }
  }, [stores])

  const handleExtend = (store: AdminStore, days: number) => {
    const base = store.license_expires_at ? parseISO(store.license_expires_at) : new Date()
    const newDate = addDays(base, days)
    mutation.mutate({
      storeId: store.id,
      data: { status: 'active', expires_at: newDate.toISOString(), plan: store.license_plan ?? 'plan' },
    })
  }

  const createStoreMutation = useMutation({
    mutationFn: () =>
      adminService.createStore({
        name: newStore.name,
        plan: newStore.plan || undefined,
        expires_at: newStore.days ? new Date(Date.now() + Number(newStore.days) * 86400000).toISOString() : undefined,
        notes: newStore.notes || undefined,
      }),
    onSuccess: () => {
      toast.success('Tienda creada')
      setNewStore({ name: '', plan: '', days: '', notes: '' })
      qc.invalidateQueries({ queryKey: ['admin-stores'] })
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || 'Error'
      toast.error(msg)
    },
  })

  const {
    data: members,
    refetch: refetchMembers,
    isFetching: isMembersLoading,
  } = useQuery<AdminMember[]>({
    queryKey: ['admin-members', userSheetStore?.id],
    queryFn: () => adminService.listUsers(userSheetStore!.id),
    enabled: !!userSheetStore?.id && !!adminKey,
  })

  const createUserMutation = useMutation({
    mutationFn: () =>
      adminService.createUser(userSheetStore!.id, {
        full_name: newUser.full_name,
        role: newUser.role,
        pin: newUser.pin ? newUser.pin : undefined,
      }),
    onSuccess: () => {
      toast.success('Usuario creado')
      setNewUser({ full_name: '', role: 'cashier', pin: '' })
      refetchMembers()
      qc.invalidateQueries({ queryKey: ['admin-stores'] })
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || 'Error'
      toast.error(msg)
    },
  })

  const deleteUserMutation = useMutation({
    mutationFn: (userId: string) => adminService.deleteUser(userSheetStore!.id, userId),
    onSuccess: () => {
      toast.success('Usuario removido')
      refetchMembers()
      qc.invalidateQueries({ queryKey: ['admin-stores'] })
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || 'Error'
      toast.error(msg)
    },
  })

  const deleteStoreMutation = useMutation({
    mutationFn: (storeId: string) => adminService.deleteStore(storeId),
    onSuccess: (data) => {
      toast.success(data.message || 'Tienda eliminada')
      setDeleteConfirmStore(null)
      setDeleteConfirmText('')
      qc.invalidateQueries({ queryKey: ['admin-stores'] })
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || 'Error al eliminar'
      toast.error(msg)
    },
  })

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-950 to-black text-slate-50">
      <div className="grid lg:grid-cols-[280px,1fr] gap-6 p-6">
        <Card className="bg-slate-900/70 border-slate-800 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-white">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
              Torre de control
            </CardTitle>
            <p className="text-sm text-slate-400">
              Administra licencias, trials y estados de todas las tiendas.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="adminkey" className="text-slate-200">
                Admin key
              </Label>
              <Input
                id="adminkey"
                type="password"
                placeholder="Ingresa tu clave"
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                className="bg-slate-950 border-slate-800 text-slate-100"
              />
              <div className="flex gap-2">
                <Button
                  className="flex-1 bg-black text-white hover:bg-black/80 border border-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => refetch()}
                  disabled={!adminKey}
                >
                  Sincronizar
                </Button>
                <Button
                  variant="outline"
                  className="border-slate-700 text-white bg-black hover:bg-black/80"
                  onClick={() => {
                    adminService.clearKey()
                    setAdminKey('')
                    qc.clear()
                  }}
                >
                  Limpiar
                </Button>
              </div>
            </div>

            <Separator className="bg-slate-800" />

            <div className="space-y-3">
              <Label className="text-slate-200">Filtros rápidos</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-100">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 text-slate-100 border-slate-800">
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="active">Activas</SelectItem>
                  <SelectItem value="suspended">Suspendidas</SelectItem>
                  <SelectItem value="expired">Expiradas</SelectItem>
                </SelectContent>
              </Select>
              <Select value={planFilter} onValueChange={setPlanFilter}>
                <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-100">
                  <SelectValue placeholder="Plan" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 text-slate-100 border-slate-800">
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="freemium">🆓 Freemium</SelectItem>
                  <SelectItem value="basico">💼 Básico</SelectItem>
                  <SelectItem value="profesional">🚀 Profesional</SelectItem>
                  <SelectItem value="empresarial">🏢 Empresarial</SelectItem>
                </SelectContent>
              </Select>
              <Select value={expiringIn} onValueChange={setExpiringIn}>
                <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-100">
                  <SelectValue placeholder="Expiran en" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 text-slate-100 border-slate-800">
                  <SelectItem value="none">Sin filtro de fecha</SelectItem>
                  <SelectItem value="3">3 días</SelectItem>
                  <SelectItem value="7">7 días</SelectItem>
                  <SelectItem value="14">14 días</SelectItem>
                  <SelectItem value="30">30 días</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Admin</p>
              <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
                Panel de licencias
                <Sparkles className="h-5 w-5 text-amber-300" />
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => navigate('/admin/license-payments')}
                className="border-slate-700 text-white bg-slate-900/70 hover:bg-slate-800"
              >
                <CreditCard className="h-4 w-4 mr-2" />
                Pagos de Licencias
              </Button>
              <div className="text-xs text-slate-400">
                Sincronizado {stores ? <span className="text-emerald-300">OK</span> : <span className="text-slate-400">pendiente</span>}
              </div>
              <div className="flex items-center gap-2 bg-slate-900/70 border border-slate-800 rounded-lg px-3 py-2">
                <Input
                  placeholder="Nombre de tienda"
                  value={newStore.name}
                  onChange={(e) => setNewStore((prev) => ({ ...prev, name: e.target.value }))}
                  className="h-9 bg-slate-950 border-slate-800 text-slate-100"
                />
                <Input
                  placeholder="Plan (opcional)"
                  value={newStore.plan}
                  onChange={(e) => setNewStore((prev) => ({ ...prev, plan: e.target.value }))}
                  className="h-9 bg-slate-950 border-slate-800 text-slate-100 w-32"
                />
                <Input
                  placeholder="Días trial"
                  value={newStore.days}
                  onChange={(e) => setNewStore((prev) => ({ ...prev, days: e.target.value }))}
                  className="h-9 bg-slate-950 border-slate-800 text-slate-100 w-24"
                />
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700 text-white h-9"
                  disabled={!newStore.name || createStoreMutation.isPending}
                  onClick={() => createStoreMutation.mutate()}
                >
                  Crear tienda
                </Button>
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Card className="bg-slate-900/70 border-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-300">Tiendas</CardTitle>
              </CardHeader>
              <CardContent className="text-3xl font-semibold text-white">{stats.total}</CardContent>
            </Card>
            <Card className="bg-slate-900/70 border-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-300">Activas</CardTitle>
              </CardHeader>
              <CardContent className="text-3xl font-semibold text-emerald-300">{stats.active}</CardContent>
            </Card>
            <Card className="bg-slate-900/70 border-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-300">Suspendidas</CardTitle>
              </CardHeader>
              <CardContent className="text-3xl font-semibold text-rose-300">{stats.suspended}</CardContent>
            </Card>
            <Card className="bg-slate-900/70 border-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-300">Expiran &lt; 7d</CardTitle>
              </CardHeader>
              <CardContent className="text-3xl font-semibold text-amber-300">{stats.expiringSoon}</CardContent>
            </Card>
          </div>

          {!adminKey ? (
            <Card className="bg-slate-900/70 border-slate-800">
              <CardContent className="py-6 text-sm text-slate-300">
                Ingresa la admin key para gestionar licencias.
              </CardContent>
            </Card>
          ) : isLoading ? (
            <Card className="bg-slate-900/70 border-slate-800">
              <CardContent className="py-6 text-sm text-slate-300">Cargando...</CardContent>
            </Card>
          ) : error ? (
            <Card className="bg-slate-900/70 border-slate-800">
              <CardContent className="py-6 text-sm text-rose-300">
                No se pudo cargar: {error.message || 'Error cargando tiendas'}
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-slate-900/70 border-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-white">Tiendas</CardTitle>
                <p className="text-sm text-slate-400">Control granular de licencias y trials.</p>
              </CardHeader>
              <CardContent>
                <ScrollArea className="w-full">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-900 border border-slate-800 text-slate-200 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Tienda</th>
                        <th className="px-3 py-2 text-left font-medium">Estado</th>
                        <th className="px-3 py-2 text-left font-medium">Plan</th>
                        <th className="px-3 py-2 text-left font-medium">Expira</th>
                        <th className="px-3 py-2 text-left font-medium">Usuarios</th>
                        <th className="px-3 py-2 text-left font-medium">Gracia</th>
                        <th className="px-3 py-2 text-left font-medium">Notas</th>
                        <th className="px-3 py-2 text-right font-medium">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map((store) => (
                        <tr key={store.id} className="border-b border-slate-800 hover:bg-slate-900/60">
                          <td className="px-3 py-3">
                            <div className="font-semibold text-white">{store.name}</div>
                            <div className="text-[11px] text-slate-400">{store.id}</div>
                          </td>
                          <td className="px-3 py-3">{statusBadge(store)}</td>
                          <td className="px-3 py-3">
                            {(() => {
                              const plan = store.license_plan || 'sin-plan'
                              const planLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
                                'freemium': { label: '🆓 Freemium', variant: 'outline' },
                                'basico': { label: '💼 Básico', variant: 'secondary' },
                                'profesional': { label: '🚀 Profesional', variant: 'default' },
                                'empresarial': { label: '🏢 Empresarial', variant: 'default' },
                                'sin-plan': { label: 'Sin plan', variant: 'outline' },
                              }
                              const planInfo = planLabels[plan] || planLabels['sin-plan']
                              return (
                                <Badge variant={planInfo.variant} className="border-slate-700 text-slate-200">
                                  {planInfo.label}
                                </Badge>
                              )
                            })()}
                          </td>
                          <td className="px-3 py-3">
                            <div className="text-slate-100">{formatDate(store.license_expires_at)}</div>
                            <div className="text-[11px] text-slate-400">{formatDistance(store.license_expires_at)}</div>
                          </td>
                          <td className="px-3 py-3 text-slate-100">
                            <div className="text-sm font-semibold">{store.member_count} usuarios</div>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {store.members?.slice(0, 3).map((m) => (
                                <Badge key={m.user_id} variant="outline" className="border-slate-700 text-slate-200">
                                  {m.full_name || m.user_id.slice(0, 6)} · {m.role}
                                </Badge>
                              ))}
                              {store.member_count > 3 && (
                                <Badge variant="secondary" className="bg-slate-800 text-slate-200">
                                  +{store.member_count - 3}
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-slate-200">{store.license_grace_days} días</td>
                          <td className="px-3 py-3 text-xs text-slate-300 max-w-[220px]">
                            {store.license_notes || '—'}
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex justify-end">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button size="sm" variant="ghost" className="text-slate-100 hover:bg-slate-800">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="bg-slate-900 border-slate-800 text-slate-100">
                                  <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                  <DropdownMenuSeparator className="bg-slate-800" />
                                  <DropdownMenuItem
                                    onClick={() => trialMutation.mutate(store.id)}
                                    disabled={trialMutation.isPending}
                                  >
                                    Reiniciar trial 14d
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleExtend(store, 7)}
                                    disabled={mutation.isPending}
                                  >
                                    Extender 7 días
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleExtend(store, 30)}
                                    disabled={mutation.isPending}
                                  >
                                    Extender 30 días
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator className="bg-slate-800" />
                                  <DropdownMenuItem
                                    onClick={() => setUserSheetStore(store)}
                                    disabled={mutation.isPending}
                                  >
                                    Gestionar usuarios
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator className="bg-slate-800" />
                                  <DropdownMenuItem
                                    onClick={() =>
                                      mutation.mutate({
                                        storeId: store.id,
                                        data: { status: 'active' },
                                      })
                                    }
                                    className="text-emerald-300"
                                    disabled={mutation.isPending}
                                  >
                                    <ShieldCheck className="h-4 w-4 mr-2" />
                                    Activar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      mutation.mutate({
                                        storeId: store.id,
                                        data: { status: 'suspended', notes: 'Suspendida manualmente' },
                                      })
                                    }
                                    className="text-rose-300"
                                    disabled={mutation.isPending}
                                  >
                                    <ShieldOff className="h-4 w-4 mr-2" />
                                    Suspender
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator className="bg-slate-800" />
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setPlanSheetStore(store)
                                      setNewPlan(store.license_plan || 'freemium')
                                      setPlanExpiryDays('')
                                    }}
                                    disabled={mutation.isPending}
                                  >
                                    <CreditCard className="h-4 w-4 mr-2" />
                                    Cambiar plan
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      mutation.mutate({
                                        storeId: store.id,
                                        data: { notes: 'Marcada para seguimiento' },
                                      })
                                    }
                                    disabled={mutation.isPending}
                                  >
                                    Añadir nota
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator className="bg-slate-800" />
                                  <DropdownMenuItem
                                    onClick={() => setDeleteConfirmStore(store)}
                                    className="text-rose-400 focus:text-rose-300 focus:bg-rose-950/50"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Eliminar tienda
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      <Sheet open={!!userSheetStore} onOpenChange={(open) => !open && setUserSheetStore(null)}>
        <SheetContent className="bg-slate-900 text-slate-100 border-slate-800 w-[420px]">
          <SheetHeader>
            <SheetTitle className="text-white">Usuarios de {userSheetStore?.name || ''}</SheetTitle>
            <SheetDescription className="text-slate-400">
              Crea, revisa o elimina usuarios (owner/cashier) de la tienda.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 space-y-4">
            {isMembersLoading ? (
              <p className="text-sm text-slate-400">Cargando usuarios...</p>
            ) : (
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Usuarios</p>
                <ScrollArea className="h-48 rounded-md border border-slate-800">
                  <div className="p-3 space-y-2">
                    {(members ?? []).map((m) => (
                      <div
                        key={m.user_id}
                        className="flex items-center justify-between rounded border border-slate-800 px-3 py-2"
                      >
                        <div>
                          <div className="text-sm font-semibold text-white">{m.full_name || m.user_id}</div>
                          <div className="text-[11px] text-slate-400">{m.user_id}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="border-slate-700 text-slate-200">
                            {m.role}
                          </Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-rose-300 hover:text-rose-200"
                            onClick={() => deleteUserMutation.mutate(m.user_id)}
                            disabled={deleteUserMutation.isPending}
                          >
                            Eliminar
                          </Button>
                        </div>
                      </div>
                    ))}
                    {(members ?? []).length === 0 && (
                      <div className="text-sm text-slate-400 text-center py-6">Sin usuarios aún.</div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            )}

            <Separator className="bg-slate-800" />

            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Crear usuario</p>
              <div className="space-y-2">
                <Label className="text-slate-200">Nombre</Label>
                <Input
                  value={newUser.full_name}
                  onChange={(e) => setNewUser((prev) => ({ ...prev, full_name: e.target.value }))}
                  className="bg-slate-950 border-slate-800 text-slate-100"
                  placeholder="Nombre completo"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-200">Rol</Label>
                <Select
                  value={newUser.role}
                  onValueChange={(val) => setNewUser((prev) => ({ ...prev, role: val as 'owner' | 'cashier' }))}
                >
                  <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-100">
                    <SelectValue placeholder="Rol" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-100">
                    <SelectItem value="owner">Owner</SelectItem>
                    <SelectItem value="cashier">Cashier</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-200">PIN / Contraseña</Label>
                <Input
                  type="password"
                  value={newUser.pin}
                  onChange={(e) => setNewUser((prev) => ({ ...prev, pin: e.target.value }))}
                  className="bg-slate-950 border-slate-800 text-slate-100"
                  placeholder={
                    newUser.role === 'cashier'
                      ? 'PIN para cajero (4-6 dígitos)'
                      : 'PIN para owner (4-6 dígitos, opcional pero recomendado)'
                  }
                />
                <p className="text-xs text-slate-500">
                  {newUser.role === 'cashier'
                    ? 'Requerido para cajeros.'
                    : 'Si lo defines, el owner podrá ingresar con este PIN.'}
                </p>
              </div>
              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => createUserMutation.mutate()}
                disabled={
                  !newUser.full_name ||
                  createUserMutation.isPending ||
                  !userSheetStore ||
                  (newUser.role === 'cashier' && !newUser.pin)
                }
              >
                Crear usuario
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Sheet para cambiar plan */}
      <Sheet open={!!planSheetStore} onOpenChange={(open) => !open && setPlanSheetStore(null)}>
        <SheetContent className="bg-slate-900 text-slate-100 border-slate-800 w-[420px]">
          <SheetHeader>
            <SheetTitle className="text-white">Cambiar Plan - {planSheetStore?.name || ''}</SheetTitle>
            <SheetDescription className="text-slate-400">
              Actualiza el plan de suscripción de esta tienda.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-slate-200">Plan Actual</Label>
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
                <Badge variant="outline" className="border-slate-700 text-slate-200">
                  {planSheetStore?.license_plan || 'Sin plan'}
                </Badge>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-200">Nuevo Plan</Label>
              <Select value={newPlan} onValueChange={setNewPlan}>
                <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-100">
                  <SelectValue placeholder="Selecciona un plan" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-slate-100">
                  <SelectItem value="freemium">🆓 Freemium - GRATIS</SelectItem>
                  <SelectItem value="basico">💼 Básico - $29/mes</SelectItem>
                  <SelectItem value="profesional">🚀 Profesional - $79/mes</SelectItem>
                  <SelectItem value="empresarial">🏢 Empresarial - $199/mes</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">
                {newPlan === 'freemium' && 'Gratis para siempre - Ideal para empezar'}
                {newPlan === 'basico' && '$29/mes - Perfecto para pequeños negocios'}
                {newPlan === 'profesional' && '$79/mes - Para negocios en crecimiento'}
                {newPlan === 'empresarial' && '$199/mes - Solución completa empresarial'}
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-200">Fecha de Expiración (opcional)</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Días desde hoy"
                  value={planExpiryDays}
                  onChange={(e) => setPlanExpiryDays(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-slate-100"
                />
                {planExpiryDays && (
                  <div className="text-xs text-slate-400 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(
                      new Date(Date.now() + Number(planExpiryDays) * 86400000).toISOString()
                    )}
                  </div>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Deja vacío para mantener la fecha actual. Ingresa días para extender desde hoy.
              </p>
            </div>

            <Separator className="bg-slate-800" />

            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => {
                if (!planSheetStore) return
                const expiresAt = planExpiryDays
                  ? new Date(Date.now() + Number(planExpiryDays) * 86400000).toISOString()
                  : undefined

                mutation.mutate({
                  storeId: planSheetStore.id,
                  data: {
                    plan: newPlan,
                    expires_at: expiresAt,
                    status: 'active',
                  },
                })
                setPlanSheetStore(null)
                setNewPlan('')
                setPlanExpiryDays('')
              }}
              disabled={mutation.isPending || !newPlan || newPlan === planSheetStore?.license_plan}
            >
              {mutation.isPending ? 'Actualizando...' : 'Actualizar Plan'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Modal de confirmación para eliminar tienda */}
      <Sheet open={!!deleteConfirmStore} onOpenChange={(open) => {
        if (!open) {
          setDeleteConfirmStore(null)
          setDeleteConfirmText('')
        }
      }}>
        <SheetContent className="bg-slate-900 text-slate-100 border-slate-800 w-[420px]">
          <SheetHeader>
            <SheetTitle className="text-white flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-rose-400" />
              Eliminar Tienda
            </SheetTitle>
            <SheetDescription className="text-slate-400">
              Esta acción es <span className="text-rose-400 font-semibold">IRREVERSIBLE</span>.
              Se eliminarán todos los datos asociados a la tienda.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            <div className="p-4 bg-rose-950/30 border border-rose-900/50 rounded-lg space-y-2">
              <p className="text-sm text-slate-200">
                <strong>Tienda:</strong> {deleteConfirmStore?.name}
              </p>
              <p className="text-xs text-slate-400">
                <strong>ID:</strong> {deleteConfirmStore?.id}
              </p>
              <p className="text-xs text-slate-400">
                <strong>Usuarios:</strong> {deleteConfirmStore?.member_count || 0}
              </p>
              <p className="text-xs text-slate-400">
                <strong>Plan:</strong> {deleteConfirmStore?.license_plan || 'Sin plan'}
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-200">
                Para confirmar, escribe el nombre de la tienda:
              </Label>
              <Input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={deleteConfirmStore?.name || ''}
                className="bg-slate-950 border-slate-800 text-slate-100"
              />
              <p className="text-xs text-slate-500">
                Escribe exactamente: <code className="text-rose-300">{deleteConfirmStore?.name}</code>
              </p>
            </div>

            <Separator className="bg-slate-800" />

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 border-slate-700 text-slate-200 hover:bg-slate-800"
                onClick={() => {
                  setDeleteConfirmStore(null)
                  setDeleteConfirmText('')
                }}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white"
                disabled={
                  deleteConfirmText !== deleteConfirmStore?.name ||
                  deleteStoreMutation.isPending
                }
                onClick={() => {
                  if (deleteConfirmStore) {
                    deleteStoreMutation.mutate(deleteConfirmStore.id)
                  }
                }}
              >
                {deleteStoreMutation.isPending ? (
                  'Eliminando...'
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Eliminar Permanentemente
                  </>
                )}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
