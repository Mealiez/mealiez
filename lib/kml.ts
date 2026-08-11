export interface KMLPlacemark {
  name: string;
  description?: string;
  geometry_type: 'POINT_RADIUS' | 'POLYGON';
  latitude?: number;
  longitude?: number;
  geometry?: string; // WKT Polygon string or simple format
  isValid: boolean;
  error?: string;
}

/**
 * Basic KML parser that extracts Placemarks.
 * In a production environment, you should use a robust parser like @tmcw/togeojson
 * combined with standard DOMParser (if in browser) or xmldom (if in node).
 */
export function parseKML(kmlText: string): KMLPlacemark[] {
  const placemarks: KMLPlacemark[] = [];
  
  // Very basic regex-based extraction for MVP demonstration.
  const placemarkRegex = /<Placemark>([\s\S]*?)<\/Placemark>/g;
  let match;

  while ((match = placemarkRegex.exec(kmlText)) !== null) {
    const block = match[1];
    
    // Extract name
    const nameMatch = /<name>(.*?)<\/name>/.exec(block);
    const name = nameMatch ? nameMatch[1].trim() : `Channel-${Math.floor(Math.random() * 10000)}`;
    
    // Check for Point
    const pointMatch = /<Point>[\s\S]*?<coordinates>(.*?)<\/coordinates>[\s\S]*?<\/Point>/.exec(block);
    if (pointMatch) {
      const coords = pointMatch[1].trim().split(',');
      if (coords.length >= 2) {
        placemarks.push({
          name,
          geometry_type: 'POINT_RADIUS',
          longitude: parseFloat(coords[0]),
          latitude: parseFloat(coords[1]),
          isValid: true
        });
        continue;
      }
    }

    // Check for Polygon
    const polygonMatch = /<Polygon>[\s\S]*?<coordinates>(.*?)<\/coordinates>[\s\S]*?<\/Polygon>/.exec(block);
    if (polygonMatch) {
      const coordsString = polygonMatch[1].trim();
      const coordPairs = coordsString.split(/\s+/).map(pair => {
        const [lon, lat] = pair.split(',');
        return `${lon} ${lat}`;
      });
      
      if (coordPairs.length >= 4) { // Valid polygon needs at least 4 points
        const wkt = `POLYGON((${coordPairs.join(', ')}))`;
        placemarks.push({
          name,
          geometry_type: 'POLYGON',
          geometry: wkt,
          isValid: true
        });
        continue;
      }
    }

    // Invalid or unsupported geometry
    placemarks.push({
      name,
      geometry_type: 'POINT_RADIUS',
      isValid: false,
      error: 'Unsupported or invalid geometry found'
    });
  }

  return placemarks;
}
