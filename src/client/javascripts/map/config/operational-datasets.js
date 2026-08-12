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
      style: {
        color: [
          'case',
          ['==', ['band', 2], 0], 'rgba(0, 0, 0, 0)',
          ['<=', ['band', 1], 20], '#ccccff',
          ['<=', ['band', 1], 30], '#b3b3fc',
          ['<=', ['band', 1], 40], '#9a9af8',
          ['<=', ['band', 1], 50], '#8282f5',
          ['<=', ['band', 1], 100], '#6b6bf1',
          ['<=', ['band', 1], 150], '#5555ee',
          ['<=', ['band', 1], 200], '#3e3eea',
          ['<=', ['band', 1], 250], '#2929e7',
          ['<=', ['band', 1], 500], '#1414e3',
          '#0000e0'
        ]
      }
    }
  },
  {
    id: 'living-england-fgb',
    label: 'Living England Habitat Map (FGB)',
    source: {
      type: 'fgb',
      url: `${BASE_URL}/living_england_habitat_map/livingeng.fgb`,
      opacity: 0.7,
      styleUrl: `${BASE_URL}/living_england_habitat_map/Living%20England%20Habitat%20Map%20Phase%204%20%C2%A9%20Natural%20England.lyrx`,
      overview: {
        type: 'pmtiles',
        url: `${BASE_URL}/living_england_habitat_map/data.pmtiles`,
        maxZoom: 4
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
      styleUrl: `${BASE_URL}/ancient_woodland/Ancient%20Woodland%20%C2%A9%20Natural%20England.lyrx`,
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
      styleUrl: `${BASE_URL}/ancient_woodland/Ancient%20Woodland%20%C2%A9%20Natural%20England.lyrx`
    }
  },
  {
    // No layer file is published for this dataset, manual one
    id: 'sssi-fgb',
    label: 'Sites of Special Scientific Interest (FGB)',
    source: {
      type: 'fgb',
      url: `${BASE_URL}/protected_areas_sites_of_specific_interest/sssi.fgb`,
      opacity: 0.7,
      style: {
        'fill-color': 'rgb(178, 102, 204)',
        'stroke-color': 'rgb(112, 48, 135)',
        'stroke-width': 1.25
      },
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
      styleUrl: `${BASE_URL}/agricultural_land_classification/ALC%20Grades%20(Provisional)%20%E2%94%AC%D0%B9%20ADAS%20%26%20Defra.lyrx`,
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
      styleUrl: `${BASE_URL}/crop_map_of_england/Crop_Map_Of_England_2020.lyrx`,
      lowercaseFields: true, // LUCODE -> lucode for style
      overview: {
        type: 'pmtiles',
        url: `${BASE_URL}/crop_map_of_england/data.pmtiles`,
        maxZoom: 4
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
      styleUrl: `${BASE_URL}/flood_map_for_planning_flood_zones/Flood_Zones_2_3_Rivers_and_Sea.lyrx`,
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
      styleUrl: `${BASE_URL}/risk_of_flooding_surface_water/RoFSW.lyrx`,
      minZoom: 7
    }
  }
]
