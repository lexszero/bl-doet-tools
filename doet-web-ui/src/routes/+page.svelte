<script lang="ts">
  import { onMount, setContext } from 'svelte';

  import { API, type Info } from '$lib/api';
	import { AppBar } from '@skeletonlabs/skeleton-svelte';
  import UserMenu from '$lib/controls/UserMenu.svelte';

  const api = new API();
  setContext('api', api);

  let info: Info | undefined = $state();
  $inspect(info);
  onMount(async () => {
    info = await api.getInfo();
  });

</script>

<AppBar background="bg-surface-200-800" padding='p-1'>
  {#snippet lead()}
    <UserMenu />
  {/snippet}
</AppBar>

