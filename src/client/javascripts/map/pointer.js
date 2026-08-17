/**
 * Whether the pointer may be imprecise: a coarse primary pointer or any
 * touch-capable screen.
 *
 * @returns {boolean}
 */
export function isCoarsePointer () {
  return globalThis.matchMedia?.('(pointer: coarse)').matches ||
    (globalThis.navigator?.maxTouchPoints ?? 0) > 0
}
