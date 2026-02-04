import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle, Clock, Info, GitCompare, Eye } from 'lucide-react';
import { db, LocalConflict } from '@/db/database';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import toast from '@/lib/toast';
import { conflictResolutionService } from '@/services/conflict-resolution.service';
import { ConflictDetailDialog } from '@/components/conflicts/ConflictDetailDialog';

export default function ConflictsPage() {
  const queryClient = useQueryClient();
  const [selectedConflictId, setSelectedConflictId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Query para obtener conflictos pendientes
  const { data: conflicts = [], isLoading } = useQuery({
    queryKey: ['conflicts', 'pending'],
    queryFn: async () => {
      return await db.conflicts
        .where('status')
        .equals('pending')
        .toArray();
    },
    refetchInterval: 5000,
  });

  // Query para obtener detalles del conflicto seleccionado
  const { data: conflictDetail } = useQuery({
    queryKey: ['conflict-detail', selectedConflictId],
    queryFn: () => selectedConflictId ? conflictResolutionService.getConflictDetail(selectedConflictId) : null,
    enabled: !!selectedConflictId,
  });

  // Mutation para resolver conflicto
  const resolveMutation = useMutation({
    mutationFn: async ({
      conflict,
      strategy,
    }: {
      conflict: LocalConflict;
      strategy: 'keep_mine' | 'take_theirs' | 'merge';
    }) => {
      // ✅ SPRINT 6.1B: Telemetría
      recordTelemetry('resolution_selected', { conflict_id: conflict.id, strategy });

      const result = await conflictResolutionService.resolveConflict(conflict, strategy);

      if (result.resolved) {
        recordTelemetry('resolution_success', { conflict_id: conflict.id });
      } else {
        recordTelemetry('resolution_failure', { conflict_id: conflict.id, error: result.message });
        throw new Error(result.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conflicts'] });
      setIsDetailOpen(false);
      toast.success('Conflicto resuelto exitosamente');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Error al resolver el conflicto');
    }
  });

  const recordTelemetry = (event: string, metadata: any) => {
    console.info(`[UX Telemetry] ${event}`, metadata);
  };

  const handleOpenDetail = (conflictId: string) => {
    recordTelemetry('conflict_opened', { conflict_id: conflictId });
    setSelectedConflictId(conflictId);
    setIsDetailOpen(true);
  };

  if (isLoading) {
    return (
      <div className="h-full max-w-7xl mx-auto p-6 flex items-center justify-center">
        <Clock className="h-12 w-12 animate-spin text-primary opacity-20" />
      </div>
    );
  }

  return (
    <div className="h-full max-w-5xl mx-auto p-4 sm:p-8">
      {/* Header */}
      <div className="mb-10 text-center sm:text-left">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex p-3 bg-amber-50 rounded-2xl border border-amber-200 mb-6"
        >
          <GitCompare className="h-8 w-8 text-amber-600" />
        </motion.div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
          Gestión de Conflictos
        </h1>
        <p className="text-muted-foreground mt-3 max-w-2xl text-lg">
          Resuelve discrepancias operativas entre tus dispositivos y el servidor central con total transparencia.
        </p>
      </div>

      <AnimatePresence mode="wait">
        {conflicts.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <Card className="border-dashed border-2 bg-muted/30">
              <CardContent className="flex flex-col items-center justify-center py-20">
                <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mb-6">
                  <CheckCircle className="h-10 w-10 text-success" />
                </div>
                <h3 className="text-2xl font-bold mb-2">¡Sincronización Perfecta!</h3>
                <p className="text-muted-foreground text-center text-lg">
                  No se detectaron conflictos en tus datos locales.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <div className="grid gap-6">
            {conflicts.map((conflict, index) => (
              <motion.div
                key={conflict.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <ConflictCard
                  conflict={conflict}
                  onOpenDetail={() => handleOpenDetail(conflict.id)}
                  isResolving={resolveMutation.isPending && selectedConflictId === conflict.id}
                />
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>

      <ConflictDetailDialog
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        conflict={conflicts.find(c => c.id === selectedConflictId) || null}
        detail={conflictDetail}
        onResolve={(strategy) => {
          const conflict = conflicts.find(c => c.id === selectedConflictId);
          if (conflict) {
            resolveMutation.mutate({ conflict, strategy });
          }
        }}
        isResolving={resolveMutation.isPending}
      />
    </div>
  );
}

function ConflictCard({
  conflict,
  onOpenDetail,
  isResolving,
}: {
  conflict: LocalConflict;
  onOpenDetail: () => void;
  isResolving: boolean;
}) {
  return (
    <Card className="overflow-hidden border-2 border-amber-100 shadow-xl shadow-amber-900/5 hover:border-amber-200 transition-all">
      <CardHeader className="bg-amber-50/50 border-b border-amber-100 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-lg shadow-sm">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <CardTitle className="text-base font-bold">
                Evento: {conflict.event_id.slice(0, 12)}...
              </CardTitle>
              <p className="text-xs text-amber-700 font-medium">Detectado el {new Date(conflict.created_at).toLocaleString()}</p>
            </div>
          </div>
          <Badge variant="outline" className="bg-white text-amber-700 border-amber-200">
            {conflict.requires_manual_review ? 'Revisión Crítica' : 'Conflicto Estándar'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-4">
        <div className="p-4 bg-muted rounded-xl text-sm border border-border/50">
          <div className="flex items-center gap-2 mb-2 font-bold text-muted-foreground uppercase tracking-widest text-[10px]">
            <Info className="h-4 w-4" /> Razón del Conflicto
          </div>
          <p className="text-foreground font-medium">{conflict.reason}</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={onOpenDetail}
            disabled={isResolving}
            className="flex-1 bg-amber-600 hover:bg-amber-700 shadow-lg shadow-amber-200 h-11"
          >
            <Eye className="w-4 h-4 mr-2" /> Comparar y Resolver
          </Button>
          <div className="flex items-center gap-2 text-xs text-muted-foreground px-2 italic">
            <Clock className="w-3 h-3" /> Pendiente desde hace {Math.round((Date.now() - conflict.created_at) / 60000)} min
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
