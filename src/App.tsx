import React from 'react';
import MelbourneSuburbsMap from './MelbourneSuburbsMap';
import { PolygonTest } from './PolygonTest';

const App = () => {
  // Switch between the main app and the test component as needed
  const debugMode = false; // Set to false to see the original map

  return debugMode ? <PolygonTest /> : <MelbourneSuburbsMap />;
};

export default App;