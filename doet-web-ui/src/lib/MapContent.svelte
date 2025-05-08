<script module lang="ts">
import { type Feature } from '$lib/utils/geojson';
import type { Props } from './layers/LayerData.svelte.ts';
import type {Geometry} from 'geojson';

export interface MapContentInterface {
  getFeature: ((id?: string) => Feature<Geometry, Props> | undefined);
  selectFeature: ((id: string) => void);
  resetSelectedFeature: (() => void);
  getSelectedFeature: (() => string | undefined);
  highlightFeature: ((id: string) => void);
  resetHighlight: (() => void);
  getCurrentDisplayOptions: (() => MapDisplayOptionsDTO);
};
</script>

<script lang="ts">
  import { onMount, getContext } from 'svelte';
  import L from 'leaflet';
  import { TileLayer } from 'sveaflet';

  import { ProjectData } from '$lib/ProjectData.svelte';
  import FeatureLayer from './layers/FeatureLayer.svelte';
  import FeatureDetails from './layers/FeatureDetails.svelte';

  import { type MapDisplayOptionsDTO } from '$lib/layers/types';
  import type {AnyLayerController} from './layers/Layers.js';

  let {
    mapRoot,
    instance = $bindable(),
    displayOptions,
  }: {
    mapRoot: L.Map,
    instance: MapContentInterface,
    displayOptions?: MapDisplayOptionsDTO,
  } = $props();

  const data = getContext<ProjectData>(ProjectData);

  export function onClick(e: L.LeafletMouseEvent) {
    if (!instance)
      return;
    const layer = e.propagatedFrom;
    if (!layer) {
      instance.resetSelectedFeature();
    } else {
      for (const ctl of data.allControllers) {
        if (ctl.layerSelected && layer.feature?.id != ctl.layerSelected.feature.id)
          ctl.resetSelectedFeature();
      }
    }
  }

  let layerBasemap: L.TileLayer | undefined = $state();
 
  mapRoot.on('click', onClick);

  const layerControllerOptions = {
    onClick: onClick
  };

  onMount(() => {
    console.debug("MapContent displayOptions: ", displayOptions);
    instance = {
      getFeature(id?: string) {
        if (!id)
          return;
        for (const l of data.allLayers) {
          if (l.features.has(id))
            return l.features.get(id);
        }
      },
      selectFeature(id: string) {
        data.getControllerFor(id)?.selectFeature(id, true);
      },
      resetSelectedFeature() {
        for (const ctl of data.allControllers) {
          ctl.resetSelectedFeature();
        }
      },
      getSelectedFeature(): string | undefined {
        for (const ctl of data.allControllers) {
          if (ctl.layerSelected) {
            return ctl.layerSelected.feature.id;
          }
        }
      },
      highlightFeature(id: string) {
        data.getControllerFor(id)?.highlightFeature(id);
      },
      resetHighlight() {
        details.ctl?.resetHighlightedFeature();
      },
      getCurrentDisplayOptions() {
        return Object.fromEntries(
          Object.entries(data.layers).map(
            ([name, d]) => ([name, d.ctl?.getDisplayOptions()])
          ));
      }
    };
    if (displayOptions?.selected) {
      instance.selectFeature(displayOptions.selected);
    }
  });

  interface LayerItem {
    show: boolean;
    ctl?: AnyLayerController;
    feature?: Feature<Geometry, Props>;
  }

  let details = $derived.by(() => {
    let priority = 0;
    let result: LayerItem = {show: false};
    if (!instance)
      return result;
    for (const ctl of data.allControllers) {
      if (ctl.layerHighlighted && ctl.options.priorityHighlight > priority) {
        result = {show: true, ctl: ctl, feature: ctl.layerHighlighted.feature};
        priority = ctl.options.priorityHighlight;
      }
      if (ctl.layerSelected && ctl.options.prioritySelect > priority) {
        result = {show: true, ctl: ctl, feature: ctl.layerSelected.feature};
        priority = ctl.options.prioritySelect;
      }
    }
    return result;
  });
</script>

<TileLayer bind:instance={layerBasemap} url={"https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"} />

{#key data.layers}
  {#each data.allLayers as layer}
    <FeatureLayer
      mapRoot={mapRoot}
      layer={layer}
      options={{
        ...layerControllerOptions,
        initDisplayOptions: displayOptions?.[layer.id]
    }} />
  {/each}
{/key}

{#if details.show && details.ctl}
  <FeatureDetails ctl={details.ctl} feature={details.feature} />
{/if}
