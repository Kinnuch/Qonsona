<script lang="ts">
  // 框架语言阅读器里点词出的词卡：原形与这个词形的变化、等级、释义、朗读、加入生词本、在词典中查看
  import { t, i18n, pick } from '$lib/i18n/index.svelte'
  import { ui } from '$lib/state/ui.svelte'
  import { dictState } from '$lib/dict/state.svelte'
  import Pronounce from '$lib/ui/Pronounce.svelte'
  import AddToNotebook from '$lib/notebook/AddToNotebook.svelte'
  import { lexKey } from '$lib/notebook/cards'
  import { LANGS } from '$shared/lang/registry'
  import { posLabel, tagsLabel } from '$shared/lang/tags'
  import { primarySystem } from '$shared/lang/levels'
  import type { LangCode, LexToken } from '$shared/lang/types'

  let {
    code,
    token,
    x,
    y,
    onclose
  }: { code: string; token: LexToken; x: number; y: number; onclose: () => void } = $props()

  const spec = $derived(LANGS[code as LangCode].spec)
  const L = $derived(i18n.locale)
  const levelName = $derived.by(() => {
    if (!token.lv) return ''
    return primarySystem(spec.levelSystems).levels.find((l) => l.id === token.lv)?.short ?? token.lv
  })
  const changes = $derived(tagsLabel(token.tags ?? [], L))

  function openInDict(entry = token.entry, lemma = token.lemma ?? token.text): void {
    if (!entry) return
    const memo = dictState.of(code)
    memo.tab = 'words'
    memo.query = lemma
    memo.selected = String(entry)
    dictState.remember(code, memo.query)
    onclose()
    ui.go('dictionary')
  }
</script>

<div class="pop card" style:left="{x}px" style:top="{y}px" data-word-card role="dialog">
  {#if token.entry}
    <div class="head">
      <strong lang={spec.bcp47} dir={spec.direction}>{token.lemma ?? token.text}</strong>
      {#if spec.features.speech}
        <Pronounce
          item={{
            key: lexKey(token.entry),
            text: token.lemma ?? token.text,
            lang: spec.features.speech
          }}
        />
      {/if}
      {#if token.pos}<span class="faint">{posLabel(token.pos, L)}</span>{/if}
      {#if levelName}<span class="chip">{levelName}</span>{/if}
    </div>
    {#if token.text !== token.lemma && changes}
      <p class="faint small" data-word-form>
        {t('dict.lex.via.form', { form: token.text, base: token.lemma ?? '', tags: changes })}
      </p>
    {/if}
    {#if token.alt?.length}
      <p class="faint small" data-word-alt>
        {t('dict.lex.via.alt', {
          tags: token.alt.map((a) => tagsLabel(a, L)).join(L === 'zh' ? '；' : '; ')
        })}
      </p>
    {/if}
    {#if token.others?.length}
      <p class="faint small" data-word-others>
        {t('langReading.others')}{#each token.others as o, i (o.entry)}{#if i}{L === 'zh'
              ? '、'
              : ', '}{/if}<button
            class="link"
            lang={spec.bcp47}
            dir={spec.direction}
            data-other={o.entry}
            onclick={() => openInDict(o.entry, o.lemma)}>{o.lemma}</button
          >（{posLabel(o.pos, L)}）{/each}
      </p>
    {/if}
    {#if token.ruby}<p class="faint small ruby">{token.ruby}</p>{/if}
    <p class="gloss">{(L === 'zh' ? token.zh || token.en : token.en || token.zh) ?? ''}</p>
    <div class="actions">
      <AddToNotebook
        key={lexKey(token.entry)}
        make={() => ({
          key: lexKey(token.entry!),
          front: token.lemma ?? token.text,
          reading: token.ruby ?? '',
          meaning: { zh: token.zh ?? '', en: token.en ?? '' }
        })}
      />
      <button class="btn ghost small" data-open-dict onclick={() => openInDict()}
        >{t('reading.openInDict')}</button
      >
    </div>
  {:else}
    <p class="faint">{t('reading.noEntry')}</p>
    <p class="faint small">{pick(spec.name)} · {token.text}</p>
  {/if}
</div>

<style>
  .pop {
    position: fixed;
    z-index: 30;
    width: 320px;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    box-shadow: var(--shadow-lg, 0 8px 24px rgba(0, 0, 0, 0.18));
    line-height: 1.5;
    font-size: 14px;
  }
  .head {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
  }
  .head strong {
    font-size: 20px;
  }
  .gloss {
    margin: 0;
  }
  .small {
    font-size: 12px;
    margin: 0;
  }
  .actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }
</style>
