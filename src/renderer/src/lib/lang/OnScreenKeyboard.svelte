<script lang="ts">
  // 屏幕键盘：这门语言给的几行键（LangModule.keyboard），外加空格与退格；没装这门语言输入法的学习者用。
  // 按键不抢输入框的焦点（mousedown 时 preventDefault），插在光标处由调用方处理；
  // 组合符号（阿拉伯语元音符号）的键面画在虚线圆圈上
  import { t } from '$lib/i18n/index.svelte'

  let {
    rows,
    lang,
    dir,
    onkey,
    onback
  }: {
    rows: string[][]
    lang: string
    dir: 'ltr' | 'rtl'
    onkey: (text: string) => void
    onback: () => void
  } = $props()

  const DOTTED = String.fromCharCode(0x25cc)
  const face = (k: string): string => (/^\p{M}+$/u.test(k) ? DOTTED + k : k)
</script>

<div class="kb" {dir} data-keyboard>
  {#each rows as row, ri (ri)}
    <div class="row">
      {#each row as k, ki (ki)}
        <button
          class="key"
          {lang}
          data-key={k}
          onmousedown={(e) => e.preventDefault()}
          onclick={() => onkey(k)}>{face(k)}</button
        >
      {/each}
    </div>
  {/each}
  <div class="row">
    <button
      class="key wide"
      data-key-space
      onmousedown={(e) => e.preventDefault()}
      onclick={() => onkey(' ')}>{t('dict.lex.space')}</button
    >
    <button
      class="key"
      data-key-back
      title={t('dict.lex.backspace')}
      onmousedown={(e) => e.preventDefault()}
      onclick={onback}>⌫</button
    >
  </div>
</div>

<style>
  .kb {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--bg-elev);
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    justify-content: center;
  }
  .key {
    min-width: 34px;
    padding: 4px 8px;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm);
    background: var(--bg);
    cursor: pointer;
    font-size: 17px;
    line-height: 1.4;
  }
  .key:hover {
    background: var(--bg-hover);
  }
  .key.wide {
    min-width: 160px;
    font-size: 13px;
  }
</style>
