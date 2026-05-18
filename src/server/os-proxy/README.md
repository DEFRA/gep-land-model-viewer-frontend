# OS Proxy

Server-side routes for Ordnance Survey APIs. These add the OS API key before forwarding requests, keeping it out of the browser.

`map-routes.js` handles [OS Vector Tile API](https://docs.os.uk/os-apis/accessing-os-apis/os-vector-tile-api), [OS NGD API - Tiles](https://docs.os.uk/os-apis/accessing-os-apis/os-ngd-api-tiles) and [OS Maps API](https://docs.os.uk/os-apis/accessing-os-apis/os-maps-api) requests. JSON responses that contain OS resource URLs are rewritten to use the local `/os/*` proxy routes.

`names-routes.js` handles [OS Names API](https://docs.os.uk/os-apis/accessing-os-apis/os-names-api) requests for the map search control.
