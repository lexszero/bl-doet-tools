import type { Component } from "svelte";
import type {Geometry} from "geojson";
import type {LayerData, Props} from "./LayerData.svelte";
import type {BasicLayerDisplayOptions, LayerController} from "./LayerController.svelte";
import type {IconType} from "$lib/Icons";
import type {Constructor} from "$lib/utils/types";

export type LayerProps = {
  id: string;
  name: string;
  order: number;
  icon: IconType;
}

export type Layer<
  LD extends LayerData<Geometry, Props>,
  LC extends LayerController<Geometry, Props, BasicLayerDisplayOptions>
  > = LayerProps & {
  Data: Constructor<LD>;
  Controller: Constructor<LC>;
  DisplayOptions?: Component;
  FeatureDetails?: Component;
}
