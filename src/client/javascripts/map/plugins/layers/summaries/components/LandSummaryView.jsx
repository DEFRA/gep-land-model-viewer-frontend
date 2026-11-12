import { SummaryHeader } from './SummaryHeader.jsx'
import { TaxonomyThemeSection } from './TaxonomyThemeSection.jsx'
import { OwnershipSection } from './OwnershipSection.jsx'
import { LandManagementSection } from './LandManagementSection.jsx'
import { ProtectedAreasSection } from './ProtectedAreasSection.jsx'

/**
 * @param {{ record: import('../model.js').LandModelThemes | null, unit?: import('../model.js').GridUnit | import('../model.js').FeatureUnit,
 *   header?: import('preact').ComponentChildren }} props The header defaults to the unit's identifiers
 */
export function LandSummaryView ({ record, unit, header }) {
  return (
    <div className='app-map__info-content app-map__summary'>
      {header ?? <SummaryHeader unit={unit} />}
      <TaxonomyThemeSection sectionKey='landCover' title='Land cover' dominantLabel='Dominant cover' caption='Proportion of area' theme={record?.landCover ?? null} />
      <TaxonomyThemeSection sectionKey='landUse' title='Land use' dominantLabel='Land use' caption='Share of area' theme={record?.landUse ?? null} />
      <OwnershipSection ownership={record?.ownership ?? null} />
      <LandManagementSection landManagement={record?.landManagement ?? null} />
      <ProtectedAreasSection protectedAreas={record?.protectedAreas ?? null} />
      <TaxonomyThemeSection sectionKey='soils' title='Soils' dominantLabel='Soil type' caption='Proportion of area' theme={record?.soils ?? null} />
    </div>
  )
}
