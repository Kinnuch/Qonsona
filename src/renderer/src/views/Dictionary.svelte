<script lang="ts">
  // 词典：内置日语与框架里的各语言走主进程的 SQLite；千语集来的语言在内存里查项目
  import { packs } from '$lib/state/packs.svelte'
  import JaDictionary from '$lib/dict/JaDictionary.svelte'
  import QonDictionary from '$lib/dict/QonDictionary.svelte'
  import LexDictionary from '$lib/dict/LexDictionary.svelte'
  import { langModule } from '$shared/lang/registry'

  const pack = $derived(packs.active)
  const language = $derived(
    packs.project?.languages.find((l) => l.id === pack?.source?.languageId) ?? null
  )
</script>

{#if pack?.id === 'ja'}
  <JaDictionary />
{:else if pack && langModule(pack.id)}
  {#key pack.id}<LexDictionary code={pack.id} />{/key}
{:else if pack?.kind === 'qonlang' && packs.project && language}
  <QonDictionary project={packs.project} {language} />
{/if}
