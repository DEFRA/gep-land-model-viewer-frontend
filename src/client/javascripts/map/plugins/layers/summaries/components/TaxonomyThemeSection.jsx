import { SummaryList } from '../../panels/shared/SummaryList.jsx'
import { Section } from './Section.jsx'
import { Proportion } from './Proportion.jsx'
import { Provenance } from './Provenance.jsx'

/** @param {{ dominantLabel: string, caption: string, theme: import('../model.js').TaxonomyTheme | null }} props */
function TaxonomyThemeDetail ({ dominantLabel, caption, theme }) {
  if (!theme) {
    return <p className='app-map__summary-message'>Not available</p>
  }

  return (
    <>
      {theme.intersections?.length
        ? <Proportion intersections={theme.intersections} caption={caption} />
        : <SummaryList className='app-map__summary-list' rows={[{ label: dominantLabel, value: theme.dominant.label }]} />}
      <Provenance source={theme.source} />
    </>
  )
}

/** @param {{ sectionKey: string, title: string, dominantLabel: string, caption: string, theme: import('../model.js').TaxonomyTheme | null }} props */
export function TaxonomyThemeSection ({ sectionKey, title, dominantLabel, caption, theme }) {
  return (
    <Section sectionKey={sectionKey} title={title} preview={theme?.dominant.label ?? 'Not available'}>
      <TaxonomyThemeDetail dominantLabel={dominantLabel} caption={caption} theme={theme} />
    </Section>
  )
}
