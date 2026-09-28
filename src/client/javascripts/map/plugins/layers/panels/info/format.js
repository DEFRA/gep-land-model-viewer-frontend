import { format, isValid, parseISO } from 'date-fns'

export const EMPTY = '-'

export function formatDate (value) {
  if (!value) {
    return EMPTY
  }
  return format(value, 'yyyy-MM-dd')
}

export function formatDatasetDate (value) {
  if (typeof value !== 'string' || !value) {
    return EMPTY
  }

  const date = parseISO(value)
  return isValid(date) ? format(date, 'd MMMM yyyy') : EMPTY
}
