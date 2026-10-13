<script lang="ts">
  import { onDestroy } from 'svelte'
  import {
    ArticleQuizScopeGate,
    saveScopedArticleQuiz,
    type ArticleQuizScope
  } from '$shared/article-quiz-scope'
  import {
    makeArticleQuiz,
    parseArticleQuizProgress,
    type ArticleQuizInput,
    type ArticleQuizProgress
  } from '$shared/article-quiz'
  import { activity } from '$lib/state/activity.svelte'
  import { i18n } from '$lib/i18n/index.svelte'
  import { ui } from '$lib/state/ui.svelte'
  import type { ExamQuestion } from '$shared/exam'
  import ExamPrompt from '$lib/practice/ExamPrompt.svelte'
  import Choices from '$lib/practice/Choices.svelte'
  import Explain from '$lib/practice/Explain.svelte'
  import { serializedWrites } from '$lib/state/persistence'

  let {
    packId,
    material,
    vocabulary = [],
    loadVocabulary,
    markRead
  }: {
    packId: string
    material: ArticleQuizInput
    vocabulary?: ExamQuestion[]
    loadVocabulary?: () => Promise<ExamQuestion[]>
    markRead?: () => Promise<void>
  } = $props()
  const zh = $derived(i18n.locale === 'zh')
  const tr = (cn: string, en: string): string => (zh ? cn : en)
  let active = $state(false),
    busy = $state(false),
    error = $state('')
  let quiz = $state<ReturnType<typeof makeArticleQuiz> | null>(null)
  let progress = $state<ArticleQuizProgress | null>(null)
  let current = $state(0)
  const gate = new ArticleQuizScopeGate()
  let scope: ArticleQuizScope | null = null
  let resetKey = ''
  const q = $derived(quiz?.questions[current])
  const selected = $derived(progress?.answers[current] ?? null)
  const right = $derived(
    progress?.answers.filter((answer, i) => answer === quiz?.questions[i]?.answer).length ?? 0
  )
  $effect(() => {
    const key = `${packId}\0${material.id}`
    if (key === resetKey) return
    resetKey = key
    gate.invalidate()
    scope = null
    active = false
    busy = false
    quiz = null
    progress = null
    error = ''
  })
  onDestroy(() => gate.invalidate())
  const currentScope = (owner: ArticleQuizScope): boolean =>
    gate.current(owner, packId, material.id)
  async function persist(
    owner: ArticleQuizScope,
    data: ArticleQuizProgress,
    completed = false
  ): Promise<void> {
    await saveScopedArticleQuiz(
      owner,
      $state.snapshot(data),
      (pack, id, snapshot) =>
        serializedWrites.enqueue(`article-quiz:${pack}`, () =>
          window.qstudy!.invoke('articleQuiz:save', pack, id, snapshot)
        ),
      completed ? (saved) => activity.complete('practice', saved.id, saved.packId) : undefined
    )
  }
  async function begin(): Promise<void> {
    if (busy || !material.body.trim()) return
    const owner = gate.begin(packId, material.id),
      input = { ...material }
    scope = owner
    busy = true
    error = ''
    try {
      await markRead?.()
      activity.complete('reading', owner.id, owner.packId)
      if (!currentScope(owner)) return
      const vocab = loadVocabulary ? await loadVocabulary() : vocabulary
      if (!currentScope(owner)) return
      quiz = makeArticleQuiz({ ...input, vocabulary: vocab, seed: 1729 })
      const saved = parseArticleQuizProgress(
        await window.qstudy!.invoke('articleQuiz:load', owner.packId, owner.id)
      )
      if (!currentScope(owner)) return
      progress =
        saved?.fingerprint === quiz.fingerprint &&
        saved.answers.length <= quiz.questions.length &&
        saved.answers.every((a, i) => a < quiz!.questions[i].choices.length)
          ? saved
          : {
              fingerprint: quiz.fingerprint,
              answers: [],
              completed: false,
              history: saved?.history ?? []
            }
      current = Math.min(progress.answers.length, Math.max(0, quiz.questions.length - 1))
      active = true
      await persist(owner, progress)
    } catch (err) {
      if (currentScope(owner)) error = String(err instanceof Error ? err.message : err)
    } finally {
      if (currentScope(owner)) busy = false
    }
  }
  async function answer(choice: number): Promise<void> {
    if (
      !q ||
      !progress ||
      !scope ||
      busy ||
      selected !== null ||
      choice < 0 ||
      choice >= q.choices.length
    )
      return
    const owner = scope
    busy = true
    progress = { ...progress, answers: [...progress.answers, choice] }
    try {
      await persist(owner, progress)
    } catch (err) {
      if (currentScope(owner)) {
        error = String(err)
        ui.toast(tr('练习保存失败，请重试', 'Quiz could not be saved; please retry'), 'error')
      }
    } finally {
      if (currentScope(owner)) busy = false
    }
  }
  async function next(): Promise<void> {
    if (!progress || !quiz || !scope || selected === null || busy) return
    const owner = scope
    if (current + 1 < quiz.questions.length) {
      current++
      return
    }
    busy = true
    progress = {
      ...progress,
      completed: true,
      history: [
        ...progress.history,
        { at: Date.now(), answers: [...progress.answers], right, total: quiz.questions.length }
      ]
    }
    try {
      await persist(owner, progress, true)
    } catch (err) {
      if (currentScope(owner) && progress) {
        error = String(err)
        progress = { ...progress, completed: false, history: progress.history.slice(0, -1) }
      }
    } finally {
      if (currentScope(owner)) busy = false
    }
  }
  async function redo(): Promise<void> {
    if (!progress || !scope || busy) return
    const owner = scope
    busy = true
    progress = { ...progress, answers: [], completed: false }
    current = 0
    try {
      await persist(owner, progress)
    } catch (err) {
      if (currentScope(owner)) error = String(err)
    } finally {
      if (currentScope(owner)) busy = false
    }
  }
  async function retrySave(): Promise<void> {
    if (busy || !progress || !scope) return
    const owner = scope
    busy = true
    try {
      await persist(owner, progress)
      if (currentScope(owner)) error = ''
    } catch (err) {
      if (currentScope(owner)) error = String(err)
    } finally {
      if (currentScope(owner)) busy = false
    }
  }
