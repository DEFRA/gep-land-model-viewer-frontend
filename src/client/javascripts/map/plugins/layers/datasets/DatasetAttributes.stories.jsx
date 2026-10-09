import { DatasetAttributes } from './DatasetAttributes.jsx'
import { InfoPanelContext } from '../panels/info/context.js'

/** @typedef {import('@storybook/preact-vite').StoryObj<typeof DatasetAttributes>} Story */

function AttributesPanel ({ label, features, datasetId, findGeoDataUrl }) {
  return (
    <div className='app-map sb-summary-panel'>
      <div className='im-o-app'>
        <section className='im-c-panel' aria-label='Data layer attributes'>
          <h2 className='im-c-panel__heading'>Data layer attributes</h2>
          <div className='im-c-panel__body app-map__info-panel'>
            <InfoPanelContext.Provider value={{ findGeoDataUrl }}>
              <DatasetAttributes label={label} features={features} datasetId={datasetId} />
            </InfoPanelContext.Provider>
          </div>
        </section>
      </div>
    </div>
  )
}

export default {
  title: 'Dataset attributes',
  component: DatasetAttributes,
  args: {
    label: 'Ancient Woodland',
    datasetId: 'ancient-woodland',
    findGeoDataUrl: 'https://find-geo-data.example.test/',
    features: [{ NAME: 'Wood A', THEME: 'Ancient & Semi-Natural Woodland', AREA: 12.4 }]
  },
  render: (args) => <AttributesPanel {...args} />
}

export const Attributes = /** @type {Story} */ ({ name: 'With attributes' })

export const NoAttributes = /** @type {Story} */ ({ name: 'No attributes', args: { features: [] } })
