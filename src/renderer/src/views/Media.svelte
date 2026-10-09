<script lang="ts">
  // 视听：媒体库 → 播放器。看的是哪一条记在 media.view 里，离开再回来还在
  import { onMount } from 'svelte'
  import { media } from '$lib/state/media.svelte'
  import Library from '$lib/media/Library.svelte'
  import Player from '$lib/media/Player.svelte'

  onMount(() => {
    void media.load()
  })
</script>

{#if media.view.page === 'player' && media.current}
  {#key media.current.id}
    <Player />
  {/key}
{:else}
  <Library />
{/if}
