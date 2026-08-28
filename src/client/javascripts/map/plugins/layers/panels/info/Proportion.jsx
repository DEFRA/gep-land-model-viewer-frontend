const MIN_OPACITY = 0.35
const OPACITY_RANGE = 1 - MIN_OPACITY

/**
  * @param {{ breakdown: Array<{ label: string, percentage: number }> }} props
 */
export function Proportion ({ breakdown }) {
  if (!breakdown.length) {
    return null
  }

  const max = Math.max(...breakdown.map(entry => entry.percentage))

  return (
    <>
      <p className='app-map__info-subheading'>Proportion of area</p>
      <ul className='app-map__cover-list'>
        {breakdown.map((entry) => {
          const percent = `${entry.percentage}%`
          const opacity = max > 0 ? MIN_OPACITY + OPACITY_RANGE * (entry.percentage / max) : 1

          return (
            <li className='app-map__cover-item' key={entry.label}>
              <span className='app-map__cover-label'>{entry.label}</span>
              <span className='app-map__cover-track'>
                <span
                  className='app-map__cover-bar'
                  aria-hidden='true'
                  style={{ width: percent, opacity }}
                />
              </span>
              <span className='app-map__cover-percent'>{percent}</span>
            </li>
          )
        })}
      </ul>
      <p className='app-map__cover-note'>*Percentages may not add up to 100% due to rounding.</p>
    </>
  )
}
