export type WeightUnit = 'kg' | 'g' | 'lb' | 'oz' | null | undefined

const KG_PER_LB = 0.45359237
const KG_PER_OZ = 0.028349523125

export const normalizeWeightToKg = (value: number, unit: WeightUnit) => {
  const safeValue = Number(value || 0)
  switch (unit) {
    case 'g':
      return safeValue / 1000
    case 'lb':
      return safeValue * KG_PER_LB
    case 'oz':
      return safeValue * KG_PER_OZ
    case 'kg':
    default:
      return safeValue
  }
}

const formatNumber = (value: number, maxDecimals = 3) =>
  new Intl.NumberFormat('es-VE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  }).format(value)

export const formatQuantity = (
  value: number,
  isWeightProduct: boolean,
  weightUnit: WeightUnit
) => {
  if (isWeightProduct) {
    const kgValue = normalizeWeightToKg(value, weightUnit)
    return `${formatNumber(kgValue, 3)} kg`
  }
  return `${formatNumber(value, 0)} unid`
}
