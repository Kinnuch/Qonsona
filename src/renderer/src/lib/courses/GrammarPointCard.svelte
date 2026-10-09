<script lang="ts">
  // 一个语法点的讲解：名字、意思（界面语言的在前）、接续、例句（注振假名、语法点高亮、朗读、译文；
  // 机器翻译的标出来）。语法课与词典的「语法」页签共用；level 给了就在名字旁边标出等级
  import type { Snippet } from 'svelte'
  import { t } from '$lib/i18n/index.svelte'
  import type { GrammarItem } from '$shared/course'
  import Pronounce from '$lib/ui/Pronounce.svelte'
  import JaSentence from './JaSentence.svelte'
  import { meanings, translation } from './view'

  let { g, level, actions }: { g: GrammarItem; level?: number; actions?: Snippet } = $props()

  const m = $derived(meanings(g.meaning))
</script>

<article class="card point" data-point={g.key}>
  <header>
    <h2 lang="ja">{g.name}</h2>
    {#if level}<span class="chip on">N{level}</span>{/if}
    <p class="meaning">{m.main}</p>
    {#if m.other}<p class="faint">{m.other}</p>{/if}
  </header>
  <p class="form">
    <span class="chip">{t('courses.learn.form')}</span>
    <span lang="ja">{g.form}</span>
  </p>
  <h3>{t('courses.learn.examplesTitle')}</h3>
  <ul class="examples">
    {#each g.examples as ex, i (i)}
      {@const tr = translation(ex)}
      <li data-example={ex.source}>
        <div class="ja">
          <JaSentence text={ex.ja} start={ex.start} end={ex.end} />
          <Pronounce item={{ text: ex.ja, lang: 'ja-JP' }} />
        </div>
        <p class="muted">
          {tr.text}
          {#if tr.machine}<span class="chip mt">{t('courses.learn.machine')}</span>{/if}
        </p>
      </li>
    {/each}
  </ul>
  {#if actions}<footer>{@render actions()}</footer>{/if}
</article>

<style>
  .point {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  header {
    display: flex;
    align-items: baseline;
    gap: 12px;
    flex-wrap: wrap;
  }
  h2 {
    font-size: 22px;
  }
  .meaning {
    font-size: 16px;
    font-weight: 600;
  }
  .form {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }
  h3 {
    font-size: 14px;
    color: var(--text-2);
  }
  .examples {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .ja {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 18px;
  }
  .mt {
    margin-inline-start: 6px;
  }
  footer {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    padding-top: 4px;
  }
</style>
