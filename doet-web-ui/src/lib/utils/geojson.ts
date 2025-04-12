import type {
  Feature as GJFeature,
  FeatureCollection as GJFeatureCollection,
  Geometry,
} from 'geojson';

export interface Feature<G extends Geometry, P> extends GJFeature<G, P> {
  id: string;
}

export interface FeatureCollection<G extends Geometry, P> extends GJFeatureCollection<G, P> {
  features: Array<Feature<G, P>>;
}
