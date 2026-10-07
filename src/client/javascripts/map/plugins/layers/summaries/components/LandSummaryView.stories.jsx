import { useRef } from 'react'
import { fn } from 'storybook/test'
import { InfoPanelContext } from '../../panels/info/context.js'
import {
  grid10mRecord,
  grid100mRecord,
  grid1kmRecord,
  grid10kmRecord,
  grid100kmRecord,
  featureRecord,
  featureMultipleRecord,
  zeroRecord,
  partialRecord
} from '../fixtures/land-model.js'
import { LandSummaryView } from './LandSummaryView.jsx'

function panelTitle (unit) {
  return unit.kind === 'feature' ? 'OS feature' : 'Grid square'
}

/** @typedef {import('@storybook/preact-vite').StoryObj<SummaryStoryArgs>} Story */

/**
 * @typedef {object} SummaryStoryArgs
 * @property {import('../model.js').LandModelRecord | null} record
 * @property {import('../model.js').GridUnit | import('../model.js').FeatureUnit} [unit]
 * @property {boolean} [outsideSampleArea]
 * @property {() => void} [goToSampleArea]
 */

/** @param {SummaryStoryArgs} props */
function SummaryPanel ({ record, unit, outsideSampleArea, goToSampleArea }) {
  const sections = useRef(new Map())
  const selectedUnit = unit ?? record.unit
  const title = panelTitle(selectedUnit)

  return (
    <div className='app-map sb-summary-panel'>
      <div className='im-o-app'>
        <section className='im-c-panel' aria-label={title}>
          <h2 className='im-c-panel__heading'>{title}</h2>
          <div className='im-c-panel__body app-map__info-panel'>
            <InfoPanelContext.Provider value={{ sections: sections.current, goToSampleArea }}>
              <LandSummaryView record={record} unit={selectedUnit} outsideSampleArea={outsideSampleArea} />
            </InfoPanelContext.Provider>
          </div>
        </section>
      </div>
    </div>
  )
}

const meta = /** @type {import('@storybook/preact-vite').Meta<SummaryStoryArgs>} */ ({
  title: 'Land summary',
  component: LandSummaryView,
  args: { record: grid10mRecord, outsideSampleArea: false, goToSampleArea: fn() },
  argTypes: {
    record: { control: 'object' },
    outsideSampleArea: { control: 'boolean' },
    goToSampleArea: { control: false }
  },
  render: (args, context) => <SummaryPanel key={context.id} {...args} />
})

export default meta

export const Grid10m = /** @type {Story} */ ({ name: '10m grid square' })

export const Grid100m = /** @type {Story} */ ({ name: '100m grid square', args: { record: grid100mRecord } })

export const Grid1km = /** @type {Story} */ ({ name: '1km grid square', args: { record: grid1kmRecord } })

export const Grid10km = /** @type {Story} */ ({ name: '10km grid square', args: { record: grid10kmRecord } })

export const Grid100km = /** @type {Story} */ ({ name: '100km grid square', args: { record: grid100kmRecord } })

export const Feature = /** @type {Story} */ ({ name: 'OS feature', args: { record: featureRecord } })

export const FeatureMultipleRecords = /** @type {Story} */ ({ name: 'OS feature with multiple records', args: { record: featureMultipleRecord } })

export const ZeroCounts = /** @type {Story} */ ({ name: 'Zero counts', args: { record: zeroRecord } })

export const UnavailableSections = /** @type {Story} */ ({ name: 'Unavailable sections', args: { record: partialRecord } })

export const OutsideSampleArea = /** @type {Story} */ ({
  name: 'Outside sample area',
  args: { record: null, unit: grid10mRecord.unit, outsideSampleArea: true }
})
