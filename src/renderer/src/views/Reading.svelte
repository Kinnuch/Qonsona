<script lang="ts">
  // 阅读：日语是文章库 + 阅读器；千语集来的语言读课文与例句（QonReading）
  import { packs } from '$lib/state/packs.svelte'
  import { reading } from '$lib/state/reading.svelte'
  import JaLibrary from '$lib/reader/JaLibrary.svelte'
  import JaReader from '$lib/reader/JaReader.svelte'
  import QonReading from '$lib/reader/QonReading.svelte'
  import LexLibrary from '$lib/reader/LexLibrary.svelte'
  import LexReader from '$lib/reader/LexReader.svelte'
  import { langReading } from '$lib/state/langReading.svelte'
  import { langModule } from '$shared/lang/registry'

  const pack = $derived(packs.active)
  const language = $derived(
    packs.project?.languages.find((l) => l.id === pack?.source?.languageId) ?? null
  )
</script>

{#if pack?.id === 'ja'}
  {#if reading.openId}<JaReader />{:else}<JaLibrary />{/if}
{:else if pack && langModule(pack.id)}
  {#key pack.id}
    {#if langReading.article && langReading.code === pack.id}<LexReader
        code={pack.id}
      />{:else}<LexLibrary code={pack.id} />{/if}
  {/key}
{:else if pack?.kind === 'qonlang' && packs.project && language}
  <QonReading project={packs.project} {language} />
{/if}
