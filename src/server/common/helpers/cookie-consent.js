import http2 from 'node:http2'
import { config } from '../../../config/config.js'
import {
  getCurrentPolicy,
  removeAnalytics
} from './cookie-policy-manager.js'

const { constants: httpConstants } = http2

const cookieNamePolicy = config.get('cookieConsent.name')
const cookiePolicy = config.get('cookieConsent.policy')

export const cookieConsent = {
  plugin: {
    name: 'cookie-consent',
    register: (server, _) => {
      server.state(cookieNamePolicy, cookiePolicy)

      server.ext('onPreResponse', (request, h) => {
        const statusCode = request.response.statusCode

        if (
          request.response.variety === 'view' &&
          statusCode !== httpConstants.HTTP_STATUS_FORBIDDEN &&
          request.response.source.context
        ) {
          request.response.header('cache-control', 'no-store')

          const cookiesPolicy = getCurrentPolicy(request, h)

          request.response.source.context.cookiesPolicy = cookiesPolicy

          request.response.source.context.currentUrl = `${request.path}${request.url.search ?? ''}`

          if (cookiesPolicy.confirmed && !cookiesPolicy.analytics) {
            removeAnalytics(request, h)
          }
        }

        return h.continue
      })
    }
  }
}
