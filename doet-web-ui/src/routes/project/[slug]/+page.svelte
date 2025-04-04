<script lang="ts">
  import { onMount } from 'svelte';
  import type { PageProps } from './$types';
  import PowerGridMap from './PowerGridMap.svelte';
  import TimeTravelSlider from './TimeTravelSlider.svelte';
  import { API } from '$lib/api';
  import { fromUnixTime, getUnixTime } from "date-fns";

  let props: PageProps = $props();
  let timeStart = $state(null);
  let timeEnd = $state(null);

  let api = new API(props.data.project_name);
  let data = $derived.by(() => {
    return {
      powerAreas: api.getPowerAreasGeoJSON(timeStart, timeEnd),
      powerGrid: api.getPowerGridGeoJSON(timeStart, timeEnd),
      placementEntities: api.getPlacementEntitiesGeoJSON(timeStart, timeEnd),
    }
  });
  function sliderMouseWheel(e) {
    console.log(e)
  }
</script>

<div class="flex flex-col gap-4 w-screen h-screen">
  <div class="flex justify-between items-center gap-4 h-10" onmousewheel={sliderMouseWheel}>
  {#await api.getChangeTimestamps()}
  {:then info}
    <TimeTravelSlider
      bind:timeStart={timeStart}
      bind:timeEnd={timeEnd}
      markers={info.timestamps}
    />
  {/await}
  </div>
  <PowerGridMap data={data} />
</div>
