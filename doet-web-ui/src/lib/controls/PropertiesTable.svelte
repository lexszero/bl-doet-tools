<script lang="ts">
  import { type InfoItem } from '$lib/types';

  let {
    items,
    onClickChip,
    onHoverChip,
    onUnhoverChip,
  }: {
    items: InfoItem[],
    onClickChip?: ((id: string) => void),
    onHoverChip?: ((id: string) => void),
    onUnhoverChip?: (() => void),
  } = $props();
</script>

<table class="table">
  <tbody>
    {#each items as it}
      {@const Icon = it.icon}
      {#if it.chips || it.value || it.content}
        <tr class={`justify-items-start ${it.classes}`}>
          <td>{#if Icon}<Icon size="16"/>{/if}</td>
          <td>{it.label}</td>
          <td>
            {#if it.content}
              {@render it.content()}
            {:else if it.chips}
              {#each it.chips as chip}
                <button type="button" class="chip preset-outlined-surface-500"
                  onclick={() => {if (chip.id) onClickChip?.(chip.id)}}
                  onmouseenter={() => {if (chip.id) onHoverChip?.(chip.id)}}
                  onmouseleave={() => onUnhoverChip?.()}
                  >
                  {chip.label}
                </button>
              {/each}
            {:else if it.value}
              {it.value}
            {/if}
          </td>
        </tr>
      {/if}
    {/each}
  </tbody>
</table>

