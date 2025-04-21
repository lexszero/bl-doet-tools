<script lang="ts">
	import '../app.css';
	let { children } = $props();
</script>

<div class="flex flex-col w-screen h-screen">
{@render children()}
</div>
