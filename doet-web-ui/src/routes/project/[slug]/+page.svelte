<script lang="ts">
  import { onMount } from 'svelte';
  import type { PageProps } from './$types';
  import PowerGridMap from './PowerGridMap.svelte';
  import { Segment, Slider, Switch } from '@skeletonlabs/skeleton-svelte';
  import { API } from '$lib/api';
  import { fromUnixTime, getUnixTime } from "date-fns";

  let props: PageProps = $props();
  let timestampSlider = $state(getUnixTime(Date()));
  let timestampData = $state(null);

  let api = new API(props.data.project_name);
  let data = $derived.by(() => {
    return {
      powerAreas: api.getPowerAreasGeoJSON(timestampData),
      powerGrid: api.getPowerGridGeoJSON(timestampData),
      placementEntities: api.getPlacementEntitiesGeoJSON(timestampData),
    }
  });
  function reload() {
    timestampData = fromUnixTime(timestampSlider);
  }
</script>

{#snippet sliderMark()}
  
{/snippet}

<div class="flex flex-col gap-4 w-screen h-screen">
  <div class="flex justify-between items-center gap-4 h-10">
  {#await api.getChangeTimestamps()}
  {:then info}
    <p>Time travel</p>
    <Slider name='TimeTravel'
      value={[timestampSlider]}
      markers={info.timestamps}
      onValueChange={(e) => (timestampSlider = e.value[0])}
      onValueChangeEnd={reload}
      min={Math.min.apply(null, info.timestamps)}
      max={Math.max(Math.max.apply(null, info.timestamps), getUnixTime(Date()))}
    />
  {/await}
  </div>
  <PowerGridMap data={data} />
</div>
