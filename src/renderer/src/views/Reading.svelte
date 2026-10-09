<script lang="ts">
  // 阅读：日语是文章库 + 阅读器；千语集来的语言读课文与例句（QonReading）
  import { packs } from '$lib/state/packs.svelte'
  import { reading } from '$lib/state/reading.svelte'
  import JaLibrary from '$lib/reader/JaLibrary.svelte'
  import JaReader from '$lib/reader/JaReader.svelte'
  import QonReading from '$lib/reader/QonReading.svelte'

  const pack = $derived(packs.active)
  const language = $derived(
    packs.project?.languages.find((l) => l.id === pack?.source?.languageId) ?? null
  )
</script>

{#if pack?.id === 'ja'}
  {#if reading.openId}<JaReader />{:else}<JaLibrary />{/if}
{:else if pack?.kind === 'qonlang' && packs.project && language}
  <QonReading project={packs.project} {language} />
{/if}
