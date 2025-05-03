<script lang="ts">
  import {getContext} from "svelte";
  import { Tabs } from "@skeletonlabs/skeleton-svelte";

  import PropertiesTable from "$lib/controls/PropertiesTable.svelte";
  import WarningsTable from "$lib/controls/WarningsTable.svelte";

  import type { InfoItem } from "$lib/utils/types";
  import type { MapContentInterface } from "$lib/MapContent.svelte";

  import type { PowerGridController } from "./Controller.svelte";
  import type { GridFeature } from "./types.ts";
  import { calculatePathLoss, type LossInfoCable} from "./calculations";
  import { Vref_LL, Vref_LN, getGridItemSizeInfo } from "./constants";

  import { IconPower, IconWarning, IconRuler, IconResistance } from "$lib/Icons";
  import IconPathInfo from '@lucide/svelte/icons/waypoints';

  let {
    ctl,
    feature,
  }: {
    ctl: PowerGridController,
    feature: GridFeature,
  } = $props();
 
  const map = getContext<MapContentInterface>('Map');

  function pathInfo() {
    const loadLevels = [100, 75, 50];
    const result: Array<InfoItem> = [];

    const path = ctl.highlightedGridPath?.map((l) => ctl.data.features.get(l.feature.id)).filter((f) => !!f);
    const pathResult = calculatePathLoss(path,
      { loadAmps: Math.min(...(path?.map((f) => f ? getGridItemSizeInfo(f).max_amps : 0) || [])) }
    );

    const allResults = [
      ...loadLevels.map((loadPercentage) => [
        `${loadPercentage}%`,
        calculatePathLoss(path, { loadPercentage }),
      ]),
      [ 'path', pathResult ]
    ] as Array<[string, LossInfoCable]>;

    result.push({
      label: "Path length",
      value: `${pathResult.L.toFixed(1)} m`,
      icon: IconRuler
    },
    {
      label: "Resistance",
      value: `${pathResult.R.toFixed(2)} Ω`,
      icon: IconResistance
    },
    {
      label: "Pmax",
      value: `${(pathResult.I*Vref_LN*pathResult.Phases/1000).toFixed(1)} kW`,
      icon: IconPower
    },
    {
      label: "Imax",
      value: `${(pathResult.I).toFixed(1)} A`,
      icon: IconPower
    }

    );

    for (const [label, r] of allResults) {
      const VdropPercent = r.Vdrop/Vref_LL*100;
      result.push(
        {
          label: `Loss @ ${label}`,
          value: `${r.Vdrop.toFixed(1)} V (${VdropPercent.toFixed(1)}%), ${(r.Ploss/1000.0).toFixed(1)} kW`,
          classes: (
            (VdropPercent < 5) ? ""
            : (VdropPercent < 10) ? "text-warning-500"
            : "text-error-500"
          )
        },
      );
    }

    return result;
  }

  const warnings = ctl.data.featureWarnings.get(feature.id);
</script>

<Tabs
  value={ctl.infoBoxTab}
  onValueChange={(e) => ctl.setInfoBoxTab(e.value)}
  activationMode="automatic"
  >
  {#snippet list()}
    <Tabs.Control value="general">General</Tabs.Control>
    <Tabs.Control value="path" labelClasses="flex row">
      {#snippet lead()}<IconPathInfo size="16" />{/snippet}
      Path
    </Tabs.Control>
    {#if warnings?.length}
      <Tabs.Control value="warnings" labelClasses="flex row">
        {#snippet lead()}<IconWarning size="16" />{/snippet}
        Warnings
      </Tabs.Control>
    {/if}
  {/snippet}
  {#snippet content()}
    <Tabs.Panel value="general">
      <PropertiesTable items={ctl.featureProperties(feature)} onClickChip={map.selectFeature}
        />
    </Tabs.Panel>
    <Tabs.Panel value='path'>
      <PropertiesTable items={pathInfo()} onClickChip={map.selectFeature} />
    </Tabs.Panel>
    {#if warnings?.length}
      <Tabs.Panel value="warnings">
        <WarningsTable items={warnings} />
      </Tabs.Panel>
    {/if}
  {/snippet}
</Tabs>
