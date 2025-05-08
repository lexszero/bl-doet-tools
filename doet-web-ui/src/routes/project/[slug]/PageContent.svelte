<script lang="ts">
  import { browser } from '$app/environment'
  import { setContext } from 'svelte';

  import { ProjectAPI, type MapOptions } from '$lib/api_project';
  import { ProjectData } from '$lib/ProjectData.svelte';
  import { type MapContentInterface } from '$lib/MapContent.svelte';
  import { TimeRange } from '$lib/utils/misc';
  
  import AppBar from './AppBar.svelte';
  import Map from './Map.svelte';

  let {
    project,
    view = 'default',
    timeRange = $bindable(new TimeRange()),
  }: {
    project: string,
    view: string,
    timeRange: TimeRange,
  } = $props();

  let showAppBar: boolean = $state(false);

  let api = new ProjectAPI(project);
  setContext('api', api);

  let data = new ProjectData();
  setContext(ProjectData, data);

  let map: MapContentInterface | undefined = $state();
  $effect(() => {
    setContext('Map', map);
  })

</script>

<AppBar bind:timeRange={timeRange} />

{#if browser}
  {#await data.loadView(view, timeRange.start, timeRange.end)}
  <h1>Loading...</h1>
  {:then}
    <Map
      bind:content={map}
      timeRange={timeRange} />
  {/await}
{/if}
