<script lang="ts">
  import { getContext } from 'svelte';
  import { Modal } from '@skeletonlabs/skeleton-svelte';

  import { type API } from '$lib/api';
	import {error} from '@sveltejs/kit';

  const api = getContext<API>('api');

  let openState: boolean = $state(false);
  let errorMessage: string | undefined = $state();

  let username: string = $state('');
  let password: string = $state('');

  async function login() {
    const error = await api.login(username, password);
    if (error) {
      errorMessage = `${error.message} (${error.error})`;
    }
    else {
      window.location.reload();
    }
  }
</script>

<Modal
  open={openState}
  onOpenChange={(e) => {openState = e.open}}
  triggerBase="btn preset-filled"
  contentBase="card bg-surface-100-900 p-4 space-y-4 shadow-xl max-w-screen-sm"
  backdropClasses="backdrop-blur-sm"
  >
  {#snippet trigger()}
    Login
  {/snippet}
  {#snippet content()}
    <label class="label">
      <span class="label-text">Username</span>
      <input
        class="input"
        type="text"
        required
        name="username"
        autocomplete="username"
        bind:value={username}
        />
      </label>
    
    <label class="label">
      <span class="label-text">Password</span>
      <input
        class="input"
        type="password"
        required
        name="password"
        autocomplete="current-password"
        bind:value={password}/>
    </label>
   
    {#if errorMessage}<span class="label-text text-error-500">{errorMessage}</span>{/if}
    <button class="btn" type="submit" onclick={login}>Log in</button>
  {/snippet}
</Modal>
