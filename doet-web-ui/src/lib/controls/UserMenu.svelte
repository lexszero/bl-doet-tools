<script lang="ts">
  import { getContext, onMount } from 'svelte';
  import { base } from '$app/paths';

  import type { API, Info } from '$lib/api';

  import LoginForm from '$lib/controls/LoginForm.svelte';
  import PopoverInfoBox from '$lib/controls/PopoverInfoBox.svelte';

  import SquareMenuIcon from '@lucide/svelte/icons/square-menu';
  import UserIcon from '@lucide/svelte/icons/user';
  import LogOutIcon from '@lucide/svelte/icons/log-out';

  const api = getContext<API>('api');

  let info: Info | undefined = $state();
  onMount(async () => {
    info = await api.getInfo();
  });

  function logout() {
    api.logout();
    window.location.reload();
  }
</script>

<PopoverInfoBox contentClasses="flex flex-col">
  {#snippet trigger()}<SquareMenuIcon />{/snippet}
  {#snippet header()}
    <div class="flex flex-row">
      {#if info?.user}
        <UserIcon />
        {info.user.name}
        <button class="btn-icon" onclick={() => logout()}><LogOutIcon /></button>
      {:else}
        <LoginForm />
      {/if}
    </div>
  {/snippet}
  {#snippet content()}
    <hr class="hr border-t-4" />
    {#each info?.projects || [] as p}
      {@const cls = (api.project === p) ? "font-bold" : ""}
      <a class={cls} href="{base}/project/{p}">{p}</a>
    {/each}
  {/snippet}
</PopoverInfoBox>
