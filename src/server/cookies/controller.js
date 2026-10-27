import Joi from 'joi'
import { config } from '../../config/config.js'
import { getSafeRedirect } from '../common/helpers/get-safe-redirect.js'
import { updatePolicy } from '../common/helpers/cookie-policy-manager.js'

export const cookiesGetController = {
  handler (request, h) {
    return h.view('cookies/index', {
      pageTitle: 'Cookies',
      sessionCookieName: config.get('session.cookie.name'),
      temporarySessionCookieName: config.get('session.cache.name'),
      saved: request.query.saved === 'true',
      currentAnalytics: request.state[config.get('cookieConsent.name')]?.analytics === true,
      hideCookieBanner: true,
      breadcrumbs: [{ text: 'Home', href: '/' }, { text: 'Cookies' }]
    })
  }
}

export const cookiesPostController = {
  options: {
    validate: {
      payload: Joi.object({
        analytics: Joi.boolean().required(),
        async: Joi.boolean().default(false),
        returnUrl: Joi.string().allow('').max(2000).optional()
      })
    }
  },
  handler (request, h) {
    const { analytics, async: isAsync, returnUrl } = request.payload
    updatePolicy(request, h, analytics)

    if (isAsync) {
      return h.response({ message: 'success' })
    }

    return h.redirect(returnUrl ? getSafeRedirect(returnUrl) : '/cookies?saved=true')
  }
}
