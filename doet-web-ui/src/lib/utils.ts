import type {Position} from 'geojson';
import L from 'leaflet';

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
