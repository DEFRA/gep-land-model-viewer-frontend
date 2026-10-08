import { SummaryList } from '../../panels/shared/SummaryList.jsx'
import { Section } from './Section.jsx'
import { getProvenanceRows, Provenance } from './Provenance.jsx'
import { IdList } from './IdList.jsx'
import { CountSummary } from './CountSummary.jsx'
import { formatCount } from './format.js'

/** @param {import('../model.js').LandManagement | null} landManagement */
function getLandManagementPreview (landManagement) {
  const records = landManagement?.records
  if (records?.length === 1) {
    return records[0].pseudoSbi
  }

  return formatCount(records?.length, 'holding', 'holdings')
}

/** @param {{ landManagement: import('../model.js').LandManagement | null }} props */
function LandManagementDetail ({ landManagement }) {
  if (!landManagement) {
    return <p className='app-map__summary-message'>Not available</p>
  }

  const { records } = landManagement

  if (records.length === 1) {
    const [record] = records

    return (
      <SummaryList
        className='app-map__summary-list' rows={[
          { label: 'Pseudo SBI', value: record.pseudoSbi },
          ...getProvenanceRows(record.source ?? landManagement.source, record.refreshed)
        ]}
      />
    )
  }

  return (
    <>
      <CountSummary label='Pseudo SBIs' count={records.length} />
      <IdList items={records.map(record => ({ id: record.pseudoSbi }))} label='Pseudo SBIs' />
      <Provenance source={landManagement.source} separator />
    </>
  )
}

/** @param {{ landManagement: import('../model.js').LandManagement | null }} props */
export function LandManagementSection ({ landManagement }) {
  return (
    <Section sectionKey='landManagement' title='Land management' preview={getLandManagementPreview(landManagement)}>
      <LandManagementDetail landManagement={landManagement} />
    </Section>
  )
}
