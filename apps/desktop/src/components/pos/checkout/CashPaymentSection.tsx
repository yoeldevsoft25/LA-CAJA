import { memo, useEffect, useMemo, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@la-caja/ui-core'
import { Label } from '@/components/ui/label'
import { calculateChangeInBs, formatCurrency } from '@/utils/checkout-utils'
import { calculateRoundedChangeWithMode, roundToNearestDenomination, roundToNearestDenominationUp, CashChangeRoundingMode } from '@/utils/vzla-denominations'

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
    // Auto-fill con el total
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

    return (
        <Card className={className}>
            <CardContent className="p-4 space-y-4">
                <div>
                    <Label htmlFor="received-amount">
                        Monto Recibido ({mode === 'USD' ? 'USD' : 'Bs'})
                    </Label>
                    <Input
                        id="received-amount"
                        type="number"
                        step="0.01"
                        min="0"
                        value={receivedAmount || ''}
                        onChange={handleAmountChange}
                        placeholder={`0.00 ${mode === 'USD' ? 'USD' : 'Bs'}`}
                        className="text-lg mt-1"
                    />
                </div>

                {mode === 'USD' && onGiveChangeInBsChange && (
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="give-change-bs"
                            checked={giveChangeInBs}
                            onChange={handleCheckboxChange}
                            className="rounded"
                        />
                        <Label htmlFor="give-change-bs" className="cursor-pointer">
                            Dar cambio en Bs
                        </Label>
                    </div>
                )}

                {(mode === 'BS' || (mode === 'USD' && giveChangeInBs)) && change > 0 && (
                    <div className="space-y-2">
                        <Label htmlFor="rounding-mode">Opciones de vuelto</Label>
                        <select
                            id="rounding-mode"
                            value={roundingMode}
                            onChange={handleRoundingModeChange}
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                            <option value="EXACT">Vuelto exacto</option>
                            <option value="CUSTOMER">Redondear a favor del cliente</option>
                            <option value="MERCHANT">Redondear a favor de la tienda</option>
                        </select>

                        {roundingMode === 'MERCHANT' && (
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="rounding-consent"
                                    checked={roundingConsent}
                                    onChange={handleRoundingConsentChange}
                                    className="rounded"
                                />
                                <Label htmlFor="rounding-consent" className="cursor-pointer">
                                    Cliente acepta el redondeo a favor de la tienda
                                </Label>
                            </div>
                        )}
                    </div>
                )}

                {change > 0 && (
                    <div className="bg-muted p-3 rounded-lg space-y-2">
                        <div className="flex justify-between items-center">
                            <span className="text-sm font-medium">Cambio:</span>
                            <span className="text-lg font-bold">
                                {formatCurrency(change, mode)}
                            </span>
                        </div>

                        {mode === 'USD' && giveChangeInBs && (
                            <div className="space-y-1 text-sm text-muted-foreground">
                                <div>≈ {formatCurrency(exactChangeBs, 'BS')} (exacto)</div>
                                <div className="font-medium text-foreground">
                                    Cambio en Bs (redondeado): {formatCurrency(roundedChangeBs, 'BS')}
                                </div>
                                {changeBreakdownFormatted && (
                                    <div>Denominaciones: {changeBreakdownFormatted}</div>
                                )}
                            </div>
                        )}

                        {mode === 'BS' && (
                            <div className="space-y-1 text-sm text-muted-foreground">
                                <div className="font-medium text-foreground">
                                    Cambio en Bs (redondeado): {formatCurrency(roundedChangeBs, 'BS')}
                                </div>
                            </div>
                        )}

                        {excessBs > 0 && roundingMode !== 'EXACT' && (
                            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                                {roundingMode === 'MERCHANT'
                                    ? `Saldo a favor de la tienda: ${formatCurrency(excessBs, 'BS')}.`
                                    : `Saldo a favor del cliente: ${formatCurrency(excessBs, 'BS')}.`}
                            </div>
                        )}

                        {roundedChangeBs === 0 && changeBs > 0 && (
                            <div className="text-xs text-muted-foreground">
                                No se dará cambio (menor a la menor denominación común)
                            </div>
                        )}
                    </div>
                )}

                {receivedAmount < totalAmount && receivedAmount > 0 && (
                    <div className="text-sm text-destructive">
                        ⚠️ Monto insuficiente. Faltan {formatCurrency(totalAmount - receivedAmount, mode)}
                    </div>
                )}
            </CardContent>
        </Card>
    )
})

export default CashPaymentSection
