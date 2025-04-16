<script lang="ts">
  import { Modal } from '@skeletonlabs/skeleton-svelte';
  import { copy } from 'svelte-copy';

  let {
    url
  }: {
    url: string
  } = $props();

  let copied: boolean = $state(false);
</script>

<div class="flex-col p-1">
  <input class="text-lg preset-outlined-surface-500" readonly value={url} use:copy={{
    text: url,
    onCopy() { copied = true; }
    }} />
  {#if copied}
  <p class="color-success ">URL copied to clipboard</p>
  {/if}
</div>
