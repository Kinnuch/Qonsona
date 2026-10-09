<script lang="ts">
  // 「关于这门语言」：首页右边拉出来的一栏。语言的名字、出处、能力，作者写的介绍，样例（朗读、录音），
  // 这门语言有什么（词条、例句……的数目）、等级体系、文字。Esc 或点击关闭即可收起
  import { X } from '@lucide/svelte'
  import { packs } from '$lib/state/packs.svelte'
  import { t, pick, i18n } from '$lib/i18n/index.svelte'
  import { glyphPreview, languageSample } from '$lib/packs/qonlang/sample'
  import Pronounce from '$lib/ui/Pronounce.svelte'
  import { mdToHtml } from '$qon/core/markdown'
  import type { PackFeatures, PackManifest, PackStats } from '$lib/packs/types'

  let { pack, onclose }: { pack: PackManifest; onclose: () => void } = $props()

  const project = $derived(packs.project)
  const langId = $derived(pack.source?.languageId ?? '')

  const STAT_KEYS: (keyof PackStats)[] = [
    'lexemes',
    'morphemes',
    'sentences',
    'phrases',
    'docs',
    'paradigms',
    'phonemes',
    'orthographies'
  ]
  const FEATURE_KEYS: (keyof PackFeatures)[] = [
    'texts',
    'lexicon',
    'alphabet',
    'characters',
    'grammar',
    'inflection',
    'phrasebook',
    'idioms',
    'stories',
    'media',
    'exam',
    'ruby',
    'romanization',
    'speech',
    'gloss',
    'etymology'
  ]

  /** 能力有种类的（字母课是假名还是自造文字……）写出种类；「字」那一栏直接写种类（汉字、语素） */
  function featureLabel(key: keyof PackFeatures, value: PackFeatures[keyof PackFeatures]): string {
    if (key === 'characters' && typeof value === 'string') return t(`kinds.characters.${value}`)
    const base = t('features.' + key)
    if (typeof value === 'string' && (key === 'alphabet' || key === 'ruby'))
      return `${base} · ${t(`kinds.${key}.${value}`)}`
    return base
  }

  // pick 里读了界面语言，换界面语言时译文跟着换
  const sample = $derived(
    project && langId
      ? languageSample(project, langId, pick, {
          hidden: packs.hidden,
          scriptId: packs.study?.display.scriptId
        })
      : null
  )
  /** 学习包作者写的介绍（Markdown；链接只认 http(s)，点了用系统浏览器开） */
  const intro = $derived(packs.study?.intro.trim() ? mdToHtml(packs.study.intro) : '')
  const showIpa = $derived(packs.study?.display.showIpa ?? true)

  const date = (iso: string): string =>
    new Date(iso).toLocaleDateString(i18n.locale === 'zh' ? 'zh-CN' : 'en')
</script>

