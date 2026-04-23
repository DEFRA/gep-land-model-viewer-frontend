export const mapController = {
  handler (_request, h) {
    return h.view('map/index', {
      pageTitle: 'Map'
    })
  }
}
