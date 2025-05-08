<script lang="ts">
  import { browser } from '$app/environment'
  import {page} from '$app/state';

  import { TimeRange } from '$lib/utils/misc';

  import PageContent from './PageContent.svelte?client';

  let project = $derived(page.params.slug);
  let timeRange: TimeRange = $state(new TimeRange());
</script>

<div class="flex flex-col w-screen h-screen">
{#if browser}
  {#key project}
    <PageContent project={project} bind:timeRange={timeRange} />
  {/key}
{/if}
</div>

