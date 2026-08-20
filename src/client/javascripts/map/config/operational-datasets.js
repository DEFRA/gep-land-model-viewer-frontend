import peatySoilDepthStyle from '../../../data/styles/peaty-soil-depth.json'
import livingEnglandStyle from '../../../data/styles/living-england.json'
import ancientWoodlandStyle from '../../../data/styles/ancient-woodland.json'
import sssiStyle from '../../../data/styles/sssi.json'
import agriculturalLandClassificationStyle from '../../../data/styles/agricultural-land-classification.json'
import cropMapOfEnglandStyle from '../../../data/styles/crop-map-of-england.json'
import floodZonesStyle from '../../../data/styles/flood-zones.json'
import rofswStyle from '../../../data/styles/rofsw.json'

const BASE_URL = 'https://gepcloudnativedata.blob.core.windows.net/gep/datasets/operational'

export const operationalDatasets = [
  {
    id: 'peaty-soil-depth-cog',
    label: 'Peaty soil depth (COG)',
    source: {
      type: 'cog',
      url: `${BASE_URL}/england_peat_map/peaty_soil_depth_v1_download_cog.tif`,
      opacity: 0.8,
      normalize: false,
      interpolate: false,
      // Colours and breaks from Natural England's England Peat Map:
      // https://www.arcgis.com/home/item.html?id=f913f83321ff4ff98770e1348d244f8a
      styleConfig: peatySoilDepthStyle
    }
  },
  {
    id: 'living-england-fgb',
    label: 'Living England Habitat Map (FGB)',
    source: {
      type: 'fgb',
      url: `${BASE_URL}/living_england_habitat_map/livingeng.fgb`,
      opacity: 0.7,
      styleConfig: livingEnglandStyle,
      minZoom: 7,
      overview: {
        type: 'cog',
        url: `${BASE_URL}/living_england_habitat_map/LE_cog_mode.tif`
      }
    }
  },
  {
    id: 'ancient-woodland-fgb',
    label: 'Ancient Woodland (FGB)',
    source: {
      type: 'fgb',
      url: `${BASE_URL}/ancient_woodland/ancient_woodland_england.fgb`,
      opacity: 0.7,
      styleConfig: ancientWoodlandStyle,
      overview: {
        type: 'pmtiles',
        url: `${BASE_URL}/ancient_woodland/data.pmtiles`,
        maxZoom: 4
      }
    }
  },
  {
    id: 'ancient-woodland-low-fgb',
    label: 'Ancient Woodland low detail (FGB)',
    source: {
      type: 'fgb',
      url: `${BASE_URL}/ancient_woodland/ancient_woodland_england_low.fgb`,
      opacity: 0.7,
      styleConfig: ancientWoodlandStyle
    }
  },
  {
    id: 'sssi-fgb',
    label: 'Sites of Special Scientific Interest (FGB)',
    source: {
      type: 'fgb',
      url: `${BASE_URL}/protected_areas_sites_of_specific_interest/sssi.fgb`,
      opacity: 0.7,
      styleConfig: sssiStyle,
      overview: {
        type: 'pmtiles',
        url: `${BASE_URL}/protected_areas_sites_of_specific_interest/data.pmtiles`,
        maxZoom: 4
      }
    }
  },
  {
    id: 'agricultural-land-classification-fgb',
    label: 'Agricultural Land Classification (FGB)',
    source: {
      type: 'fgb',
      url: `${BASE_URL}/agricultural_land_classification/prov_agg_land_class.fgb`,
      opacity: 0.7,
      styleConfig: agriculturalLandClassificationStyle,
      overview: {
        type: 'pmtiles',
        url: `${BASE_URL}/agricultural_land_classification/data.pmtiles`,
        maxZoom: 4
      }
    }
  },
  {
    id: 'crop-map-of-england-fgb',
    label: 'Crop Map of England (FGB)',
    source: {
      type: 'fgb',
      url: `${BASE_URL}/crop_map_of_england/crome.fgb`,
      opacity: 0.7,
      styleConfig: cropMapOfEnglandStyle,
      minZoom: 7,
      overview: {
        type: 'cog',
        url: `${BASE_URL}/crop_map_of_england/cog_mode.tif`
      }
    }
  },
  {
    id: 'flood-map-for-planning-fgb',
    label: 'Flood Map for Planning, Flood Zones 2 and 3 (FGB)',
    source: {
      type: 'fgb',
      url: `${BASE_URL}/flood_map_for_planning_flood_zones/flood_map_for_planning.fgb`,
      opacity: 0.7,
      styleConfig: floodZonesStyle,
      overview: {
        type: 'pmtiles',
        url: `${BASE_URL}/flood_map_for_planning_flood_zones/data.pmtiles`,
        maxZoom: 7
      }
    }
  },
  {
    id: 'risk-of-flooding-surface-water-fgb',
    label: 'Risk of Flooding from Surface Water (FGB)',
    source: {
      type: 'fgb',
      url: `${BASE_URL}/risk_of_flooding_surface_water/rofsw.fgb`,
      opacity: 0.7,
      styleConfig: rofswStyle,
      minZoom: 7
    }
  }
]
