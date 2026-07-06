import { format } from 'date-fns'

const PKR_SYMBOL = '₨'

// Intl has no native "₨" currency symbol for PKR (it renders "Rs" or "PKR"
// depending on locale), so the thousands-separated number is formatted via
// Intl.NumberFormat and the symbol is prefixed manually.
const PKR_NUMBER_FORMATTER = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const USD_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  currencyDisplay: 'symbol',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const DATE_FORMAT = 'd MMM yyyy'
const DATE_TIME_FORMAT = 'd MMM yyyy, h:mm a'

export function formatPKR(amount: number): string {
  if (!Number.isFinite(amount)) {
    return '—'
  }

  const isNegative = amount < 0
  const formattedAmount = PKR_NUMBER_FORMATTER.format(Math.abs(amount))
  return `${isNegative ? '-' : ''}${PKR_SYMBOL}${formattedAmount}`
}

export function formatUSD(amount: number): string {
  if (!Number.isFinite(amount)) {
    return '—'
  }

  return USD_FORMATTER.format(amount)
}

export function formatCurrency(amount: number, currency: 'PKR' | 'USD'): string {
  if (currency === 'PKR') {
    return formatPKR(amount)
  }

  return formatUSD(amount)
}

export function formatDate(date: string | Date): string {
  const parsedDate = typeof date === 'string' ? new Date(date) : date
  return format(parsedDate, DATE_FORMAT)
}

export function formatDateTime(date: string | Date): string {
  const parsedDate = typeof date === 'string' ? new Date(date) : date
  return format(parsedDate, DATE_TIME_FORMAT)
}
