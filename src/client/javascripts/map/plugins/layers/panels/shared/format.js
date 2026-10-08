import { format, isValid, parseISO } from 'date-fns'

export const EMPTY = '-'

export function formatDatasetDate (value) {
  if (typeof value !== 'string' || !value) {
    return EMPTY
  }

  const date = parseISO(value)
  return isValid(date) ? format(date, 'd MMMM yyyy') : EMPTY
}

export function formatResolution (resolution) {
  if (!resolution) {
    return EMPTY
  }

  const scales = resolution.scaleDenominators
    .map((value) => `1:${value.toLocaleString('en-GB')}`)
  const distances = resolution.distances
    .map((value) => value.trim().replaceAll(/(\d)\s+(?=[a-z])/gi, '$1'))

  return [...new Set([...scales, ...distances])].join(', ')
}
