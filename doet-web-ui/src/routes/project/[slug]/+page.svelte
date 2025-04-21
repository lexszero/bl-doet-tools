<script lang="ts">
  import { browser } from '$app/environment'
  import {page} from '$app/state';

  import PageContent from './PageContent.svelte';

  let project = $derived(page.params.slug);
</script>

<div class="flex flex-col w-screen h-screen">
{#key project}
  <PageContent project={project} />
{/key}
</div>

