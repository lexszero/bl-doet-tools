<script lang="ts">
import { type Snippet } from 'svelte';
import { Control } from 'sveaflet';
import { type Icon } from '@lucide/svelte';

let {
  title,
  icon,
  position = 'topright',
  classButton,
  classBody = 'max-h-[300px]',
  visible = $bindable(true),
  open = $bindable(false),
  children,
}: {
  title?: string,
  icon: Icon,
  position: 'topleft' | 'topright' | 'bottomleft' | 'bottomright';
  classButton?: string,
  classBody?: string;
  visible: boolean,
  open: boolean,
  children?: Snippet,
  } = $props();

</script>

{#snippet header()}
  {@const ButtonIcon = icon}
  <div class="flex grow h4 justify-between">
    {#if open}
      <span>{title}</span>
    {/if}
    <button type="button" class={["btn btn-sm", classButton, "preset-" + (open ? "filled" : "outline") + "-primary-500"]}
      onclick={() => {open = !open}}>
      <ButtonIcon class="w-auto h-auto" />
    </button>
  </div>
{/snippet}

{#if visible}
  <Control options={{position: position}} class="map-info-box">
    {#if position == 'topright'}
    {@render header()}
    <hr class="hr" />
    {/if}
    
    {#if open}
      <div class={["flex grow flex-col overflow-scroll", classBody]}>
      {@render children?.()}
      </div>
    {/if}

    {#if position == 'bottomright' || position == 'bottomleft'}
      <hr class="hr" />
      {@render header()}
    {/if}
  </Control>
{/if}

<style>
  :global(.map-info-box) {
    border: 2px solid gray;
    padding: 6px 8px;
    background: rgba(0, 0, 0, 0.8);
    box-shadow: 0 0 15px rgba(0, 0, 0, 0.2);
    border-radius: 5px;
  }
</style>
