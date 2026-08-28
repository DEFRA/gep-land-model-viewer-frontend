import { parse, isValid } from 'date-fns'

/**
 * Parses the `dd/MM/yyyy` the land model API sends. Returns null for anything
 * else, so a bad or missing value reaches the panel as "no date" rather than an
 * Invalid Date.
 * @param {string | null | undefined} value
 * @returns {Date | null}
 */
export function toDate (value) {
  if (!value) {
    return null
  }

  const date = parse(value, 'dd/MM/yyyy', new Date(0))
  if (!isValid(date)) {
    return null
  }

  return date
}
