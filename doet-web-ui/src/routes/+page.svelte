<script lang="ts">
  const projects = [
    'bl22', 'bl23', 'bl24', 'bl25', 'bl25_test'
  ];
</script>

<div class="flex gap-4 w-screen h-screen">
  {#each projects as p}
    <a href="project/{p}">{p}</a>
  {/each}
</div>
