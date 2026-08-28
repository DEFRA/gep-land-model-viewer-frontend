import { format } from 'date-fns'

export const EMPTY = '-'

export function formatDate (value) {
  if (!value) {
    return EMPTY
  }
  return format(value, 'yyyy-MM-dd')
}
