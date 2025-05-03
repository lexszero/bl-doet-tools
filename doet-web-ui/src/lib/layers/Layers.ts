import PowerGridLayer from "./PowerGrid";
import PowerAreasLayer from "./PowerAreas";
import PlacementLayer from "./Placement";
import type {UnionOfValues} from "$lib/utils/types";

export const LayerTemplates = {
  power_areas: PowerAreasLayer,
  power_grid: PowerGridLayer,
  placement: PlacementLayer
}

export const LayerTemplatesOrdered = Object.values(LayerTemplates).toSorted((a, b) => (a.order - b.order));

export type LayerTemplatesT = typeof LayerTemplates;
export type LayerID = keyof LayerTemplatesT;

type layersData = {
  [ prop in LayerID ]: InstanceType<typeof LayerTemplates[prop]["Data"]>
}
export type AnyLayerData = UnionOfValues<layersData>;

export type LayersData = Partial<layersData>;

type layersControllers = {
  [ prop in LayerID ]: InstanceType<typeof LayerTemplates[prop]["Controller"]>
}
export type AnyLayerController = UnionOfValues<layersControllers>;
