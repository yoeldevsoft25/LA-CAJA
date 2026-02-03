import { memo, useEffect, useMemo, useCallback } from 'react'
import { AlertTriangle, Coins, HandCoins } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@la-caja/ui-core'
import { Label } from '@/components/ui/label'
import { calculateChangeInBs, formatCurrency } from '@/utils/checkout-utils'
import { calculateRoundedChangeWithMode, roundToNearestDenomination, roundToNearestDenominationUp, CashChangeRoundingMode } from '@/utils/vzla-denominations'
import { cn } from '@la-caja/ui-core'

interface CashPaymentSectionProps {
    mode: 'USD' | 'BS'
    totalAmount: number
    exchangeRate: number
    receivedAmount: number
    onAmountChange: (amount: number) => void
    giveChangeInBs?: boolean
    onGiveChangeInBsChange?: (value: boolean) => void
    roundingMode?: CashChangeRoundingMode
    onRoundingModeChange?: (mode: CashChangeRoundingMode) => void
    roundingConsent?: boolean
    onRoundingConsentChange?: (value: boolean) => void
    className?: string
}

const CashPaymentSection = memo(function CashPaymentSection({
    mode,
    totalAmount,
    exchangeRate,
    receivedAmount,
    onAmountChange,
    giveChangeInBs = false,
    onGiveChangeInBsChange,
    roundingMode = 'CUSTOMER',
    onRoundingModeChange,
    roundingConsent = false,
    onRoundingConsentChange,
    className,
}: CashPaymentSectionProps) {
    useEffect(() => {
        if (receivedAmount === 0) {
            onAmountChange(totalAmount)
        }
    }, [totalAmount, receivedAmount, onAmountChange])

    const { change, changeBs, roundedChangeBs, changeBreakdownFormatted, excessBs, exactChangeBs } = useMemo(() => {
        const changeAmount = Math.max(0, receivedAmount - totalAmount)

        if (mode === 'USD' && giveChangeInBs) {
            const changeUsd = Math.max(0, receivedAmount - totalAmount)
            const rounded = changeUsd > 0
                ? calculateRoundedChangeWithMode(changeUsd, exchangeRate, roundingMode)
                : { changeBs: 0, breakdownFormatted: '', exactChangeBs: 0, adjustmentBs: 0 }

            return {
                change: changeAmount,
                changeBs: calculateChangeInBs(receivedAmount, totalAmount, exchangeRate),
                roundedChangeBs: rounded.changeBs,
                changeBreakdownFormatted: rounded.breakdownFormatted,
                excessBs: Math.abs(rounded.adjustmentBs),
                exactChangeBs: rounded.exactChangeBs,
            }
        }

        if (mode === 'BS') {
            const changeBsRaw = changeAmount
            let rounded = changeBsRaw
            if (roundingMode === 'MERCHANT') {
                rounded = changeBsRaw > 0 ? roundToNearestDenomination(changeBsRaw) : 0
            } else if (roundingMode === 'CUSTOMER') {
                rounded = changeBsRaw > 0 ? roundToNearestDenominationUp(changeBsRaw) : 0
            }
            const adjustment = Math.round((changeBsRaw - rounded) * 100) / 100

            return {
                change: changeAmount,
                changeBs: changeBsRaw,
                roundedChangeBs: rounded,
                changeBreakdownFormatted: '',
                excessBs: Math.abs(adjustment),
                exactChangeBs: changeBsRaw,
            }
        }

        return {
            change: changeAmount,
            changeBs: changeAmount,
            roundedChangeBs: changeAmount,
            changeBreakdownFormatted: '',
            excessBs: 0,
            exactChangeBs: changeAmount,
        }
    }, [receivedAmount, totalAmount, mode, giveChangeInBs, exchangeRate, roundingMode])

    const handleAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        onAmountChange(parseFloat(e.target.value) || 0)
    }, [onAmountChange])

    const handleCheckboxChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        onGiveChangeInBsChange?.(e.target.checked)
    }, [onGiveChangeInBsChange])

    const handleRoundingModeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        onRoundingModeChange?.(e.target.value as CashChangeRoundingMode)
    }, [onRoundingModeChange])

    const handleRoundingConsentChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        onRoundingConsentChange?.(e.target.checked)
    }, [onRoundingConsentChange])

    const amountId = `received-amount-${mode.toLowerCase()}`
    const giveChangeId = `give-change-bs-${mode.toLowerCase()}`
    const roundingModeId = `rounding-mode-${mode.toLowerCase()}`
    const roundingConsentId = `rounding-consent-${mode.toLowerCase()}`

    return (
        <Card className={cn('border-slate-200 bg-white shadow-sm', className)}>
            <CardContent className="p-4 space-y-4">
                <div className="flex items-start justify-between gap-2">
                    <div>
                        <p className="text-sm font-bold text-slate-900">Cobro en efectivo ({mode})</p>
                        <p className="text-xs text-slate-500">Total esperado: {formatCurrency(totalAmount, mode)}</p>
                    </div>
                    <Coins className="h-5 w-5 text-primary" />
                </div>

                <div className="space-y-2">
                    <Label htmlFor={amountId}>Monto recibido</Label>
                    <Input
                        id={amountId}
                        type="number"
                        step="0.01"
                        min="0"
                        value={receivedAmount || ''}
                        onChange={handleAmountChange}
                        placeholder={`0.00 ${mode}`}
                        className="h-11 text-lg font-semibold tabular-nums"
                    />
                </div>

                {mode === 'USD' && onGiveChangeInBsChange && (
                    <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <input
                            type="checkbox"
                            id={giveChangeId}
                            checked={giveChangeInBs}
                            onChange={handleCheckboxChange}
                            className="h-4 w-4 rounded border-slate-300"
                        />
                        <span className="text-sm font-medium text-slate-700">Dar cambio en Bs</span>
                    </label>
                )}

                {(mode === 'BS' || (mode === 'USD' && giveChangeInBs)) && change > 0 && (
                    <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <Label htmlFor={roundingModeId}>Politica de redondeo</Label>
                        <select
                            id={roundingModeId}
                            value={roundingMode}
                            onChange={handleRoundingModeChange}
                            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        >
                            <option value="EXACT">Vuelto exacto</option>
                            <option value="CUSTOMER">A favor del cliente</option>
                            <option value="MERCHANT">A favor de la tienda</option>
                        </select>

                        {roundingMode === 'MERCHANT' && (
                            <label className="flex items-center gap-2 text-sm">
                                <input
                                    type="checkbox"
                                    id={roundingConsentId}
                                    checked={roundingConsent}
                                    onChange={handleRoundingConsentChange}
                                    className="h-4 w-4 rounded border-slate-300"
                                />
                                Cliente acepta el redondeo
                            </label>
                        )}
                    </div>
                )}

                {change > 0 && (
                    <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-3 space-y-2" aria-live="polite">
                        <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-slate-700">Cambio</span>
                            <span className="text-lg font-bold text-slate-900 tabular-nums">{formatCurrency(change, mode)}</span>
                        </div>

                        {mode === 'USD' && giveChangeInBs && (
                            <div className="text-sm text-slate-600 space-y-1">
                                <div>Equivalente exacto: <span className="font-medium text-slate-900">{formatCurrency(exactChangeBs, 'BS')}</span></div>
                                <div>Cambio en Bs: <span className="font-medium text-slate-900">{formatCurrency(roundedChangeBs, 'BS')}</span></div>
                                {changeBreakdownFormatted && <div className="text-xs">Denominaciones: {changeBreakdownFormatted}</div>}
                            </div>
                        )}

                        {mode === 'BS' && (
                            <div className="text-sm text-slate-600">
                                Cambio en Bs: <span className="font-medium text-slate-900">{formatCurrency(roundedChangeBs, 'BS')}</span>
                            </div>
                        )}

                        {excessBs > 0 && roundingMode !== 'EXACT' && (
                            <div className={cn(
                                'rounded-md border px-2 py-1 text-xs',
                                roundingMode === 'MERCHANT'
                                    ? 'border-amber-300 bg-amber-50 text-amber-800'
                                    : 'border-sky-300 bg-sky-50 text-sky-800',
                            )}>
                                {roundingMode === 'MERCHANT'
                                    ? `Saldo a favor de la tienda: ${formatCurrency(excessBs, 'BS')}.`
                                    : `Saldo a favor del cliente: ${formatCurrency(excessBs, 'BS')}.`}
                            </div>
                        )}

                        {roundedChangeBs === 0 && changeBs > 0 && (
                            <div className="text-xs text-slate-500">
                                No se dara cambio (monto menor a la denominacion comun)
                            </div>
                        )}
                    </div>
                )}

                {receivedAmount < totalAmount && receivedAmount > 0 && (
                    <div className="flex items-center gap-2 rounded-lg border border-destructive/25 bg-destructive/5 p-2 text-sm text-destructive" role="alert">
                        <AlertTriangle className="h-4 w-4" />
                        Faltan {formatCurrency(totalAmount - receivedAmount, mode)} para completar el pago
                    </div>
                )}

                {receivedAmount >= totalAmount && (
                    <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-700">
                        <HandCoins className="h-4 w-4" />
                        Monto suficiente para completar la venta
                    </div>
                )}
            </CardContent>
        </Card>
    )
})

export default CashPaymentSection
