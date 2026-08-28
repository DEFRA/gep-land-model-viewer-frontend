import { EMPTY } from './format.js'
import { Section } from './Section.jsx'
import { SummaryList } from './SummaryList.jsx'

export function LandUse ({ landUse }) {
  return (
    <Section title='Land use' preview={landUse.label ?? EMPTY}>
      <SummaryList
        className='app-map__info-list'
        rows={[
          { label: 'Classification', value: landUse.label ?? EMPTY },
          { label: 'Code', value: landUse.code ?? EMPTY }
        ]}
      />
    </Section>
  )
}
