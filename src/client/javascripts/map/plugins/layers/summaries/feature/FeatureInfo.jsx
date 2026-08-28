import { EMPTY, formatDate } from '../../panels/info/format.js'
import { Section } from '../../panels/info/Section.jsx'
import { SummaryList } from '../../panels/info/SummaryList.jsx'
import { Proportion } from '../../panels/info/Proportion.jsx'
import { Unavailable } from '../../panels/info/Unavailable.jsx'
import { LandUse } from '../../panels/info/LandUse.jsx'

function Breakdown ({ title, group }) {
  return (
    <Section title={title} preview={group.isMixed ? 'Mixed' : (group.dominantLabel ?? EMPTY)}>
      <Proportion breakdown={group.breakdown} />
      <SummaryList
        className='app-map__info-list'
        rows={[
          { label: 'Data source', value: group.source ?? EMPTY },
          { label: 'Last updated', value: formatDate(group.date) }
        ]}
      />
    </Section>
  )
}

/**
 * @param {{ hit: { osid?: string }, details: import('./data.js').Parcel | null }} props
 */
export function FeatureInfo ({ hit, details }) {
  if (!details) {
    return (
      <Unavailable typeLabel='parcel'>
        <SummaryList
          className='app-map__info-ids'
          rows={[{ label: 'OSID', value: hit?.osid ?? EMPTY }]}
        />
      </Unavailable>
    )
  }

  return (
    <div className='app-map__info-content'>
      <SummaryList
        className='app-map__info-ids'
        rows={[
          { label: 'OSID', value: details.osid },
          { label: 'TOID', value: details.toid }
        ]}
      />

      <Breakdown title='Land cover' group={details.landCover} />
      <LandUse landUse={details.landUse} />
      <Breakdown title='Soils' group={details.soil} />
    </div>
  )
}
