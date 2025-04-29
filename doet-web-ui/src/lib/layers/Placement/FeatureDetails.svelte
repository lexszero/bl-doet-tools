<script lang="ts">
  import { Modal, Tabs } from "@skeletonlabs/skeleton-svelte";

	import PopoverInfoBox from "$lib/controls/PopoverInfoBox.svelte";
  import PropertiesTable from "$lib/controls/PropertiesTable.svelte";
	import WarningsTable from "$lib/controls/WarningsTable.svelte";

  import { featureChip } from "../LayerController.svelte";
  import { plugLoadPercent, type PlacementController } from "./Controller.svelte";
  import type { PlacementFeature } from "./types";
  import type { InfoItem } from "$lib/utils/types";

  import { IconContact, IconDescription, IconPlug, IconPower, IconPDU, IconWarning } from "$lib/Icons";
  import IconImage from '@lucide/svelte/icons/image';

  let {
    ctl,
    feature,
    onClickChip
  }: {
    ctl: PlacementController,
    feature: PlacementFeature,
    onClickChip: ((id: string) => void);
    } = $props();

  let detailsGroup = $state('general');

  const warnings = ctl.featureWarnings(feature);

  function placementPowerProperties(feature: PlacementFeature): InfoItem[] {
    const props = feature.properties;
    const loadPercent = plugLoadPercent(feature);
    const result: InfoItem[] = [];
    if (props.powerPlugType) {
      result.push({
        label: "Plug type",
        value: `${props.powerPlugType}, ${loadPercent.toFixed(0)}% load`,
        icon: IconPlug,
        classes: (loadPercent > 300) ? "text-error-500"
                  : (loadPercent > 100) ? "text-warning-500"
                    : ""
      });
    }

    result.push(
      {
        label: "Tech lead",
        value: props.techContactInfo,
        icon: IconContact
      },
      {
        label: "Extra info",
        value: props.powerExtraInfo,
        icon: IconDescription,
      },
    );

    const near = ctl.getNearPDUs(feature);
    if (near?.length) {
      const [nearestPDU, nearestDistance] = near[0];
      result.push({
        label: "Nearest PDU",
        value: `${nearestDistance.toFixed(0)} m`,
        icon: IconPDU,
        chips: [featureChip(nearestPDU)]
      });
    }

    const imageUrl = props.powerImage
    if (imageUrl) {
      result.push({
        label: "Grid plan",
        content: showImage,
        icon: IconImage
      });
      console.debug(result);
    }
    return result;
  }

</script>

{#snippet showImage()}
  <Modal
    triggerBase="chip preset-outlined-primary-500"
    contentBase="card bg-surface-300-700 m-2 shadow-xl max-w-screen-sm flex flex-col"
    backdropClasses="backdrop-blur-xs"
  >
    {#snippet trigger()}Show{/snippet}
    {#snippet content()}
      <p class="h-5 m-2">Grid plan: {feature.properties.name}</p>
      <img src={feature.properties.powerImage} alt="Camp grid plan" />
    {/snippet}
  </Modal>
{/snippet}

<Tabs
  value={detailsGroup}
  onValueChange={(e) => { detailsGroup = e.value }}
  activationMode="automatic"
  >
  {@const warnings = ctl.featureWarnings(feature)}
  {#snippet list()}
    <Tabs.Control value="general">General</Tabs.Control>
    <Tabs.Control value="power" labelClasses="flex row">
      {#snippet lead()}<IconPower size="16" />{/snippet}
      Power
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
      <PropertiesTable items={ctl.featureProperties(feature)} onClickChip={onClickChip} />
    </Tabs.Panel>
    <Tabs.Panel value='power'>
      <PropertiesTable items={placementPowerProperties(feature)} onClickChip={onClickChip} />
      <hr class="hr-1" />
      <table class="table table-auto w-min=[200px] text-xs">
        {#if feature.properties.powerAppliances?.length}
          <thead>
            <tr class="bg-surface-900 text-surface-100 text-sm font-bold">
              <td></td>
              <td>Appliance</td>
              <td>#</td>
              <td>Watt</td>
            </tr>
          </thead>
          <tbody class="max-h-[200px]">
            {#each feature.properties.powerAppliances || [] as a}
              {@const color="surface"}
              <tr class="fill-{color}-300">
                <td></td>
                <td>{a.name}</td>
                <td>{a.amount}</td>
                <td>{a.watt}</td>
              </tr>
            {/each}
          </tbody>
        {/if}
        <tfoot class="bg-surface-900 text-surface-100 text-sm font-bold">
          <tr>
            <td><IconPower size="16" /></td>
            <td>Power need</td>
            <td></td>
            <td>{feature.properties.powerNeed} W</td>
          </tr>
        </tfoot>
      </table>
    </Tabs.Panel>
    <Tabs.Panel value="warnings">
      <WarningsTable items={warnings} />
    </Tabs.Panel>
  {/snippet}
</Tabs>
