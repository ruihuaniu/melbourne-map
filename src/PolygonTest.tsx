import React, { useEffect, useRef } from 'react';
import { melbourneSuburbs } from './constant';
import { suburbGeoJsonMap } from './geoData';

export const PolygonTest: React.FC = () => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Initialize the map centered on Melbourne
    mapRef.current = window.L.map(mapContainerRef.current).setView([-37.8136, 144.9631], 10);
    
    // Add OpenStreetMap tiles
    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(mapRef.current);

    // Test with Hallam suburb
    testSuburb('Hallam');

    // Cleanup function
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  const testSuburb = (suburbName: string) => {
    if (!mapRef.current) return;

    // Clear previous layer
    if (layerRef.current) {
      mapRef.current.removeLayer(layerRef.current);
      layerRef.current = null;
    }

    const cacheKey = `suburb_${suburbName.toLowerCase().replace(/\s+/g, '_')}`;
    console.log(`Testing suburb: ${suburbName} (cache key: ${cacheKey})`);

    // Get the suburb data
    const suburb = melbourneSuburbs.find(s => s.name === suburbName);
    if (!suburb) {
      console.error(`Suburb not found: ${suburbName}`);
      return;
    }

    // Try to get GeoJSON from pre-fetched data
    const geojsonStr = suburbGeoJsonMap[cacheKey];
    if (!geojsonStr) {
      console.error(`No GeoJSON data found for ${suburbName}`);
      return;
    }

    try {
      const geojson = JSON.parse(geojsonStr);
      console.log(`GeoJSON for ${suburbName}:`, geojson);
      
      // Check if coordinates are in the correct format
      if (geojson.coordinates && geojson.coordinates[0] && geojson.coordinates[0][0]) {
        console.log('First coordinate point:', geojson.coordinates[0][0]);
      }

      // Create a layer with the GeoJSON
      const layer = window.L.geoJSON(geojson, {
        style: {
          color: '#3388ff',
          weight: 3,
          opacity: 1,
          fillColor: '#3388ff',
          fillOpacity: 0.2
        },
        onEachFeature: (feature, layer) => {
          layer.bindPopup(`<b>${suburbName}</b><br>Type: ${feature.geometry.type}`);
        }
      });

      layer.addTo(mapRef.current);
      layerRef.current = layer;

      // Fit the map to the layer bounds
      mapRef.current.fitBounds(layer.getBounds());
      
      console.log(`Successfully added ${suburbName} to the map`);
    } catch (error) {
      console.error(`Error rendering ${suburbName}:`, error);
    }
  };

  return (
    <div style={{ width: '100%', height: '600px' }}>
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
      <div style={{ marginTop: '10px' }}>
        <button onClick={() => testSuburb('Hallam')}>Test Hallam</button>
        <button onClick={() => testSuburb('Melbourne')}>Test Melbourne</button>
        <button onClick={() => testSuburb('Richmond')}>Test Richmond</button>
      </div>
    </div>
  );
};

export default PolygonTest;
