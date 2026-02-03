import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@la-caja/ui-core';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { GitCompare, Smartphone, Server, Check, X } from 'lucide-react';
import { LocalConflict } from '@/db/database';

interface ConflictDetailDialogProps {
    isOpen: boolean;
    onClose: () => void;
    conflict: LocalConflict | null;
    detail: any; // From getConflictDetail
    onResolve: (strategy: 'keep_mine' | 'take_theirs' | 'merge') => void;
    isResolving: boolean;
}

export function ConflictDetailDialog({
    isOpen,
    onClose,
    conflict,
    detail,
    onResolve,
    isResolving,
}: ConflictDetailDialogProps) {
    if (!conflict || !detail) return null;

    const localData = detail.localEvent?.payload || {};
    const serverData = detail.serverState || {};

    // Extract unique keys for comparison
    const allKeys = Array.from(new Set([...Object.keys(localData), ...Object.keys(serverData)]))
        .filter(k => !k.startsWith('_') && k !== 'event_id' && k !== 'created_at');

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl p-0 overflow-hidden border-none shadow-2xl">
                <DialogHeader className="p-6 bg-amber-50 border-b border-amber-100">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white rounded-lg shadow-sm">
                            <GitCompare className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-bold text-amber-900">
                                Comparación de Datos
                            </DialogTitle>
                            <DialogDescription className="text-amber-800/70 font-medium">
                                Resuelve la discrepancia en {conflict.reason}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="p-0">
                    <div className="grid grid-cols-2 bg-muted/30 border-b border-border">
                        <div className="p-4 flex items-center gap-2 border-r border-border">
                            <Smartphone className="h-4 w-4 text-primary" />
                            <span className="text-xs font-bold uppercase tracking-wider text-primary">Mi Versión Local</span>
                        </div>
                        <div className="p-4 flex items-center gap-2">
                            <Server className="h-4 w-4 text-muted-foreground" />
                            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Versión del Servidor</span>
                        </div>
                    </div>

                    <ScrollArea className="max-h-[50vh]">
                        <div className="p-2 space-y-1">
                            {allKeys.map((key) => {
                                const localValue = localData[key];
                                const serverValue = serverData[key];
                                const isDifferent = JSON.stringify(localValue) !== JSON.stringify(serverValue);

                                return (
                                    <div
                                        key={key}
                                        className={`grid grid-cols-2 rounded-lg transition-colors ${isDifferent ? 'bg-amber-50/50' : 'hover:bg-muted/50'}`}
                                    >
                                        <div className={`p-3 text-sm border-r border-border/50 ${isDifferent ? 'font-semibold text-amber-900' : 'text-foreground/70'}`}>
                                            <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">{key}</div>
                                            {renderValue(localValue)}
                                        </div>
                                        <div className={`p-3 text-sm ${isDifferent ? 'font-semibold text-amber-900' : 'text-foreground/70'}`}>
                                            <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">{key}</div>
                                            {renderValue(serverValue)}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </ScrollArea>
                </div>

                <DialogFooter className="p-6 bg-muted/20 border-t border-border gap-3 sm:gap-0">
                    <div className="flex-1 hidden sm:block">
                        <Badge variant="outline" className="text-amber-700 bg-amber-50 border-amber-200">
                            Estrategia sugerida: {conflict.requires_manual_review ? 'Revisión Manual' : 'Server Wins'}
                        </Badge>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <Button
                            variant="outline"
                            onClick={() => onResolve('take_theirs')}
                            disabled={isResolving}
                            className="flex-1 sm:flex-none"
                        >
                            <X className="w-4 h-4 mr-2" /> Usar Servidor
                        </Button>
                        <Button
                            onClick={() => onResolve('keep_mine')}
                            disabled={isResolving}
                            className="flex-1 sm:flex-none shadow-lg shadow-primary/20"
                        >
                            <Check className="w-4 h-4 mr-2" /> Mantener Mío
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function renderValue(value: any) {
    if (value === null) return <span className="text-muted-foreground italic text-xs">null</span>;
    if (typeof value === 'object') return <pre className="text-[10px] overflow-hidden">{JSON.stringify(value, null, 2)}</pre>;
    if (typeof value === 'boolean') return <Badge variant={value ? 'default' : 'destructive'} className="scale-75 origin-left">{value ? 'TRUE' : 'FALSE'}</Badge>;
    return <span>{String(value)}</span>;
}
