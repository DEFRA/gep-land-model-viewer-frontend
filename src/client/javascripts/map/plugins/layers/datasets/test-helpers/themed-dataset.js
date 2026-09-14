export const THEMED_DATASET = {
  id: 'themed',
  label: 'Crop map',
  source: {
    type: 'fgb',
    url: '/themed.fgb',
    opacity: 0.7,
    styleConfig: {
      themes: [{
        label: 'Crop type',
        type: 'match',
        band: 1,
        field: 'lucode',
        classes: [{ bandValue: 1, fieldValues: ['AC44'], label: 'Potato', fill: [112, 38, 1, 1] }]
      }, {
        label: 'County',
        type: 'match',
        band: 2,
        field: 'county',
        classes: [{ bandValue: 1, fieldValues: ['LIN'], label: 'Lincolnshire', fill: [66, 135, 245, 1] }]
      }]
    }
  }
}
