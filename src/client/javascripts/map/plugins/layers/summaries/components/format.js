/** @param {Date} updated */
export function formatUpdatedYear (updated) {
  return String(updated.getFullYear())
}

export function formatGridSize (cellSize) {
  const size = cellSize >= 1000 ? `${cellSize / 1000}km` : `${cellSize}m`
  return `${size} x ${size}`
}

/**
 * @param {number | null | undefined} count
 * @param {string} singular
 * @param {string} plural
 */
export function formatCount (count, singular, plural) {
  if (count == null) {
    return 'Not available'
  }

  if (count === 0) {
    return 'None'
  }

  return `${count} ${count === 1 ? singular : plural}`
}
