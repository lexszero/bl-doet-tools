import L from 'leaflet';

export function distance(p1: L.LatLngExpression, p2: L.LatLngExpression) {
  return L.CRS.Earth.distance(p1, p2);
}
