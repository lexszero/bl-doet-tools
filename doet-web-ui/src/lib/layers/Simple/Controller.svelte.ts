import {SvelteMap, SvelteSet} from "svelte/reactivity";
import type {Geometry} from "geojson";
import type {Feature} from "$lib/utils/geojson";

import {LayerController, type BasicLayerDisplayOptions, type LayerControllerOptions} from "../LayerController.svelte";
import {LayerData, type Props} from "../LayerData.svelte";
import DisplayOptions from "./DisplayOptions.svelte";

export type SimpleFeature = Feature<Geometry, Props>;

export class SimpleLayerData extends LayerData<Geometry, Props> {};

export interface SimpleDisplayOptions extends BasicLayerDisplayOptions {
  types?: string[];
}

export class SimpleLayerController extends LayerController<Geometry, Props, SimpleDisplayOptions> {

  DisplayOptionsComponent = DisplayOptions;

  constructor(mapRoot: L.Map, data: SimpleLayerData, options: LayerControllerOptions<SimpleDisplayOptions>) {
    super(mapRoot, data, {
      ...options,
      defaultDisplayOptions: {
        ...options.defaultDisplayOptions,
        types: []
      }
    });
  }

  public features: SvelteMap<string, SimpleFeature> = $derived(
    this.displayOptions.types
    ? new SvelteMap<string, Feature<G, P>>(
      this.data.features.entries().filter(([_id, f]: [string, SimpleFeature]) => {
        const t = f.properties?.type;
        if (!t || !this.displayOptions.types)
          return true;
        return this.displayOptions.types.indexOf(t) >= 0;
      })
    )
    : this.data.features
  );

  featureTypes: string[] = $derived.by(() => {
    const result: string[] = [];
    for (const f of this.data.features.values()) {
      const t = f.properties.type;
      if (!t)
        continue;
      if (result.indexOf(t) < 0)
        result.push(t);
    };
    console.debug(`${this.id}: featureTypes `, result);
    return result;
  });
}

export default SimpleLayerController;