</script>

<section class="completion" data-reader-completion dir="ltr">
  <button
    class="btn primary"
    data-reading-finish
    disabled={busy || !material.body.trim()}
    onclick={begin}
    >{tr('阅读完成 → 词汇与阅读练习', 'Finished reading → vocabulary and reading tasks')}</button
  >
  {#if material.excerpt}<p class="muted" data-quiz-excerpt>
      {tr(
        '只依据已获取的标题与导语练习，完成表示读完本地节选，不代表读过来源全文。',
        'Tasks use only the supplied title and lead. Completion refers to this excerpt, not the source’s full article.'
      )}
    </p>{/if}
  {#if error}<p role="alert">{error}</p>
    {#if progress}<button class="btn" data-quiz-save-retry disabled={busy} onclick={retrySave}
        >{tr('重试保存', 'Retry save')}</button
      >{/if}{/if}
  {#if active && quiz && progress}
    <div class="quiz" data-article-quiz={material.id}>
      <header>
        <strong>{tr('阅读后练习', 'After-reading tasks')}</strong><button
          class="btn ghost"
          data-article-quiz-exit
          disabled={busy}
          onclick={() => (active = false)}>{tr('退出（保留进度）', 'Exit (save progress)')}</button
        >
      </header>
      <p data-quiz-counts>
        {tr(
          `本文词汇 ${quiz.vocabulary} 题 · 阅读 ${quiz.reading} 题`,
          `${quiz.vocabulary} vocabulary · ${quiz.reading} reading tasks`
        )}
      </p>
      {#if !quiz.translated}<p class="muted">
          {tr(
            '没有完整对齐译文；阅读题仅检查原文信息定位与顺序，不推断未提供的句意。',
            'No fully aligned translation is available; reading tasks test evidence location and sequence, without inventing meanings.'
          )}
        </p>{/if}
      {#if quiz.vocabulary < 3 || quiz.reading < 3}<p class="muted" data-quiz-insufficient>
          {tr(
            '材料或题库不足，已只保留可核对且答案唯一的题目；不会补造内容。',
            'The material or question bank is limited. Only verifiable questions with one correct answer are included.'
          )}
        </p>{/if}
      {#if !quiz.questions.length}<p>
          {tr(
            '这份材料暂不足以生成题目。可添加更多原文或按段落对齐的译文。',
            'This material cannot yet support questions. Add more source text or paragraph-aligned translations.'
          )}
        </p>
      {:else if progress.completed}
        <div data-article-quiz-result>
          <strong>{right} / {quiz.questions.length}</strong>
          <p>{tr('已完成并保存，可重新练习。', 'Completed and saved. You can try again.')}</p>
          <button class="btn" data-article-quiz-redo disabled={busy} onclick={redo}
            >{tr('重新练习', 'Try again')}</button
          >
        </div>
      {:else if q}
        <p>
          {current + 1} / {quiz.questions.length} · {q.section === 'vocab'
            ? tr('本文词汇', 'Vocabulary from the text')
            : tr('原文阅读', 'Reading evidence')}
        </p>
        <div data-article-quiz-question={q.id}>
          <ExamPrompt {q} reveal={selected !== null} /><Choices
            {q}
            {selected}
            reveal={selected !== null}
            disabled={busy || selected !== null}
            onchoose={answer}
          />
        </div>
        {#if selected !== null}<Explain {q} /><button
            class="btn primary"
            data-article-quiz-next
            disabled={busy}
            onclick={next}
            >{current + 1 === quiz.questions.length
              ? tr('完成并保存', 'Finish and save')
              : tr('下一题', 'Next')}</button
          >{/if}
      {/if}
    </div>
  {/if}
</section>

<style>
  .quiz :global([lang='ar']) {
    direction: rtl;
    unicode-bidi: plaintext;
  }
  .completion {
    margin-block: 22px;
    min-width: 0;
  }
  .quiz {
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 18px;
    margin-top: 14px;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
  }
  p {
    margin-block: 12px;
    overflow-wrap: anywhere;
  }
  .muted {
    color: var(--text-2);
    font-size: 12px;
    line-height: 1.7;
  }
</style>
