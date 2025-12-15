import { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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
import { toast } from 'react-hot-toast'
import { addDays, format, formatDistanceToNowStrict, isAfter, parseISO } from 'date-fns'
import { MoreHorizontal, ShieldCheck, ShieldOff, Sparkles } from 'lucide-react'

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
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [planFilter, setPlanFilter] = useState<string>('all')
  const [expiringIn, setExpiringIn] = useState<string>('none')
  const [adminKey, setAdminKey] = useState<string>(() => adminService.getKey() || '')
  const [userSheetStore, setUserSheetStore] = useState<AdminStore | null>(null)
  const [newUser, setNewUser] = useState<{ full_name: string; role: 'owner' | 'cashier'; pin: string }>({
    full_name: '',
    role: 'cashier',
    pin: '',
  })
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
        pin: newUser.role === 'cashier' ? newUser.pin : undefined,
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
                  <SelectItem value="starter">Starter</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
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
            <div className="text-xs text-slate-400">
              Sincronizado{' '}
              {stores ? (
                <span className="text-emerald-300">OK</span>
              ) : (
                <span className="text-slate-400">pendiente</span>
              )}
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
                            <Badge variant="outline" className="border-slate-700 text-slate-200">
                              {store.license_plan || 'Sin plan'}
                            </Badge>
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
            <SheetTitle>Usuarios de {userSheetStore?.name || ''}</SheetTitle>
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
              {newUser.role === 'cashier' && (
                <div className="space-y-2">
                  <Label className="text-slate-200">PIN</Label>
                  <Input
                    type="password"
                    value={newUser.pin}
                    onChange={(e) => setNewUser((prev) => ({ ...prev, pin: e.target.value }))}
                    className="bg-slate-950 border-slate-800 text-slate-100"
                    placeholder="PIN para cajero"
                  />
                </div>
              )}
              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => createUserMutation.mutate()}
                disabled={!newUser.full_name || createUserMutation.isPending || !userSheetStore}
              >
                Crear usuario
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
