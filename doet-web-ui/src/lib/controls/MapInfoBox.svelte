<script lang="ts">
import { type Snippet } from 'svelte';

import L from 'leaflet';
import { Control } from 'sveaflet';

import { type IconType } from '$lib/Icons';

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
  title?: Snippet,
  icon?: IconType,
  position: 'topleft' | 'topright' | 'bottomleft' | 'bottomright';
  classButton?: string,
  classBody?: string;
  visible: boolean,
  open: boolean,
  children?: Snippet,
  } = $props();

  let instance: L.Control | undefined = $state();
  $effect(() => {
    if (instance) {
      L.DomEvent.disableClickPropagation(instance.getContainer());
    }
  })

</script>

{#snippet header()}
  <div class="flex grow h4 justify-between">
    {#if title}
      <span>{@render title()}</span>
    {/if}
    {#if icon}
      {@const ButtonIcon = icon}
      <button type="button" class={["btn btn-sm", classButton, "preset-" + (open ? "filled" : "outline") + "-primary-500"]}
        onclick={() => {open = !open}}>
        <ButtonIcon class="w-auto h-auto" />
      </button>
    {/if}
  </div>
{/snippet}

{#if visible}
  <Control bind:instance={instance} options={{position: position}} class="map-info-box">
    {#if position == 'topright'}
      {@render header()}
      <hr class="hr" />
    {/if}

    {#if open}
      <div class={["flex grow flex-col overflow-auto", classBody]}>
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
