import { useRef } from 'react'
import { InfoPopover } from '../../panels/shared/InfoPopover.jsx'
import { SummaryList } from '../../panels/shared/SummaryList.jsx'
import { Section } from './Section.jsx'
import { Proportion } from './Proportion.jsx'
import { getProvenanceRows, Provenance } from './Provenance.jsx'
import { IdList } from './IdList.jsx'
import { CountSummary } from './CountSummary.jsx'
import { formatCount } from './format.js'

/** @param {import('../model.js').Ownership | null} ownership */
function getOwnershipPreview (ownership) {
  const titles = ownership?.titles
  if (titles?.length === 1 && titles[0].titleDescriptor) {
    return titles[0].titleDescriptor
  }

  return formatCount(titles?.length, 'title', 'titles')
}

/** @param {{ ownership: import('../model.js').Ownership | null }} props */
function OwnershipDetail ({ ownership }) {
  const detailRef = useRef(null)
  if (!ownership) {
    return <p className='app-map__summary-message'>Not available</p>
  }

  const { titles } = ownership

  const info = <InfoPopover label='About INSPIRE IDs' container={detailRef}>Use this ID to search the Land Registry for the registered title. It identifies the polygon, not the owner.</InfoPopover>

  if (titles.length === 1) {
    const [title] = titles

    return (
      <div ref={detailRef}>
        <SummaryList
          className='app-map__summary-list' rows={[
            { label: 'INSPIRE ID', labelSuffix: info, value: title.inspireId },
            ...(title.titleDescriptor ? [{ label: 'Title descriptor', value: title.titleDescriptor }] : []),
            ...getProvenanceRows(title.source ?? ownership.source)
          ]}
        />
      </div>
    )
  }

  return (
    <div ref={detailRef}>
      <CountSummary label='INSPIRE IDs' labelSuffix={info} count={titles.length} />
      <Proportion intersections={ownership.tenureIntersections ?? []} caption='Share of area by legal tenure' />
      <IdList items={titles.map(title => ({ id: title.inspireId, description: title.titleDescriptor }))} label='INSPIRE IDs' />
      <Provenance source={ownership.source} separator />
    </div>
  )
}

/** @param {{ ownership: import('../model.js').Ownership | null }} props */
export function OwnershipSection ({ ownership }) {
  return (
    <Section sectionKey='ownership' title='Ownership' preview={getOwnershipPreview(ownership)}>
      <OwnershipDetail ownership={ownership} />
    </Section>
  )
}
