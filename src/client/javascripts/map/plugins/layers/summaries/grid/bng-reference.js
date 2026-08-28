const SQUARE_SIZE = 100000
const MAX_DIGITS = 5

// Prefix table derived from OS Transform (OrdnanceSurvey/os-transform), Open Government Licence v3.0
const PREFIXES = [
  ['SV', 'SW', 'SX', 'SY', 'SZ', 'TV', 'TW'],
  ['SQ', 'SR', 'SS', 'ST', 'SU', 'TQ', 'TR'],
  ['SL', 'SM', 'SN', 'SO', 'SP', 'TL', 'TM'],
  ['SF', 'SG', 'SH', 'SJ', 'SK', 'TF', 'TG'],
  ['SA', 'SB', 'SC', 'SD', 'SE', 'TA', 'TB'],
  ['NV', 'NW', 'NX', 'NY', 'NZ', 'OV', 'OW'],
  ['NQ', 'NR', 'NS', 'NT', 'NU', 'OQ', 'OR'],
  ['NL', 'NM', 'NN', 'NO', 'NP', 'OL', 'OM'],
  ['NF', 'NG', 'NH', 'NJ', 'NK', 'OF', 'OG'],
  ['NA', 'NB', 'NC', 'ND', 'NE', 'OA', 'OB'],
  ['HV', 'HW', 'HX', 'HY', 'HZ', 'JV', 'JW'],
  ['HQ', 'HR', 'HS', 'HT', 'HU', 'JQ', 'JR'],
  ['HL', 'HM', 'HN', 'HO', 'HP', 'JL', 'JM']
]

export class BngReference {
  #prefix
  #easting
  #northing

  /**
   * @param {string} prefix - Two-letter grid square prefix, e.g. 'TQ'
   * @param {string} easting - Easting digits within the grid square, e.g. '2386'
   * @param {string} northing - Northing digits within the grid square, e.g. '3472'
   */
  constructor (prefix, easting, northing) {
    this.#prefix = prefix
    this.#easting = easting
    this.#northing = northing
  }

  get compact () {
    return `${this.#prefix}${this.#easting}${this.#northing}`
  }

  get formatted () {
    if (!this.#easting) {
      return this.#prefix
    }
    return `${this.#prefix} ${this.#easting} ${this.#northing}`
  }

  toString () {
    return this.formatted
  }
}

/**
 * @param {number} easting - BNG easting in metres
 * @param {number} northing - BNG northing in metres
 * @param {1 | 10 | 100 | 1000 | 10000 | 100000} resolution - Grid cell size in metres
 * @returns {BngReference | null} OS grid reference, or null if outside the BNG extent
 * @example
 * toBngRef(523863, 134729, 1)      // 'TQ 23863 34729'  (1m)
 * toBngRef(523863, 134729, 10)     // 'TQ 2386 3472'    (10m)
 * toBngRef(523863, 134729, 100)    // 'TQ 238 347'      (100m)
 * toBngRef(523863, 134729, 1000)   // 'TQ 23 34'        (1km)
 * toBngRef(523863, 134729, 10000)  // 'TQ 2 3'          (10km)
 * toBngRef(523863, 134729, 100000) // 'TQ'              (100km)
 */
export function toBngRef (easting, northing, resolution) {
  const row = PREFIXES[Math.floor(northing / SQUARE_SIZE)]
  if (!row) {
    return null
  }

  const prefix = row[Math.floor(easting / SQUARE_SIZE)]
  if (!prefix) {
    return null
  }

  if (resolution === SQUARE_SIZE) {
    return new BngReference(prefix, '', '')
  }

  const digits = MAX_DIGITS - Math.log10(resolution)
  const e = String(Math.floor((easting % SQUARE_SIZE) / resolution)).padStart(digits, '0')
  const n = String(Math.floor((northing % SQUARE_SIZE) / resolution)).padStart(digits, '0')

  return new BngReference(prefix, e, n)
}
