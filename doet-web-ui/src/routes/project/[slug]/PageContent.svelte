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
  import Map from './Map.svelte?client';
  import { type MapContentInterface } from '$lib/MapContent.svelte';
  import { PowerGridData } from '$lib/layers/PowerGrid/data.svelte?client';
  import DisplayOptions from '$lib/layers/DisplayOptions.svelte';

  import { IconPlacement, IconPower, IconWarning } from '$lib/Icons';
  import IconHistory from '@lucide/svelte/icons/history';
  import IconInfo from '@lucide/svelte/icons/info';
  import IconLayers from '@lucide/svelte/icons/layers';
  import IconLink from '@lucide/svelte/icons/link';

  import { TimeRange, Severity, logLevelToColor } from '$lib/utils/misc';
  
  import { copy as copyToClipboard } from 'svelte-copy';
  import lz from 'lz-string';


  let { project }: {project: string} = $props();

  let api = $derived(new ProjectAPI(project));
  setContext('api', api);
  let grid: PowerGridData | undefined;
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

  let warningsGrid = $derived(map?.layers.PowerGrid.warningsSummary() || []);
  let warningsPlacement = $derived(map?.layers.Placement.warningsSummary() || []);
  let nWarnings = $derived(warningsGrid.length + warningsPlacement.length);
  let warningsGroup = $derived(
    warningsGrid.length > 0 ? 'PowerGrid'
    : warningsPlacement.length > 0 ? 'Placement'
    : ""
  );
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
    {#if nWarnings}
      {@const allWarnings = [...warningsPlacement, ...warningsGrid]}
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
            value={warningsGroup}
            onValueChange={(e) => { warningsGroup = e.value }}
            activationMode="automatic"
            >
            {#snippet list()}
              {#if warningsGrid.length}
                <Tabs.Control value="PowerGrid">
                  {#snippet lead()}<IconPower size="16" />{/snippet}
                  Power grid [{warningsGrid.length}]
                </Tabs.Control>
              {/if}
              {#if warningsPlacement.length}
                <Tabs.Control value="Placement">
                  {#snippet lead()}<IconPlacement size="16" />{/snippet}
                  Placement [{warningsPlacement.length}]
                </Tabs.Control>
              {/if}
            {/snippet}
            {#snippet content()}
              {#if warningsGrid.length}
                <Tabs.Panel value="PowerGrid">
                  <WarningsTable items={warningsGrid} />
                </Tabs.Panel>
              {/if}
              {#if warningsPlacement.length}
                <Tabs.Panel value="Placement">
                  <WarningsTable items={warningsPlacement} />
                </Tabs.Panel>
              {/if}
            {/snippet}
          </Tabs>
        {/snippet}
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
  <Map
    bind:content={map}
    timeRange={timeRange}/>
{/if}
