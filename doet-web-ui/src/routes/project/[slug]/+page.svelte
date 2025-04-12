<script lang="ts">
  import { browser } from '$app/environment'
  import { setContext } from 'svelte';
  import type { PageProps } from './$types';

  import { AppBar, Combobox } from '@skeletonlabs/skeleton-svelte';
  import PopoverInfoBox from '$lib/controls/PopoverInfoBox.svelte';
  import PropertiesTable from '$lib/controls/PropertiesTable.svelte';
  import WarningsTable from '$lib/controls/WarningsTable.svelte';
  import TimeTravelSlider from './TimeTravelSlider.svelte';

  import { API } from '$lib/api';
  import Map from './Map.svelte?client';
  import { type MapContentInterface } from '$lib/MapContent.svelte';
  import { PowerGridData } from '$lib/layers/PowerGrid/data.svelte?client';
  import DisplayOptions from '$lib/layers/DisplayOptions.svelte';

  import { IconPlacementEntity, IconWarning } from '$lib/Icons';
  import {
    History as IconHistory,
    Info as IconInfo,
    Layers as IconLayers,
  } from '@lucide/svelte';

  import { TimeRange, Severity, logLevelToColor } from '$lib/utils/misc';

  let props: PageProps = $props();

  let api = new API(props.data.project_name);
  let grid: PowerGridData | undefined;
  setContext('api', api);
  if (browser) {
    grid = new PowerGridData(api);
    setContext('PowerGridData', grid);
  }

  let map: MapContentInterface | undefined = $state();
  $effect(() => {
    setContext('Map', map);
  })

  let timeRange: TimeRange = $state(new TimeRange());
  let searchItems = $derived(Object.values(map?.layers || {}).reduce((all, layer) => ([...all, ...layer.searchItems]), []));
  let searchValue = $state();

  $inspect(timeRange);
</script>

<div class="flex flex-col w-screen h-screen">
  <AppBar background="bg-surface-200-800" padding='p-1'>
    {#snippet lead()}
      <PopoverInfoBox title="Time travel" positionerClasses="w-full p-4">
        {#snippet trigger()}<IconHistory/>{/snippet}
        {#snippet content()}
          <div class="flex justify-between items-center gap-4 h-10">
            {#await api.getChangeTimestamps()}
            {:then info}
              <TimeTravelSlider
                bind:timeRange={timeRange}
                markers={info.timestamps}
              />
            {/await}
          </div>
        {/snippet}
      </PopoverInfoBox>

      <Combobox
        data={searchItems}
        value={searchValue}
        onValueChange={(e) => map?.selectFeature(e.value[0])}
        placeholder="Search..."
        base="preset-outlined-surface-50-950 bg-surface-50-950",
        width="w-100"
        zIndex="1000"
      >
        {#snippet item(item)}
          {@const Icon = item.icon}
          <div class="flex grow w-150 justify-between space-x-2">
            <span>{@html item.label}</span>
            <Icon />
          </div>
        {/snippet}
      </Combobox>
    {/snippet}

    {#snippet trail()}
      {#if grid?.log?.length}
        {@const log = grid.log}
        <PopoverInfoBox title="Warnings"
          contentClasses="overflow-auto max-h-[500px]"
          positionerClasses="max-h-screen"
          >
          {#snippet trigger()}
          {#each [Severity.Error, Severity.Warning, Severity.Info] as severity}
            {@const count = log.filter((r) => (r.level == severity)).length}
            {#if count > 0}
              <div class={`flex flex-row text-${logLevelToColor(severity)}-500`}>
                <IconWarning />
                {count}
              </div>
            {/if}
          {/each}
          {/snippet}
          {#snippet content()}<WarningsTable items={grid?.log} />{/snippet}
        </PopoverInfoBox>
      {/if}
      
      <PopoverInfoBox title="Statistics">
        {#snippet trigger()}<IconInfo />{/snippet}
        {#snippet content()}
          <PropertiesTable items={map?.layers.PowerGrid.getStatistics()}
            onClickChip={(id) => map?.selectFeature(id)}
            onHoverChip={(id) => map?.highlightFeature(id)}
            />
        {/snippet}
      </PopoverInfoBox>

      <PopoverInfoBox title="Layers" contentClasses="min-w-lg">
        {#snippet trigger()}<IconLayers />{/snippet}
        {#snippet content()}
          <DisplayOptions map={map}/>
        {/snippet}
      </PopoverInfoBox>
    {/snippet}
  </AppBar>

  {#if browser}
    <Map
      bind:instance={map}
      timeRange={timeRange}/>
  {/if}
</div>

