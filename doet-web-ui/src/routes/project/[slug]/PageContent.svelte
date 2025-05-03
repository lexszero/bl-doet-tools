<script lang="ts">
  import { browser } from '$app/environment'
  import { setContext } from 'svelte';

  import { AppBar, Combobox, Switch, Tabs } from '@skeletonlabs/skeleton-svelte';
  import UserMenu from '$lib/controls/UserMenu.svelte';
  import PopoverInfoBox from '$lib/controls/PopoverInfoBox.svelte';
  import PropertiesTable from '$lib/controls/PropertiesTable.svelte';
  import WarningsTable from '$lib/controls/WarningsTable.svelte';
  import CopyURL from '$lib/controls/CopyURL.svelte';
  import TimeTravelSlider from './TimeTravelSlider.svelte';

  import { ProjectAPI } from '$lib/api_project';
  import { ProjectData } from '$lib/ProjectData.svelte';
  import Map from './Map.svelte';
  import { type MapContentInterface } from '$lib/MapContent.svelte';
  import DisplayOptions from '$lib/layers/DisplayOptions.svelte';

  import { IconWarning } from '$lib/Icons';
  import IconHistory from '@lucide/svelte/icons/history';
  import IconInfo from '@lucide/svelte/icons/info';
  import IconLayers from '@lucide/svelte/icons/layers';
  import IconLink from '@lucide/svelte/icons/link';

  import { TimeRange, Severity, logLevelToColor } from '$lib/utils/misc';
  import { type SearchboxItem } from '$lib/utils/types';

  import lz from 'lz-string';


  let {
    project,
    timeRange = $bindable(new TimeRange()),
  }: {
    project: string,
    timeRange: TimeRange,
  } = $props();

  let api = new ProjectAPI(project);
  setContext('api', api);

  let data = new ProjectData();
  setContext(ProjectData, data);

  $effect(async () => {
    if (timeRange)
      await data.loadView('default', timeRange.start, timeRange.end)
  });

  let map: MapContentInterface | undefined = $state();
  $effect(() => {
    setContext('Map', map);
  })

  let searchValue: string | undefined = $state(undefined);
  let searchItems: SearchboxItem[] = $derived(Object.values(data.layers).reduce(
    (all, layer) => ([...all, ...layer.ctl?.searchItems || []])
    , [] as SearchboxItem[]));


  let copyUrlWithSelected: boolean = $state(false);

  function getUrl(withSelected: boolean) {
    let url = new URL(window.location.toString());
    if (map) {
      const jsonOpts = JSON.stringify(map.getCurrentDisplayOptions());
      console.debug("current display opts: ", jsonOpts);
      url.searchParams.set('d', lz.compressToEncodedURIComponent(jsonOpts));
      const id = map.getSelectedFeature();
      console.log("getUrl: display opts: ", jsonOpts);
      console.log(`getUrl: withSelected: ${withSelected}, id: ${id}`);
      if (withSelected && id) {
        url.searchParams.set('selected', id)
      }
    }
    return url.toString();
  }

  let allWarnings = $derived(Object.values(data.warnings).reduce(
    (all, log) => all.concat(log), []
    ))
  let warningsDefaultTab = $derived.by(() => {
    for (const [name, log] of Object.entries(data.warnings)) {
      if (log.length > 0)
        return name;
    }
  });
  let warningsTab = $state('');
</script>

<AppBar background="bg-surface-200-800" padding='p-1'>
  {#snippet lead()}
    <UserMenu />

    <PopoverInfoBox title="Time travel"
      positionerClasses="w-full pr-4"
      contentClasses="flex flex-col justify-between items-center gap-4">
      {#snippet trigger()}<IconHistory/>{/snippet}
      {#snippet content()}
        {#await api.getChangeTimestamps()}
        {:then info}
          <TimeTravelSlider
            bind:timeRange={timeRange}
            markers={info.timestamps}
          />
        {/await}
      {/snippet}
    </PopoverInfoBox>

    <Combobox
      data={searchItems}
      value={searchValue}
      onValueChange={(e) => map?.selectFeature(e.value[0])}
      placeholder="Search..."
      base="preset-outlined-surface-50-950 bg-surface-50-950",
      contentClassess="max-h-[500px]"
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
    {#if allWarnings.length}
      <PopoverInfoBox title="Warnings"
        contentClasses="overflow-auto max-h-[500px]"
        positionerClasses="max-h-screen"
        >
        {#snippet trigger()}
        {#each [Severity.Error, Severity.Warning, Severity.Info] as severity}
          {@const count = allWarnings.filter((r) => (r.level == severity)).length}
          {#if count > 0}
            <div class={`flex flex-row text-${logLevelToColor(severity)}-500`}>
              <IconWarning />
              {count}
            </div>
          {/if}
        {/each}
        {/snippet}
        {#snippet content()}
          <Tabs
            value={warningsTab || warningsDefaultTab}
            onValueChange={(e) => { warningsTab = e.value }}
            activationMode="automatic"
            >
            {#snippet list()}
              {#each data.allLayers as layer}
                {@const w = layer.warningsSummary}
                {#if w?.length}
                  {@const Icon = layer.layer.icon}
                  <Tabs.Control value={layer.id}>
                    {#snippet lead()}<Icon size="16" />{/snippet}
                    {layer.layer.name} [{w.length}]
                  </Tabs.Control>
                {/if}
              {/each}
            {/snippet}
            {#snippet content()}
              {#each data.allLayers as layer}
                {@const w = layer.warningsSummary}
                {#if w?.length}
                  <Tabs.Panel value={layer.id}>
                    <WarningsTable items={w} />
                  </Tabs.Panel>
                {/if}
              {/each}
            {/snippet}
          </Tabs>
        {/snippet}
      </PopoverInfoBox>
    {/if}
    
    <PopoverInfoBox title="Statistics">
      {#snippet trigger()}<IconInfo />{/snippet}
      {#snippet content()}
        <PropertiesTable items={data.layers.power_grid.ctl.getStatistics()}
          onClickChip={(id) => map?.selectFeature(id)}
          onHoverChip={(id) => map?.highlightFeature(id)}
          />
      {/snippet}
    </PopoverInfoBox>

    <PopoverInfoBox title="Layers" contentClasses="min-w-lg grow">
      {#snippet trigger()}<IconLayers />{/snippet}
      {#snippet content()}
        <DisplayOptions map={map}/>
      {/snippet}
    </PopoverInfoBox>

    <PopoverInfoBox title="Share link">
      {#snippet trigger()}<IconLink />{/snippet}
      {#snippet content()}
        <div class="flex-col p-1">
          {#key copyUrlWithSelected}
            <CopyURL url={getUrl(copyUrlWithSelected)} />
          {/key}
          <label class="flex items-center space-x-2">
            <Switch checked={copyUrlWithSelected} onCheckedChange={(e) => {copyUrlWithSelected=e.checked}} />
            <p>To selected feature</p>
          </label>
        </div>
      {/snippet}
    </PopoverInfoBox>
  {/snippet}
</AppBar>

{#if browser}
  {#key timeRange}
    <Map
      bind:content={map}
      timeRange={timeRange}/>
  {/key}
{/if}
