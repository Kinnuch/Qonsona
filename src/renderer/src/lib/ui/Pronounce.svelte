<script lang="ts">
  // 发音按钮：点喇叭读出来（自己的录音 → 作者录音 → 系统语音）；有录音键的条目还能录音、挑音频文件、删录音
  import { Volume2, Mic, CircleStop, FileMusic, X } from '@lucide/svelte'
  import { audio, type Sayable } from '$lib/state/audio.svelte'
  import { ui } from '$lib/state/ui.svelte'
  import { t } from '$lib/i18n/index.svelte'

  let { item }: { item: Sayable } = $props()

  const id = $derived(item.key ?? item.ipa ?? item.text ?? '')
  const source = $derived(audio.sourceOf(item))
  const hasRecording = $derived(source === 'recording')
  const hasAuthor = $derived(!!item.key && audio.authored.has(item.key))
  const recordingThis = $derived(!!item.key && audio.recording === item.key)
  const canSay = $derived(audio.canSay(item))

  async function removeRecording(): Promise<void> {
    if (!item.key) return
    const ok = await ui.confirm(
      t('audio.removeTitle'),
      t(hasAuthor ? 'audio.removeBodyAuthor' : 'audio.removeBody'),
      t('common.remove'),
      true
    )
    if (ok) await audio.remove(item.key)
  }
</script>

<span class="pron" data-has-recording={hasRecording ? '' : undefined}>
  <button
    class="icon"
    data-pronounce
    data-source={source}
    data-playing={audio.playing === id ? '' : undefined}
    class:on={audio.playing === id}
    disabled={!canSay}
    title={t(
      source === 'recording'
        ? 'audio.playRecording'
        : source === 'author'
          ? 'audio.playAuthor'
          : 'audio.playSynth'
    )}
    onclick={() => (audio.playing === id ? audio.stop() : audio.say(item))}
  >
    <Volume2 size={16} />
  </button>
  {#if item.key}
    <button
      class="icon"
      class:rec={recordingThis}
      data-record
      title={recordingThis ? t('audio.stopRecording') : t('audio.record')}
      disabled={!!audio.recording && !recordingThis}
      onclick={() => (recordingThis ? audio.stopRecording() : audio.startRecording(item.key!))}
    >
      {#if recordingThis}<CircleStop size={16} />{:else}<Mic size={16} />{/if}
    </button>
    <button class="icon" title={t('audio.importFile')} onclick={() => audio.importFile(item.key!)}>
      <FileMusic size={16} />
    </button>
    {#if source === 'author'}
      <span class="chip mine" data-author-audio title={t('audio.authorHint')}
        >{t('audio.author')}</span
      >
    {/if}
    {#if hasRecording}
      <span class="chip mine">
        {t('audio.mine')}
        <button
          class="x"
          data-remove-recording
          title={t('audio.removeTitle')}
          onclick={removeRecording}
        >
          <X size={12} />
        </button>
      </span>
    {/if}
  {/if}
</span>

<style>
  .pron {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    vertical-align: middle;
  }
  .icon {
    display: inline-grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 50%;
    background: none;
    color: var(--text-2);
    cursor: pointer;
  }
  .icon:hover:not(:disabled) {
    background: var(--bg-hover);
    color: var(--accent-text);
  }
  .icon.on {
    color: var(--accent-text);
    background: var(--accent-soft);
  }
  .icon.rec {
    color: #fff;
    background: var(--danger);
    animation: pulse 1.2s ease-in-out infinite;
  }
  .icon:disabled {
    opacity: 0.35;
    cursor: default;
  }
  .mine {
    margin-inline-start: 4px;
    padding-inline-end: 2px;
  }
  .x {
    display: inline-grid;
    place-items: center;
    border: none;
    background: none;
    padding: 0;
    color: inherit;
    cursor: pointer;
  }
  @keyframes pulse {
    50% {
      opacity: 0.7;
    }
  }
</style>
