import Blankie from 'blankie'

import { config } from '../../../config/config.js'

const gtmContainerId = config.get('googleTagManager.containerId')

const GA_DOMAIN = 'https://www.google-analytics.com'
const GTM_DOMAIN = 'https://www.googletagmanager.com'

const gtmScriptSrc = gtmContainerId ? [GTM_DOMAIN, GA_DOMAIN] : []
const gtmConnectSrc = gtmContainerId
  ? [GA_DOMAIN, 'https://analytics.google.com', 'https://region1.google-analytics.com']
  : []
const gtmImgSrc = gtmContainerId ? [GA_DOMAIN, GTM_DOMAIN] : []
const gtmFrameSrc = gtmContainerId ? [GTM_DOMAIN] : []

const devConnectSrc = config.get('isDevelopment') ? ['ws://localhost:*', 'ws://127.0.0.1:*'] : []

/**
 * Manage content security policies.
 * @satisfies {import('@hapi/hapi').Plugin}
 */
const contentSecurityPolicy = {
  plugin: Blankie,
  options: {
    defaultSrc: ['self'],
    fontSrc: ['self'],
    connectSrc: ['self', ...gtmConnectSrc, ...devConnectSrc],
    mediaSrc: ['self'],
    styleSrc: ['self'],
    scriptSrc: ['self', ...gtmScriptSrc],
    imgSrc: ['self', ...gtmImgSrc],
    frameSrc: ['self', ...gtmFrameSrc],
    objectSrc: ['none'],
    frameAncestors: ['none'],
    formAction: ['self'],
    manifestSrc: ['self'],
    // https://frontend.design-system.service.gov.uk/import-javascript/#use-a-nonce-attribute-to-unblock-inline-javascript
    generateNonces: true
  }
}

// Environment Agency WMS host for overlay datasets.
const EA_DATA_HOST = 'https://environment.data.gov.uk'

// Supplier blob storage holding the operational dataset COG and FlatGeobuf files.
const OPERATIONAL_DATASET_HOST = 'https://gepcloudnativedata.blob.core.windows.net'

// Per-route override applied only to routes that render the map. Blankie
// replaces (does not merge) the global directives, so this must be complete.
export const mapContentSecurityPolicy = {
  defaultSrc: ['self'],
  fontSrc: ['self'],
  connectSrc: ['self', ...gtmConnectSrc, ...devConnectSrc, EA_DATA_HOST, OPERATIONAL_DATASET_HOST],
  mediaSrc: ['self'],
  styleSrc: ['self'],
  scriptSrc: ['self', ...gtmScriptSrc],
  workerSrc: ['self', 'blob:'],
  imgSrc: ['self', ...gtmImgSrc, EA_DATA_HOST],
  frameSrc: ['self', ...gtmFrameSrc],
  objectSrc: ['none'],
  frameAncestors: ['none'],
  formAction: ['self'],
  manifestSrc: ['self'],
  generateNonces: true
}

export { contentSecurityPolicy }
