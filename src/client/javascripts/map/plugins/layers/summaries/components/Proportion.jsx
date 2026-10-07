const MIN_OPACITY = 0.2
const OPACITY_RANGE = 1 - MIN_OPACITY

/** @param {{ intersections: import('../model.js').ClassIntersection[], caption: string }} props */
export function Proportion ({ intersections, caption }) {
  if (!intersections.length) {
    return null
  }

  const sorted = [...intersections].sort((a, b) => b.percentage - a.percentage)
  const max = sorted[0].percentage

  return (
    <>
      <p className='app-map__summary-chart-caption'>{caption}</p>
      <ul className='app-map__summary-proportions'>
        {sorted.map(entry => {
          const percent = `${entry.percentage}%`
          const opacity = MIN_OPACITY + OPACITY_RANGE * (entry.percentage / max)

          return (
            <li className='app-map__summary-proportion' key={entry.label}>
              <span>{entry.label}</span>
              <span className='app-map__summary-track' aria-hidden='true'>
                <span className='app-map__summary-bar' style={{ width: percent, opacity }} />
              </span>
              <span className='app-map__summary-percentage'>{percent}</span>
            </li>
          )
        })}
      </ul>
      <p className='govuk-hint app-map__summary-note'>*Percentages may not add up to 100% due to rounding.</p>
    </>
  )
}
