import { parse, parseISO, isValid } from 'date-fns'

const YEAR = /^\d{4}$/
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T/

/**
 * Parses the `dd/MM/yyyy` the land model API sends, a `yyyy` year for annual
 * products, or the ISO timestamp in the pipeline's land model view. Returns
 * null for anything else, so a bad or missing value reaches the panel as
 * "no date" rather than an Invalid Date.
 * @param {string | null | undefined} value
 * @returns {Date | null}
 */
export function toDate (value) {
  if (!value) {
    return null
  }

  if (YEAR.test(value)) {
    return new Date(Number.parseInt(value, 10), 0, 1)
  }

  const date = TIMESTAMP.test(value) ? parseISO(value) : parse(value, 'dd/MM/yyyy', new Date(0))
  if (!isValid(date)) {
    return null
  }

  return date
}
