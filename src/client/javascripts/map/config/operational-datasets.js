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
    label: 'Peaty soil depth',
    inspireTheme: 'Soil',
    // https://environment.data.gov.uk/dataset/fc9e34eb-6119-47fb-a1ab-9508e82eef22
    metadata: {
      id: 'fc9e34eb-6119-47fb-a1ab-9508e82eef22',
      abstract: `The England Peat Map is a map of England's peaty soils. It models the extent, depth, and condition of our peat including vegetation and upland peat erosion & drainage features (grips, gullies, bare peat and peat hagging). The map and, where possible, the associated data, are available openly and free to use for any purpose.

This map is funded by the Nature for Climate Fund and the Natural Capital and Ecosystem Assessment (NCEA) programme, both part of the Department for the Environment, Food and Rural Affairs (DEFRA).

The map layers were created using machine learning and deep learning modelling techniques, trained with pre-existing survey data collated from Defra organisations and other stakeholders, as well as new survey data collected by contractors and quality-assured by an in-house team. Predictor data used in the modelling process included national-scale satellite imagery, topographic LiDAR, geological and historic land-use data. Data collated from multiple sources and collated by the England Peat Map project.

See NERR149 England Peat Map Final Report Annex 5 for more information.

England Peat Map predicted depth of peaty soils modelled in 2025 and Confidence in the England Peat Map depth prediction on a 10m by 10m square basis. Confidence is measured by root mean square deviation.`,
      owner: 'Natural England',
      categories: ['Environment'],
      creationDate: '2025-05-06',
      updatedAt: '2025-05-06',
      updateFrequency: 'As needed',
      accessLevel: 'Open data',
      resolution: null,
      geographicExtent: 'England',
      coordinateReferenceSystem: 'British National Grid, EPSG:27700',
      licence: 'Open Government Licence',
      format: []
    },
    source: {
      type: 'cog',
      url: `${BASE_URL}/england_peat_map/peaty_soil_depth_v1_download_cog.tif`,
      opacity: 0.5,
      normalize: false,
      interpolate: false,
      // Colours and breaks from Natural England's England Peat Map:
      // https://www.arcgis.com/home/item.html?id=f913f83321ff4ff98770e1348d244f8a
      styleConfig: peatySoilDepthStyle
    }
  },
  {
    id: 'living-england-fgb',
    label: 'Living England Habitat Map',
    inspireTheme: 'Land cover',
    // https://environment.data.gov.uk/dataset/4aa716ce-f6af-454c-8ba2-833ebc1bde96
    metadata: {
      id: '4aa716ce-f6af-454c-8ba2-833ebc1bde96',
      abstract: 'The Living England project, led by Natural England, is a multi-year programme delivering a satellite-derived national habitat layer in support of the Environmental Land Management (ELM) System and the Natural Capital and Ecosystem Assessment (NCEA) Pilot. The project uses a machine learning approach to image classification, developed under the Defra Living Maps project (SD1705 – Kilcoyne et al., 2017).',
      owner: 'Natural England',
      categories: ['Environment'],
      creationDate: '2022-03-31',
      updatedAt: '2022-03-31',
      updateFrequency: 'Not planned',
      accessLevel: 'Open data',
      resolution: '10m / broad habitat',
      geographicExtent: 'England',
      coordinateReferenceSystem: 'British National Grid, EPSG:27700',
      licence: 'Open Government Licence',
      format: ['File geodatabase', 'GeoJSON', 'GeoPackage']
    },
    source: {
      type: 'fgb',
      url: `${BASE_URL}/living_england_habitat_map/livingeng.fgb`,
      opacity: 0.5,
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
    label: 'Ancient Woodland',
    inspireTheme: 'Habitats and biotopes',
    // https://environment.data.gov.uk/dataset/f425f1e1-fc18-4b5a-88d8-76934125627c
    metadata: {
      id: 'f425f1e1-fc18-4b5a-88d8-76934125627c',
      abstract: `This is a spatial dataset that describes the geographic extent and location of ancient woodland habitat in England (excluding the Isles of Scilly). Ancient woodland is an area that has been wooded continuously since at least 1600AD

This dataset is one of two resources used to identify the location and extent of ancient woodland in England. The Ancient Woodland Inventory (AWI) is currently undergoing revision. Updated AWI data can be accessed at Ancient Woodland - Revised (England) - Completed Counties. Where a county has been updated and is included in that dataset, the revised information takes precedence.

If a county has not yet been updated and so does not appear in the Ancient Woodland - Revised (England) - Completed Counties dataset, the Ancient Woodland Inventory (AWI) dataset should be used as the primary reference.

Ancient woodland includes Ancient Semi-Natural Woodland (ASNW), which retains a native tree and shrub cover, Plantation on Ancient Woodland Sites (PAWS) where the original tree cover has been felled and replaced by planting, often with conifers, Ancient Wood Pasture and Parkland (AWPP) where the trees are managed in tandem with a long established tradition of grazing, characteristically with at least some veteran trees or shrubs and Infilled Ancient Wood Pasture and Parkland where the open habitat between open grown or veteran trees in AWPP has infilled, either through natural regeneration or planting, resulting in closed canopy woodland.

In total 53,637 polygons were captured, covering approximately 364971.81 Ha. Our guidance document can be accessed below.`,
      owner: 'Natural England',
      categories: ['Environment'],
      creationDate: '2013-01-01',
      updatedAt: '2026-03-15',
      updateFrequency: 'Monthly',
      accessLevel: 'Open data',
      resolution: null,
      geographicExtent: 'England',
      coordinateReferenceSystem: 'British National Grid, EPSG:27700',
      licence: 'Open Government Licence',
      format: ['File geodatabase', 'GeoJSON', 'GeoPackage', 'Shapefile']
    },
    source: {
      type: 'fgb',
      url: `${BASE_URL}/ancient_woodland/ancient_woodland_england.fgb`,
      opacity: 0.5,
      styleConfig: ancientWoodlandStyle,
      overview: {
        type: 'pmtiles',
        url: `${BASE_URL}/ancient_woodland/data.pmtiles`,
        maxZoom: 4
      }
    }
  },
  {
    id: 'sssi-fgb',
    label: 'Sites of Special Scientific Interest',
    inspireTheme: 'Protected sites',
    // https://environment.data.gov.uk/dataset/ba8dc201-66ef-4983-9d46-7378af21027e
    metadata: {
      id: 'ba8dc201-66ef-4983-9d46-7378af21027e',
      abstract: 'A Site of Special Scientific Interest (SSSI) is the land notified as an SSSI under the Wildlife and Countryside Act (1981), as amended. Sites notified under the 1949 Act only are not included in the Data set. SSSI are the finest sites for wildlife and natural features in England, supporting many characteristic, rare and endangered species, habitats and natural features. The data do not include "proposed" sites. Boundaries are generally mapped against Ordnance Survey MasterMap.',
      owner: 'Natural England',
      categories: ['Environment'],
      creationDate: '2024-11-15',
      updatedAt: '2025-04-15',
      updateFrequency: 'Monthly',
      accessLevel: 'Open data',
      resolution: null,
      geographicExtent: 'England',
      coordinateReferenceSystem: 'British National Grid, EPSG:27700',
      licence: 'Open Government Licence',
      format: ['File geodatabase', 'GeoJSON', 'GeoPackage', 'Shapefile']
    },
    source: {
      type: 'fgb',
      url: `${BASE_URL}/protected_areas_sites_of_specific_interest/sssi.fgb`,
      opacity: 0.5,
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
    label: 'Agricultural Land Classification',
    inspireTheme: 'Soil',
    // https://environment.data.gov.uk/dataset/af1b847b-037b-4772-9c31-7edf584522aa
    metadata: {
      id: 'af1b847b-037b-4772-9c31-7edf584522aa',
      abstract: `Provisional Agricultural Land Classification Grade. Agricultural land classified into five grades. Grade one is best quality and grade five is poorest quality. A number of consistent criteria used for assessment which include climate (temperature, rainfall, aspect, exposure, frost risk), site (gradient, micro-relief, flood risk) and soil (depth, structure, texture, chemicals, stoniness) for England only.
      Digitised from the published 1:250,000 map which was in turn compiled from the 1 inch to the mile maps.`,
      owner: 'Natural England',
      categories: ['Environment'],
      creationDate: '2007-05-15',
      updatedAt: '2019-02-15',
      updateFrequency: 'Not planned',
      accessLevel: 'Open data',
      resolution: null,
      geographicExtent: 'England',
      coordinateReferenceSystem: 'British National Grid, EPSG:27700',
      licence: 'Open Government Licence',
      format: ['File geodatabase', 'GeoJSON', 'GeoPackage', 'Shapefile']
    },
    source: {
      type: 'fgb',
      url: `${BASE_URL}/agricultural_land_classification/prov_agg_land_class.fgb`,
      opacity: 0.5,
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
    label: 'Crop Map of England',
    inspireTheme: 'Land cover',
    // https://environment.data.gov.uk/dataset/7fdb6312-801c-41f6-996d-4585d2bb4684
    metadata: {
      id: '7fdb6312-801c-41f6-996d-4585d2bb4684',
      abstract: `The Crop Map of England (CROME) is a polygon vector dataset mainly containing the crop types of England. The dataset contains approximately 32 million hexagonal cells classifying England into over 15 main crop types, grassland, and non-agricultural land covers, such as Woodland, Water Bodies, Fallow Land and other non-agricultural land covers.

The classification was created automatically using supervised classification (Random Forest Classification) from the combination of Sentinel-1 Radar and Sentinel-2 Optical Satellite images during the period late January 2020 – September 2020. The dataset was created to aid the classification of crop types from optical imagery, which can be affected by cloud cover. The results were checked against survey data collected by field inspectors and visually validated.

The data has been split into the Ordnance Survey Ceremonial Counties and each county is given a three letter code. Please refer to the CROME specification document to see which county each CODE label represents.`,
      owner: 'Rural Payments Agency',
      categories: ['Environment'],
      creationDate: '2020-12-15',
      updatedAt: '2025-07-28',
      updateFrequency: 'As needed',
      accessLevel: 'Open data',
      resolution: null,
      geographicExtent: 'England',
      coordinateReferenceSystem: 'British National Grid, EPSG:27700',
      licence: 'Open Government Licence',
      format: ['File geodatabase', 'GeoJSON', 'GeoPackage']
    },
    source: {
      type: 'fgb',
      url: `${BASE_URL}/crop_map_of_england/crome.fgb`,
      opacity: 0.5,
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
    label: 'Flood Map for Planning, Flood Zones 2 and 3',
    inspireTheme: 'Natural risk zones',
    // https://environment.data.gov.uk/dataset/04532375-a198-476e-985e-0579a0a11b47
    metadata: {
      id: '04532375-a198-476e-985e-0579a0a11b47',
      abstract: `The Flood Map for Planning Service includes several layers of information. This includes the Flood Zones data which shows the extent of land at present day risk of flooding from rivers and the sea, ignoring the benefits of defences, for the following scenarios:

• Flood Zone 1 – Land having a less than 0.1% (1 in 1000) annual probability of flooding. • Flood Zone 2 – Land having between 0.1% - 1% (1 in 100 to 1 in 1000) annual probability of flooding from rivers or between 0.1% - 0.5% (1 in 200 to 1 in 1000) annual probability of flooding from the sea, and accepted recorded flood outlines .

• Flood Zone 3 – Areas shown to be at a 1% (1 in 100) or greater annual probability of flooding from rivers or, 0.5% (1 in 200) or greater annual probability of flooding from the sea.

Flood Zone 1 is not shown in this dataset, but covers all areas not contained within Flood Zones 2 and 3. Local Planning Authorities (LPAs) use the Flood Zones to determine if they must consult the Environment Agency on planning applications. They are also used to determine if development is incompatible and whether development is subject to the exception test.

The Flood Zones are one of several flood risk datasets used to determine the need for planning applications to be supported by a Flood Risk Assessment (FRA) and subject to the sequential test.

The Flood Zones are a composite dataset including national and local modelled data, and information from past floods.

The Flood Zones are designed to only give an indication of flood risk to an area of land and are not suitable for showing whether an individual property is at risk of flooding. This is because we cannot know all the details about each property.

Users of these datasets should always check they are suitable for the intended use.

Please note, if downloading data for an area of interest, all polygons that intersect this area will be provided. Some polygons may be quite large and extend beyond the drawn area of interest. Any polygons that do not intersect the area of interest will not be provided. Please check your area of interest is sufficient or use the data feeds (e.g. WMS) to view the latest available data for all of England.`,
      owner: 'Environment Agency',
      categories: ['Environment', 'Inland waters', 'Oceans'],
      creationDate: '2025-01-29',
      updatedAt: '2026-05-20',
      updateFrequency: 'As needed',
      accessLevel: 'Open data',
      resolution: null,
      geographicExtent: 'England',
      coordinateReferenceSystem: 'British National Grid, EPSG:27700',
      licence: 'Open Government Licence',
      format: ['File geodatabase', 'GeoJSON', 'GeoPackage']
    },
    source: {
      type: 'fgb',
      url: `${BASE_URL}/flood_map_for_planning_flood_zones/flood_map_for_planning.fgb`,
      opacity: 0.5,
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
    label: 'Risk of Flooding from Surface Water',
    inspireTheme: 'Natural risk zones',
    // https://environment.data.gov.uk/dataset/b5aaa28d-6eb9-460e-8d6f-43caa71fbe0e
    metadata: {
      id: 'b5aaa28d-6eb9-460e-8d6f-43caa71fbe0e',
      abstract: `Risk of Flooding from Surface Water (RoFSW) map is an assessment of where surface water flooding may occur when rainwater does not drain away through the normal drainage systems or soak into the ground, but lies on or flows over the ground instead. It is produced using national scale modelling and enhanced with compatible, locally produced modelling from lead local flood authorities (LLFAs). The RoFSW datasets include information about flooding extents, depths, speed and hazards.

This dataset shows information about flooding extents and depths. The depth of water during a flood is an important factor in how dangerous a flood might be.

RoFSW is a probabilistic product, meaning that it shows the overall risk, rather than the risk associated with a specific event or scenario. In externally published versions of this dataset, risk is displayed as one of three likelihood bandings:

High - greater than or equal to 3.3% (1 in 30) chance in any given year; Medium - less than 3.3% (1 in 30) but greater than or equal to 1% (1 in 100) chance in any given year; Low - less than 1% (1 in 100) but greater than or equal to 0.1% (1 in 1000) chance in any given year.

This dataset shows the likelihood of a flood occurring with water at a given depth (or higher). There are separate layers with thresholds for depths of 0m (i.e. flooding extent), 0.2m, 0.3m, 0.6m, 0.9m, and 1.2m.

NB. This is a complex dataset, with preview available only on certain zoom levels. The Web Mapping service has been set to 1:50 000 in the <MaxScaleDenominator> attribute. The services are set to be visible from the 1:50 000 scale range. There may be some variation, since end client software may interpret the request differently.`,
      owner: 'Environment Agency',
      categories: ['Environment', 'Inland waters'],
      creationDate: '2024-10-30',
      updatedAt: '2025-09-17',
      updateFrequency: 'As needed',
      accessLevel: 'Open data',
      resolution: null,
      geographicExtent: 'England',
      coordinateReferenceSystem: 'British National Grid, EPSG:27700',
      licence: 'Open Government Licence',
      format: []
    },
    source: {
      type: 'fgb',
      url: `${BASE_URL}/risk_of_flooding_surface_water/rofsw.fgb`,
      opacity: 0.5,
      styleConfig: rofswStyle,
      minZoom: 7
    }
  }
]
