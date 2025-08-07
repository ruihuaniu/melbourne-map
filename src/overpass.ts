import { Suburb } from './constant';

export interface OverpassResponse {
  elements: Array<{
    type: string;
    id: number;
    tags: {
      [key: string]: string;
    };
    geometry?: Array<{
      lat: number;
      lon: number;
    }>;
  }>;
}

export interface SuburbBoundary {
  type: 'Feature';
  geometry: {
    type: 'Polygon';
    coordinates: number[][][];
  };
  properties: {
    name: string;
  };
}

export const fetchSuburbBoundary = async (suburb: Suburb): Promise<SuburbBoundary | null> => {
  try {
    // Define the search area for Greater Melbourne to constrain the search
    const searchArea = `area["name"="Greater Melbourne"]["boundary"="administrative"]["admin_level"="4"]->.searchArea;`;

    // Try multiple queries to find the suburb boundary
    const queries = [
      // Query for relation by suburb name within Greater Melbourne
      `[out:json];${searchArea}(relation["name"="${suburb.name}"]["admin_level"="10"](area.searchArea););out geom;`,
      // Query for relation by postcode within Greater Melbourne
      `[out:json];${searchArea}(relation["postal_code"="${suburb.postcode}"](area.searchArea););out geom;`,
      // Query for relation by suburb name within its council area
      `[out:json];area["name"="${suburb.council}"]->.councilArea;(relation["name"="${suburb.name}"](area.councilArea););out geom;`,
    ];

    for (const query of queries) {
      const response = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
      const data = await response.json() as OverpassResponse;

      if (data.elements.length > 0) {
        const element = data.elements[0];
        if (element.geometry) {
          // Convert Overpass response to GeoJSON format
          const coordinates = element.geometry.map(point => [point.lon, point.lat]);
          return {
            type: 'Feature',
            geometry: {
              type: 'Polygon',
              coordinates: [coordinates]
            },
            properties: {
              name: suburb.name
            }
          };
        }
      }
    }

    // If no boundary found, return null
    return null;
  } catch (error) {
    console.error(`Error fetching boundary for ${suburb.name}:`, error);
    return null;
  }
};
