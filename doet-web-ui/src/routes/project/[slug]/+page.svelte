<script lang="ts">
  import { browser } from '$app/environment'
  import { onMount } from 'svelte';
  import type { PageProps } from './$types';
  import PowerGridMap from './PowerGridMap.svelte?client';
  import TimeTravelSlider from './TimeTravelSlider.svelte';
  import { API } from '$lib/api';
  import { fromUnixTime, getUnixTime } from "date-fns";

  let props: PageProps = $props();
  let timeStart = $state(null);
  let timeEnd = $state(null);

  let api = new API(props.data.project_name);
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
  {#if browser}
    <PowerGridMap api={api} timeStart={timeStart} timeEnd={timeEnd}/>
  {/if}
</div>


