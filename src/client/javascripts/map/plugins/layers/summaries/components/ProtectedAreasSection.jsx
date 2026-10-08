import { SummaryList } from '../../panels/shared/SummaryList.jsx'
import { CountSummary } from './CountSummary.jsx'
import { Section } from './Section.jsx'
import { getProvenanceRows, Provenance } from './Provenance.jsx'
import { formatCount } from './format.js'

/** @param {import('../model.js').ProtectedAreas | null} protectedAreas */
function getProtectedAreaCount (protectedAreas) {
  return protectedAreas?.sites?.length ?? protectedAreas?.count
}

/** @param {{ protectedAreas: import('../model.js').ProtectedAreas | null }} props */
function ProtectedAreasDetail ({ protectedAreas }) {
  const count = getProtectedAreaCount(protectedAreas)
  if (count == null) {
    return <p className='app-map__summary-message'>Not available</p>
  }

  const sites = protectedAreas.sites ?? []
  const showSites = sites.length > 0

  return (
    <>
      <CountSummary label='Count' count={count} emptyMessage='Not in a protected area.' />
      {showSites && (
        <>
          <div className='app-map__summary-protected-sites'>
            {sites.map(site => (
              <div className='app-map__summary-record' key={site.code}>
                <h3 className='app-map__summary-site-type'>{site.designation.label}</h3>
                <SummaryList
                  className='app-map__summary-list' rows={[
                    { label: 'Name', value: site.name },
                    { label: 'ID', value: site.code },
                    { label: 'Overlap', value: `${site.intersection.percentage}%` },
                    ...getProvenanceRows(site.source)
                  ]}
                />
              </div>
            ))}
          </div>
          <p className='govuk-hint app-map__summary-note'>*Protected area boundaries do not always align with Land Model features. Refer to the source dataset for the legal boundary.</p>
        </>
      )}
      <Provenance source={protectedAreas.source} separator={showSites} />
    </>
  )
}

/** @param {{ protectedAreas: import('../model.js').ProtectedAreas | null }} props */
export function ProtectedAreasSection ({ protectedAreas }) {
  return (
    <Section sectionKey='protectedAreas' title='Protected areas' preview={formatCount(getProtectedAreaCount(protectedAreas), 'designation', 'designations')}>
      <ProtectedAreasDetail protectedAreas={protectedAreas} />
    </Section>
  )
}
