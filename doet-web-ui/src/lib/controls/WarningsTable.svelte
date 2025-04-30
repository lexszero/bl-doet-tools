<script lang="ts">
  import { getContext } from "svelte";
  import { logLevelToColor, type ItemLogEntry } from "$lib/utils/misc";
  import { IconWarning } from "$lib/Icons";
  import type { MapContentInterface } from "$lib/MapContent.svelte";

  let {
    items,
    classes
  }: {
    items: ItemLogEntry[],
    classes?: string,
  } = $props();

  const map = getContext<MapContentInterface>('Map')

</script>

<table class={["table w-min=[200px]", classes || []]}>
  <tbody>
    {#each (items || []) as r}
      {@const feature = r.item_id ? map.getFeature(r.item_id) : undefined}
      {@const color = logLevelToColor(r.level)}
      <tr class="fill-{color}-300 text-{color}-500">
        <td><IconWarning class="stroke-{color}-500"/></td>
        <td>
          {#if feature}
            <button type="button" class="btn btn-sm preset-outlined-surface-500"
              onclick={() => map.selectFeature(feature.id)}>{feature.properties.name}</button>
          {:else}
            {r.item_id}
          {/if}
        </td>
        <td>{r.message}</td>
      </tr>
    {/each}
  </tbody>
</table>

