<script lang="ts">
  import { getContext } from 'svelte';

  import MapInfoBox from '$lib/controls/MapInfoBox.svelte';
  import PropertiesTable from '$lib/controls/PropertiesTable.svelte';
  import WarningsTable from '$lib/controls/WarningsTable.svelte';

  import { featureCachedProps } from './LayerData.svelte';
  import { MapLayerControls } from './LayerController.svelte';
  import { type MapContentInterface } from '$lib/MapContent.svelte';

  let {
    ctl,
    feature
  } = $props()

  const map = getContext<MapContentInterface>('Map');
</script>

<MapInfoBox open={true} visible={true} position='bottomleft' classBody="min-w-[200px] max-w-[500px] md:max-w-full max-h-[40vh] overflow-auto">
  {@const FeatureDetails = ctl.FeatureDetailsComponent}
  {@const FeatureIcon = ctl.featureIcon(feature)}
  {@const statusColor = ctl.featureColorForStatus(feature)}

  <div class="flex h6 justify-start items-center">
    <FeatureIcon size="16" class="stroke-{statusColor}-500"/>
    <span> {feature.properties.name}</span>
  </div>
  <span class="text-xs text-surface-500 justify-end">id: {feature.id}</span>

  {#if FeatureDetails}
    <FeatureDetails ctl={ctl} feature={feature} />
  {:else}
    <PropertiesTable items={ctl.featureProperties(feature)} onClickChip={map.selectFeature} />
      {#if ctl.options.controls == MapLayerControls.Full && featureCachedProps(feature).log?.length}
        <div class="flex">
          <WarningsTable items={feature} />
        </div>
      {/if}
  {/if}
</MapInfoBox>

