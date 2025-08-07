import React, { useState, useEffect, useRef } from 'react';
import { melbourneSuburbs, suburbColors, } from './constant';
import { fetchSuburbBoundary } from './overpass';
import { suburbGeoJsonMap } from './geoData';


export interface Suburb {
  name: string;
  postcode: number;
  population: number;
  area: number;
  lat: number;
  lng: number;
}

declare global {
  interface Window {
    L: any;
  }
}

const GEOJSON_CACHE_VERSION = 'v1';
const GEOJSON_CACHE_PREFIX = 'melb_suburb_geojson_';

const getCacheKey = (suburbName: string) => `${GEOJSON_CACHE_PREFIX}${GEOJSON_CACHE_VERSION}_${suburbName}`;

const MelbourneSuburbsMap = () => {
  const [mapReady, setMapReady] = useState(false);
  const [selectedSuburb, setSelectedSuburb] = useState<Suburb | null>(null);
  const [hoveredSuburb, setHoveredSuburb] = useState<Suburb | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadedSuburbs, setLoadedSuburbs] = useState<Suburb[]>([]);
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);
  const suburbLayersRef = useRef<{[key: string]: any}>({});



  useEffect(() => {
    const initializeMap = async () => {
      // Load Leaflet CSS and JS
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
      document.head.appendChild(link);

      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
      script.onload = () => {
        if (window.L && mapRef.current) {
          // Initialize the map
          const map = window.L.map(mapRef.current, {
            center: [-37.8136, 144.9631], // Melbourne CBD
            zoom: 11,
            scrollWheelZoom: true,
            zoomControl: true
          });

          // Add OpenStreetMap tiles
          window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 18
          }).addTo(map);

          leafletMapRef.current = map;
          setMapReady(true);
          loadSuburbData();
        }
      };
      document.head.appendChild(script);
    };

    initializeMap();

    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
      }
    };
  }, []);

  const loadSuburbData = async () => {
    if (!leafletMapRef.current) return;

    setLoading(true);
    const loaded: Suburb[] = [];

    for (const suburb of melbourneSuburbs) {
      const cacheKey = getCacheKey(suburb.name);
      const color = suburbColors[melbourneSuburbs.indexOf(suburb) % suburbColors.length];

      // First check if we have cached geo data
      let geojson: any = null;
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          geojson = JSON.parse(cached);
        }
      } catch (e) {
        // Ignore cache errors
      }

      // If not in localStorage, check suburbGeoJsonMap
      if (!geojson && suburbGeoJsonMap[cacheKey] && Object.keys(suburbGeoJsonMap[cacheKey]).length > 0) {
        geojson = JSON.parse(suburbGeoJsonMap[cacheKey]);
        try {
          localStorage.setItem(cacheKey, JSON.stringify(geojson));
        } catch (e) {
          // Ignore cache errors
        }
      }

      // Create either a boundary layer or a circle marker
      let layer: any;
      if (geojson) {
        layer = window.L.geoJSON(geojson, {
          style: {
            color: color,
            weight: 2,
            opacity: 0.8,
            fillColor: color,
            fillOpacity: 0.3
          }
        });
      } else {
        layer = window.L.circleMarker([suburb.lat, suburb.lng], {
          radius: Math.max(5, Math.min(15, suburb.population / 3000)),
          color: color,
          weight: 2,
          opacity: 0.8,
          fillColor: color,
          fillOpacity: 0.2
        });
      }

      // Add event handlers only for non-Melbourne suburbs
      if (suburb.name !== 'Melbourne') {
        layer.on('mouseover', () => {
          setHoveredSuburb(suburb);
          layer.setStyle({ fillOpacity: 0.7, weight: 3 });
        });

        layer.on('mouseout', () => {
          layer.setStyle({
            fillOpacity: geojson ? 0.3 : 0.2,
            weight: 2
          });
        });

        layer.on('click', async () => {
          const isSelected = selectedSuburb?.name === suburb.name;
          setSelectedSuburb(isSelected ? null : suburb);
          
          // Only fetch boundary data if suburb is selected and we don't have cached data
          if (!isSelected && !geojson) {
            try {
              //const boundaryGeoJson = await fetchSuburbBoundary(suburb);
              const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(suburb.name + ', Melbourne, Victoria, Australia')}&polygon_geojson=1&limit=1`
              );
              const data = await response.json();
              const boundaryGeoJson = data?.[0]?.geojson;
              if (boundaryGeoJson) {
                geojson = boundaryGeoJson;
                // Save to cache
                try {
                  localStorage.setItem(cacheKey, JSON.stringify(geojson));
                } catch (e) {
                  // Ignore cache errors
                }

                // Remove existing layer and create new boundary layer
                if (suburbLayersRef.current[suburb.name]) {
                  suburbLayersRef.current[suburb.name].remove();
                }

                const newLayer = window.L.geoJSON(geojson, {
                  style: {
                    color: color,
                    weight: 2,
                    opacity: 0.8,
                    fillColor: color,
                    fillOpacity: 0.6
                  }
                });

                newLayer.addTo(leafletMapRef.current);
                suburbLayersRef.current[suburb.name] = newLayer;
              }
            } catch (error) {
              console.warn(`Failed to load boundary for ${suburb.name}:`, error);
              // Remove boundary layer if it exists
              // if (suburbLayersRef.current[suburb.name]) {
              //   suburbLayersRef.current[suburb.name].remove();
              //   delete suburbLayersRef.current[suburb.name];
              // }
            }
          } else if (suburbLayersRef.current[suburb.name]) {
            // Remove boundary layer when suburb is deselected
          //suburbLayersRef.current[suburb.name].remove();
          //delete suburbLayersRef.current[suburb.name];
          }
        });
      }

      // Add the layer to the map
      layer.addTo(leafletMapRef.current);
      suburbLayersRef.current[suburb.name] = layer;

      loaded.push(suburb);
    }

    setLoadedSuburbs(loaded);
    setLoading(false);
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  const getDensity = (suburb: Suburb) => {
    return Math.round(suburb.population / suburb.area);
  };

  return (
    <div className="w-full h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-2 sm:p-4">
      <div className="max-w-7xl mx-auto h-full">
        <div className="bg-white sm:rounded-xl shadow-lg h-full flex flex-col">
          <div className="p-6 border-b border-gray-200">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">
              Melbourne Suburbs Interactive Map
            </h1>

            {loading && (
              <div className="mt-2 text-sm text-blue-600 flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                Loading suburb boundaries... ({loadedSuburbs.length}/{melbourneSuburbs.length})
              </div>
            )}
          </div>
          
          <div className="flex-1 flex flex-col lg:flex-row">
            {/* Map Area */}
            <div className="flex-1 relative">
              <div 
                ref={mapRef} 
                className="w-full h-full rounded-l-lg"
                style={{ minHeight: '500px' }}
              />
              
              {/* Hover tooltip */}
              {hoveredSuburb && (
                <div className="absolute top-4 left-4 bg-white p-3 rounded-lg shadow-lg border border-gray-200 z-[1000] max-w-xs">
                  <h3 className="font-bold text-gray-800 text-sm">
                    {hoveredSuburb.name}
                  </h3>
                  <div className="text-xs text-gray-600 space-y-1 mt-1">
                    <p>Population: {formatNumber(hoveredSuburb.population)}</p>
                    <p>Area: {hoveredSuburb.area} km²</p>
                    <p>Density: {formatNumber(getDensity(hoveredSuburb))} /km²</p>
                    <p>Postcode: {hoveredSuburb.postcode}</p>
                  </div>
                </div>
              )}
            </div>
            
            {/* Info Panel - only render if a suburb is selected */}
            {selectedSuburb && (
            <div className={`w-full lg:w-80 border-t lg:border-l lg:border-t-0 border-gray-200 bg-gray-50 transition-all duration-300 ease-in-out p-6 h-1/2 lg:h-auto overflow-y-auto`}>
              <h2 className="text-xl font-semibold mb-4 text-gray-800">
                Suburb Details
              </h2>
              
              {selectedSuburb ? (
                <div className="space-y-4">
                  <div className="bg-white p-4 rounded-lg shadow-sm">
                    <h3 className="text-lg font-bold text-gray-800 mb-3">
                      {selectedSuburb.name}
                    </h3>
                    
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Population:</span>
                        <span className="font-medium">
                          {formatNumber(selectedSuburb.population)}
                        </span>
                      </div>
                      
                      <div className="flex justify-between">
                        <span className="text-gray-600">Area:</span>
                        <span className="font-medium">
                          {selectedSuburb.area} km²
                        </span>
                      </div>
                      
                      <div className="flex justify-between">
                        <span className="text-gray-600">Density:</span>
                        <span className="font-medium">
                          {formatNumber(getDensity(selectedSuburb))} /km²
                        </span>
                      </div>
                      
                      <div className="flex justify-between">
                        <span className="text-gray-600">Postcode:</span>
                        <span className="font-medium">
                          {selectedSuburb.postcode}
                        </span>
                      </div>
                      
                      <div className="pt-3 border-t border-gray-200">
                        <div className="text-xs text-gray-500">
                          <p>Coordinates:</p>
                          <p>{selectedSuburb.lat.toFixed(4)}, {selectedSuburb.lng.toFixed(4)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white p-4 rounded-lg shadow-sm">
                    <h4 className="font-semibold text-gray-700 mb-2">Population Rank</h4>
                    <p className="text-sm text-gray-600">
                      #{melbourneSuburbs
                        .sort((a, b) => b.population - a.population)
                        .findIndex(s => s.name === selectedSuburb.name) + 1} 
                      {' '}most populated suburb
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-gray-500 text-center py-8">
                  <p>Click on a suburb to see details</p>
                </div>
              )}
            </div>
            )}
          </div>
          <div className="p-4 border-t border-gray-200 text-center text-xs text-gray-500">
            <p>Real suburb boundaries from OpenStreetMap • Population data from ABS 2023-24 estimates</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MelbourneSuburbsMap; 