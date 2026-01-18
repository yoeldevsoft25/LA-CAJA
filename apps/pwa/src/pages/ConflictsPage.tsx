import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle, XCircle, Clock, Info, GitCompare } from 'lucide-react';
import { db, LocalConflict } from '@/db/database';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function ConflictsPage() {
  const queryClient = useQueryClient();

  // Query para obtener conflictos pendientes
  const { data: conflicts = [], isLoading } = useQuery({
    queryKey: ['conflicts', 'pending'],
    queryFn: async () => {
      return await db.conflicts
        .where('status')
        .equals('pending')
        .toArray();
    },
    refetchInterval: 5000, // Refrescar cada 5 segundos
  });

  // Mutation para resolver conflicto
  const resolveConflictMutation = useMutation({
    mutationFn: async ({
      conflictId,
      resolution,
    }: {
      conflictId: string;
      resolution: 'keep_mine' | 'take_theirs';
    }) => {
      // Enviar resolución al servidor
      await api.post('/sync/resolve-conflict', {
        conflict_id: conflictId,
        resolution,
      });

      // Actualizar localmente
      await db.conflicts.update(conflictId, {
        status: 'resolved',
        resolution,
        resolved_at: Date.now(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conflicts'] });
    },
  });

  const handleResolve = (conflict: LocalConflict, resolution: 'keep_mine' | 'take_theirs') => {
    resolveConflictMutation.mutate({
      conflictId: conflict.id,
      resolution,
    });
  };

  if (isLoading) {
    return (
      <div className="h-full max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <Clock className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 bg-yellow-50 rounded-lg border border-yellow-200">
            <GitCompare className="h-8 w-8 text-yellow-600" />
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-foreground">Conflictos de Sincronización</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Resuelve conflictos cuando múltiples dispositivos modifican los mismos datos
            </p>
          </div>
          {conflicts.length > 0 && (
            <Badge variant="destructive" className="px-3 py-1 text-base">
              {conflicts.length} {conflicts.length === 1 ? 'pendiente' : 'pendientes'}
            </Badge>
          )}
        </div>
        
        {conflicts.length > 0 && (
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <Info className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-amber-900">
              <p className="font-medium mb-1">¿Qué son los conflictos?</p>
              <p className="text-amber-700">
                Ocurren cuando dos dispositivos modifican los mismos datos al mismo tiempo. 
                Elige cuál versión mantener o usa la del servidor como referencia.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Lista de conflictos */}
      {conflicts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Todo sincronizado correctamente</h3>
            <p className="text-muted-foreground text-center">
              No hay conflictos pendientes de resolución.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {conflicts.map((conflict) => (
            <ConflictCard
              key={conflict.id}
              conflict={conflict}
              onResolve={handleResolve}
              isResolving={resolveConflictMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ConflictCard({
  conflict,
  onResolve,
  isResolving,
}: {
  conflict: LocalConflict;
  onResolve: (conflict: LocalConflict, resolution: 'keep_mine' | 'take_theirs') => void;
  isResolving: boolean;
}) {
  const timeAgo = getTimeAgo(conflict.created_at);
  const isCritical = conflict.requires_manual_review;

  return (
    <Card className={`border-l-4 ${isCritical ? 'border-l-red-500' : 'border-l-yellow-500'} shadow-sm hover:shadow-md transition-shadow`}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className={`h-5 w-5 ${isCritical ? 'text-red-500' : 'text-yellow-500'} flex-shrink-0`} />
              <CardTitle className="text-lg">
                {isCritical ? 'Conflicto Crítico' : 'Conflicto Detectado'}
              </CardTitle>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                {conflict.event_id.slice(0, 8)}...
              </code>
              <Badge variant={isCritical ? 'destructive' : 'secondary'} className="text-xs">
                {isCritical ? 'Revisión manual requerida' : 'Puede resolverse automáticamente'}
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Razón del conflicto */}
        <div className="bg-muted/50 p-3 rounded-lg">
          <h4 className="text-sm font-semibold mb-1.5 flex items-center gap-1.5">
            <Info className="h-4 w-4" />
            Razón del conflicto:
          </h4>
          <p className="text-sm text-muted-foreground leading-relaxed">{conflict.reason}</p>
        </div>

        {/* Eventos en conflicto */}
        {conflict.conflicting_with.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-2">Eventos relacionados:</h4>
            <div className="flex flex-wrap gap-2">
              {conflict.conflicting_with.map((eventId) => (
                <code
                  key={eventId}
                  className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded font-mono border border-slate-200 dark:border-slate-700"
                >
                  {eventId.slice(0, 12)}...
                </code>
              ))}
            </div>
          </div>
        )}

        {/* Metadata */}
        <div className="flex items-center justify-between pt-2 border-t text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            Detectado hace {timeAgo}
          </span>
        </div>

        {/* Acciones */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
          <Button
            onClick={() => onResolve(conflict, 'keep_mine')}
            disabled={isResolving}
            variant="default"
            size="sm"
            className="flex-1"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Mantener mi versión
          </Button>
          <Button
            onClick={() => onResolve(conflict, 'take_theirs')}
            disabled={isResolving}
            variant="outline"
            size="sm"
            className="flex-1"
          >
            <XCircle className="h-4 w-4 mr-2" />
            Usar versión del servidor
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function getTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}
