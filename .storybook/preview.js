import '../src/client/stylesheets/application.scss'
import '@defra/interactive-map/css'
import '../src/client/stylesheets/map.scss'
import './preview.scss'

/** @type {import('@storybook/preact-vite').Preview} */
export default {
  parameters: {
    layout: 'padded',
    viewport: {
      options: {
        mobile: { name: 'Mobile (390px)', styles: { width: '390px', height: '844px' }, type: 'mobile' },
        desktop: { name: 'Desktop', styles: { width: '1280px', height: '900px' }, type: 'desktop' }
      }
    }
  }
}
