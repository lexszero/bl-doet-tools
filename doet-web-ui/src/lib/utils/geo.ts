import type {Position} from 'geojson';
import L from 'leaflet';
import './geo_contains.js';

export function distance(p1: L.LatLngExpression, p2: L.LatLngExpression) {
  return L.CRS.Earth.distance(p1, p2);
}

const SamePointTolerance = 1;

export function isSamePoint(a: L.LatLng, b: L.LatLng): boolean {
  return distance(a, b) < SamePointTolerance;
}

export function coordsToLatLng(p: Position) {
  return L.GeoJSON.coordsToLatLng(p as [number, number]);
}

export function coordsToLatLngs(p: Position[]) {
  return L.GeoJSON.coordsToLatLngs(p as [number, number][]);
}

export function latLngToCoords(p: L.LatLng) {
  return L.GeoJSON.latLngToCoords(p)
}

// ringArea function copied from geojson-area
// (https://github.com/mapbox/geojson-area)
// This function is distributed under a separate license,
// see LICENSE.md.
export function ringArea(coords: L.LatLng[]) {
  const EARTH_RADIUS = 6378137;
  const rad = function rad(_: number) {
    return _ * Math.PI / 180;
  };

  const coordsLength = coords.length;
  let p1, p2, p3, lowerIndex, middleIndex, upperIndex,
    area = 0;

  if (coordsLength > 2) {
    for (let i = 0; i < coordsLength; i++) {
      if (i === coordsLength - 2) { // i = N-2
        lowerIndex = coordsLength - 2;
        middleIndex = coordsLength - 1;
        upperIndex = 0;
      } else if (i === coordsLength - 1) { // i = N-1
        lowerIndex = coordsLength - 1;
        middleIndex = 0;
        upperIndex = 1;
      } else { // i = 0 to N-3
        lowerIndex = i;
        middleIndex = i + 1;
        upperIndex = i + 2;
      }
      p1 = coords[lowerIndex];
      p2 = coords[middleIndex];
      p3 = coords[upperIndex];
      area += (rad(p3.lng) - rad(p1.lng)) * Math.sin(rad(p2.lat));
    }

    area = area * EARTH_RADIUS * EARTH_RADIUS / 2;
  }

  return Math.abs(area);
};

export { L };
