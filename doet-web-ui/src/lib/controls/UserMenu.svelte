<script lang="ts">
  import { getContext, onMount } from 'svelte';
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';

  import type { API, Info } from '$lib/api';
  import type { ProjectInfo } from '$lib/api_project';

  import LoginForm from '$lib/controls/LoginForm.svelte';
  import PopoverInfoBox from '$lib/controls/PopoverInfoBox.svelte';

  import SquareMenuIcon from '@lucide/svelte/icons/square-menu';
  import UserIcon from '@lucide/svelte/icons/user';
  import LogOutIcon from '@lucide/svelte/icons/log-out';
	import {page} from '$app/state';

  let {
    projectInfo,
  }: {
    projectInfo?: ProjectInfo
  } = $props();

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

<PopoverInfoBox contentClasses="flex flex-col p-2">
  {#snippet trigger()}<SquareMenuIcon />{/snippet}
  {#snippet header()}{/snippet}
  {#snippet content()}
    <div class="flex justify-between items-center gap-4">
      {#if info?.user}
        <UserIcon />
        {info.user.name}
        <button class="btn-icon" onclick={() => logout()}><LogOutIcon /></button>
      {:else}
        <LoginForm />
      {/if}
    </div>

    {#if info}
      <hr class="hr border-t-4" />
      <div class="flex justify-between items-center gap-4">
        <p>Project</p>
        <select class="select" value={page.params.slug} onchange={(e) => {
          if (e.target)
            goto(`${base}/project/${e.target.value}`);
          }}>
          {#each info?.projects || [] as p}
            <option value={p}>{p}</option>
          {/each}
        </select>
      </div>
    {/if}

    {#if projectInfo}
      <hr class="hr border-t-4" />
      <div class="flex justify-between items-center gap-4">
        <p>View</p>
        <select class="select" value={page.params.view || 'default'} onchange={(e) => {
          if (e.target)
            goto(`${base}/project/${projectInfo.name}/v/${e.target.value}`)
          }}>
          {#each projectInfo.views as v}
            <option value={v}>{v}</option>
          {/each}
        </select>
      </div>
    {/if}
  {/snippet}
</PopoverInfoBox>
