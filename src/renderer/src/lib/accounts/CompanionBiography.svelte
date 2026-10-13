<script lang="ts">
  import { BookOpen, Feather } from '@lucide/svelte'
  import type { AccountCharacter, CollectionSnapshot } from '$shared/account'
  import { i18n } from '$lib/i18n/index.svelte'
  let {
    character,
    companion
  }: { character: AccountCharacter; companion?: CollectionSnapshot['companion'] } = $props()
  const tr = (zh: string, en: string): string => (i18n.locale === 'zh' ? zh : en)
  const progress = $derived(companion?.progress.find((p) => p.characterId === character.id))
  const xp = $derived(progress?.xp ?? 0)
  const milestones = $derived(companion?.milestones ?? [])
  const maximum = $derived(milestones.at(-1)?.xp ?? 1)
  const filled = $derived.by(() => {
    let previous = 0
    for (let i = 0; i < milestones.length; i++) {
      const target = milestones[i].xp
      if (xp < target)
        return ((i + (xp - previous) / (target - previous)) / milestones.length) * 100
      previous = target
    }
    return milestones.length ? 100 : 0
  })
  const fields = $derived([
    { label: tr('介绍', 'Introduction'), value: character.biography?.introduction },
    { label: tr('特征', 'Traits'), value: character.biography?.traits },
    { label: tr('故事', 'Story'), value: character.biography?.story }
  ])
</script>

<section class="biography" data-companion-biography>
  <div class="section-title">
    <Feather size={16} />
    <h3>{tr('图鉴手札', 'Catalog notes')}</h3>
  </div>
  <div class="notes">
    {#each fields as field (field.label)}
      <div class="note">
        <h4>{field.label}</h4>
        <p class:empty={!field.value}>{field.value || tr('尚未撰写', 'Not written yet')}</p>
      </div>
    {/each}
  </div>
</section>
<section class="growth" data-companion-xp={character.id}>
  <div class="section-title">
    <BookOpen size={16} />
    <h3>{tr('一起成长', 'Growing together')}</h3>
    <span>{xp} XP</span>
  </div>
  <div
    class="experience"
    role="progressbar"
    aria-label={tr('养成经验', 'Companion experience')}
    aria-valuemin={0}
    aria-valuemax={maximum}
    aria-valuenow={Math.min(xp, maximum)}
  >
    <div class="track"><span style:width={`${filled}%`}></span></div>
    <div class="books">
      {#each milestones as m, index (m.id)}
        <div
          class="book"
          class:reached={xp >= m.xp}
          data-companion-milestone={m.id}
          title={`${m.name[i18n.locale]} · ${m.xp} XP`}
          style:left={`${((index + 1) / milestones.length) * 100}%`}
        >
          <BookOpen size={20} /><small>{m.xp}</small>
        </div>
      {/each}
    </div>
  </div>
  <p class="hint">
    {tr(
      '答对一题，留下成长的一页。抵达书签时，将收到这位语言精灵的小礼物。',
      'Each correct answer adds a page of growth. At each book marker, this companion gives you a small gift.'
    )}
  </p>
  <div class="gifts" data-companion-gifts>
    {#each milestones as m (m.id)}
      {@const acquired = progress?.gifts.includes(m.id)}
      <div class="gift" class:acquired data-gift={m.id}>
        <BookOpen size={21} /><span>{m.name[i18n.locale]}</span><small
          >{acquired ? tr('已收藏', 'Collected') : tr('待解锁', 'To unlock')}</small
        >
      </div>
    {/each}
  </div>
</section>

<style>
  .biography,
  .growth {
    margin-top: 24px;
    min-width: 0;
  }
  .section-title {
    display: flex;
    align-items: center;
    gap: 9px;
    color: var(--gallery-ink, var(--text));
  }
  h3 {
    font-size: 17px;
    margin: 0;
    font-weight: 600;
  }
  .section-title > span {
    margin-left: auto;
    font-variant-numeric: tabular-nums;
    font-size: 13px;
  }
  .notes {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-top: 14px;
  }
  .note {
    padding: 16px 18px;
    border: 1px solid var(--gallery-border, var(--border));
    background: var(--gallery-paper, var(--bg));
    border-radius: 12px;
  }
  .note:last-child {
    grid-column: 1/-1;
  }
  h4 {
    margin: 0 0 7px;
    font-size: 12px;
    letter-spacing: 0.08em;
    color: var(--text-3);
  }
  p {
    white-space: pre-wrap;
    line-height: 1.8;
    margin: 0;
    font-size: 14px;
    overflow-wrap: anywhere;
  }
  .empty {
    color: var(--text-3);
    font-style: italic;
    min-height: 32px;
  }
  .experience {
    position: relative;
    margin: 28px 0 20px;
    padding: 0 16px;
  }
  .track {
    height: 5px;
    border-radius: 9px;
    background: var(--gallery-border, var(--border));
    position: absolute;
    top: 10px;
    left: 16px;
    right: 16px;
    overflow: hidden;
  }
  .track > span {
    display: block;
    height: 100%;
    background: var(--gallery-sage, var(--accent));
    border-radius: inherit;
  }
  .books {
    position: relative;
    height: 44px;
  }
  .book {
    position: absolute;
    transform: translateX(-50%);
    display: grid;
    justify-items: center;
    gap: 8px;
    color: var(--text-3);
  }
  .book :global(svg) {
    background: var(--gallery-paper, var(--bg-elev));
    border-radius: 4px;
    outline: 4px solid var(--gallery-paper, var(--bg-elev));
  }
  .book.reached {
    color: var(--gallery-ink, var(--accent));
  }
  small {
    font-size: 10px;
    font-variant-numeric: tabular-nums;
  }
  .hint {
    font-size: 12px;
    color: var(--text-3);
  }
  .gifts {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 8px;
    margin-top: 18px;
  }
  .gift {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 9px;
    text-align: center;
    padding: 14px 6px;
    border: 1px dashed var(--gallery-border, var(--border));
    border-radius: 10px;
    color: var(--text-3);
  }
  .gift > span {
    font-size: 11px;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }
  .gift.acquired {
    border-style: solid;
    background: color-mix(in srgb, var(--gallery-sage, var(--accent)) 13%, transparent);
    color: var(--text);
  }
  @media (max-width: 560px) {
    .notes {
      grid-template-columns: 1fr;
    }
    .gifts {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }
</style>
