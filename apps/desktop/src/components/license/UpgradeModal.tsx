import React from 'react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@la-caja/ui-core'
import { Check, Sparkles } from 'lucide-react'

interface UpgradeModalProps {
    isOpen: boolean
    onClose: () => void
    featureName?: string
}

export const UpgradeModal: React.FC<UpgradeModalProps> = ({
    isOpen,
    onClose,
    featureName
}) => {
    const plans = [
        {
            name: 'Negocio',
            price: '$19.99',
            features: ['Contabilidad Básica', '5 Usuarios', 'Productos Ilimitados', 'Soporte 24/7'],
            recommended: true,
        },
        {
            name: 'Empresario',
            price: '$49.99',
            features: ['Todo en Negocio', 'Inteligencia Artificial', 'Facturación Fiscal', 'Multi-tienda'],
            recommended: false,
        }
    ]

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <div className="mx-auto bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                        <Sparkles className="w-8 h-8 text-primary" />
                    </div>
                    <DialogTitle className="text-3xl text-center">Multiplica tu Crecimiento</DialogTitle>
                    <DialogDescription className="text-center text-lg mt-2">
                        {featureName
                            ? `La función "${featureName}" requiere un plan avanzado.`
                            : 'Desbloquea herramientas diseñadas para escalar tu negocio.'}
                    </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-6">
                    {plans.map((plan) => (
                        <div
                            key={plan.name}
                            className={`relative border rounded-2xl p-6 flex flex-col ${plan.recommended ? 'border-primary ring-1 ring-primary' : 'border-border'
                                }`}
                        >
                            {plan.recommended && (
                                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full uppercase">
                                    Recomendado
                                </span>
                            )}

                            <div className="mb-6">
                                <h3 className="text-xl font-bold">{plan.name}</h3>
                                <div className="flex items-baseline mt-2">
                                    <span className="text-3xl font-extrabold">{plan.price}</span>
                                    <span className="text-muted-foreground ml-1">/mes</span>
                                </div>
                            </div>

                            <ul className="space-y-3 flex-grow mb-8">
                                {plan.features.map((feat) => (
                                    <li key={feat} className="flex items-center gap-2 text-sm">
                                        <Check className="w-4 h-4 text-green-500 shrink-0" />
                                        <span>{feat}</span>
                                    </li>
                                ))}
                            </ul>

                            <Button variant={plan.recommended ? 'default' : 'outline'} className="w-full">
                                Empezar Ahora
                            </Button>
                        </div>
                    ))}
                </div>

                <DialogFooter className="sm:justify-center text-sm text-muted-foreground">
                    ¿Tienes dudas? <Button variant="link" className="p-0 h-auto text-sm">Habla con un asesor</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