<aside class="about" aria-label={t('home.dock.about')} data-about-panel>
  <header class="head">
    <div class="title">
      <h1>{pick(pack.name)}</h1>
      {#if pack.nativeName !== pick(pack.name)}
        <span class="native" lang={pack.bcp47}>{pack.nativeName}</span>
      {/if}
    </div>
    <button class="btn ghost" data-about-close title={t('common.close')} onclick={onclose}
      ><X size={16} /></button
    >
  </header>
  {#if pack.source}
    <p class="muted">
      {t('home.fromQonlang', { name: pack.source.projectName })} ·
      {t('home.importedAt', { date: date(pack.source.importedAt) })}
      {#if pack.study?.author}· {t('home.author', { name: pack.study.author })}{/if}
    </p>
  {/if}
  <div class="chips">
    {#each FEATURE_KEYS as key (key)}
      {@const v = pack.features[key]}
      {#if v}<span class="chip on" data-feature={key}>{featureLabel(key, v)}</span>{/if}
    {/each}
  </div>

  {#if intro}
    <!-- eslint-disable-next-line svelte/no-at-html-tags -- mdToHtml 已转义原文，链接只认 http(s) -->
    <section class="card intro md" data-intro>{@html intro}</section>
  {/if}

  {#if sample}
    <section class="card sample" data-sample>
      <h3>{t('home.sample')}</h3>
      <div class="say">
        <p class="sample-text" lang={pack.bcp47}>{sample.text}</p>
        <Pronounce item={{ key: sample.key, ipa: sample.ipa }} />
      </div>
      {#if sample.ipa && showIpa}<p class="ipa">[{sample.ipa}]</p>{/if}
      {#each sample.scripts as sc (sc.id)}
        <p class="script-line" style={sc.style} title={sc.name}>{sc.text}</p>
      {/each}
      {#if sample.translation}<p class="muted">{sample.translation}</p>{/if}
    </section>
  {/if}

  {#if pack.stats || pack.levels || pack.scripts.length}
    <section class="stack">
      <h3>{t('home.contents')}</h3>
      {#if pack.stats}
        <div class="stats">
          {#each STAT_KEYS as key (key)}
            {#if pack.stats[key]}
              <div class="stat card" data-stat={key}>
                <span class="num">{pack.stats[key]}</span>
                <span class="muted">{t('stats.' + key)}</span>
              </div>
            {/if}
          {/each}
        </div>
      {/if}
      {#if pack.levels}
        <div class="chips">
          <span class="muted">{t('home.levels')}：{pick(pack.levels.name)}</span>
          {#each pack.levels.levels as lv (lv.id)}
            <span class="chip" data-level={lv.id}>
              {pick(lv.name)}{#if lv.count !== undefined}<b>{lv.count}</b>{/if}
            </span>
          {/each}
        </div>
      {/if}
      {#each pack.scripts as sc (sc.id)}
        {@const preview = project ? glyphPreview(project, langId, sc.id) : null}
        <div class="card script">
          <div class="chips">
            <strong>{t('home.scripts')} · {sc.name}</strong>
            <span class="faint">{t('home.glyphs', { n: sc.glyphCount })}</span>
            {#if sc.embeddedFont}<span class="chip">{t('home.embeddedFont')}</span>{/if}
          </div>
          {#if preview?.text}
            <p class="glyphs" style={preview.style}>{preview.text}</p>
          {/if}
        </div>
      {/each}
    </section>
  {/if}
</aside>

<style>
  .about {
    height: 100%;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 22px 22px 32px;
    background: var(--bg);
    border-inline-start: 1px solid var(--border);
    box-shadow: var(--shadow-lg);
  }
  .head {
    display: flex;
    align-items: flex-start;
    gap: 8px;
  }
  .title {
    flex: 1;
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 10px;
  }
  .native {
    font-size: 17px;
    color: var(--text-2);
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
  }
  .chip b {
    margin-inline-start: 4px;
    font-weight: 600;
    color: var(--accent-text);
  }
  .intro :global(h1),
  .intro :global(h2),
  .intro :global(h3) {
    margin: 0 0 6px;
  }
  .intro :global(p) {
    margin: 0 0 8px;
  }
  .intro :global(:last-child) {
    margin-bottom: 0;
  }
  .sample {
    display: flex;
    flex-direction: column;
    gap: 6px;
    border-inline-start: 3px solid var(--accent);
  }
  .sample-text {
    font-family: var(--font-data);
    font-size: 22px;
  }
  .say {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .ipa {
    font-family: var(--font-data);
    color: var(--text-2);
  }
  .script-line,
  .glyphs {
    font-size: 26px;
    line-height: 1.4;
    word-break: break-all;
  }
  .stack {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
    gap: 8px;
  }
  .stat {
    display: flex;
    flex-direction: column;
    padding: 10px 14px;
  }
  .num {
    font-size: 22px;
    font-weight: 600;
    color: var(--accent-text);
  }
  .script {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
</style>
