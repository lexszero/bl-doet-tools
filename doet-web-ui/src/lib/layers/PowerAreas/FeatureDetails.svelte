<script lang="ts">
  import {getContext} from "svelte";
  import { Tabs } from "@skeletonlabs/skeleton-svelte";

  import PropertiesTable from "$lib/controls/PropertiesTable.svelte";

  import type { MapContentInterface } from "$lib/MapContent.svelte";

  import PowerAreasController from "./Controller.svelte";
  import type { PowerAreaFeature } from "./types";

  let {
    ctl,
    feature,
  }: {
    ctl: PowerAreasController,
    feature: PowerAreaFeature,
    } = $props();

  const map = getContext<MapContentInterface>('Map');
</script>

<Tabs
  value={ctl.infoBoxTab}
  onValueChange={(e) => ctl.setInfoBoxTab(e.value)}
  activationMode="automatic"
  >
  {#snippet list()}
    <Tabs.Control value="general">General</Tabs.Control>
  {/snippet}
  {#snippet content()}
    <Tabs.Panel value="general">
      <PropertiesTable items={ctl.featureProperties(feature)} onClickChip={map.selectFeature} />
    </Tabs.Panel>
  {/snippet}
</Tabs>
