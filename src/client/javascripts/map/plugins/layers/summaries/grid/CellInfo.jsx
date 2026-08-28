import { EMPTY, formatDate } from '../../panels/info/format.js'
import { Section } from '../../panels/info/Section.jsx'
import { SummaryList } from '../../panels/info/SummaryList.jsx'
import { Unavailable } from '../../panels/info/Unavailable.jsx'
import { LandUse } from '../../panels/info/LandUse.jsx'

function LandCover ({ landCover }) {
  return (
    <Section title='Land cover' preview={landCover.label ?? EMPTY}>
      <SummaryList
        className='app-map__info-list'
        rows={[
          { label: 'Dominant cover', value: landCover.label ?? EMPTY },
          { label: 'Code', value: landCover.code ?? EMPTY },
          { label: 'Data source', value: landCover.source ?? EMPTY },
          { label: 'Last updated', value: formatDate(landCover.date) }
        ]}
      />
    </Section>
  )
}

function Soil ({ soil }) {
  return (
    <Section title='Soils' preview={soil.label ?? EMPTY}>
      <SummaryList
        className='app-map__info-list'
        rows={[
          { label: 'Soil type', value: soil.label ?? EMPTY },
          { label: 'Data source', value: soil.source ?? EMPTY },
          { label: 'Last updated', value: formatDate(soil.date) }
        ]}
      />
    </Section>
  )
}

/**
 * @param {{ hit: { cellId: import('./bng-reference.js').BngReference }, details: import('./data.js').GridCell | null }} props
 */
export function CellInfo ({ hit, details }) {
  const gridSquare = (
    <SummaryList
      className='app-map__info-ids'
      rows={[{ label: 'Grid square', value: String(hit.cellId) }]}
    />
  )

  if (!details) {
    return <Unavailable typeLabel='grid cell'>{gridSquare}</Unavailable>
  }

  return (
    <div className='app-map__info-content'>
      {gridSquare}

      <LandCover landCover={details.landCover} />
      <LandUse landUse={details.landUse} />
      <Soil soil={details.soil} />
    </div>
  )
}
