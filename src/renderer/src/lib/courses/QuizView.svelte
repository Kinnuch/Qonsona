<script lang="ts">
  // 一轮练习 / 测验：一题一题做，答完马上看对错；做完给成绩（答对 80% 算过关）和答错的。
  // 题型：看字选读音、看读音选字、听音选字、看字写读音、拼读单词；语法的选意思、填空；
  // 变形的选出正确的形式；会话的看短语选意思、看意思选短语、听音选短语。
  // 快捷键：1–4 选择，回车或空格下一题，R 再听一遍，Esc 结束
  import { untrack } from 'svelte'
  import { X, ArrowRight, Volume2, RotateCcw, Check } from '@lucide/svelte'
  import { courses } from '$lib/state/courses.svelte'
  import { packs } from '$lib/state/packs.svelte'
  import { audio } from '$lib/state/audio.svelte'
  import { t } from '$lib/i18n/index.svelte'
  import {
    fillAnswer,
    findLesson,
    lessonAfter,
    type FormExample,
    type Question
  } from '$shared/course'
  import Pronounce from '$lib/ui/Pronounce.svelte'
  import JaSentence from './JaSentence.svelte'
  import PlainSentence from './PlainSentence.svelte'
  import { meanings, sayable, scriptCss, translation, txt } from './view'

  const run = $derived(courses.quiz!)
  const course = $derived(courses.course(run.course)!)
  const q = $derived(courses.question)
  const given = $derived(run.given)
  const last = $derived(run.answers[run.answers.length - 1])
  const lang = $derived(packs.active?.kind === 'builtin' ? packs.active.bcp47 : undefined)
  /** 日语的例句注振假名；别的语言照原样排 */
  const ja = $derived(packs.active?.id === 'ja')
  let typed = $state('')
  let input = $state<HTMLInputElement | null>(null)

  const title = $derived.by(() => {
    if (run.kind === 'practice') return t('courses.quiz.title.practice')
    if (run.kind === 'test') {
      const u = course.units.find((x) => x.id === run.target)
      return t('courses.quiz.title.test', { unit: txt(u?.title) })
    }
    const l = findLesson(course, run.target)
    return t('courses.quiz.title.lesson', { lesson: txt(l?.lesson.title) })
  })

  const sym = (k: string): (typeof course.symbols)[string] | undefined => course.symbols[k]
  const phrase = (k: string): NonNullable<typeof course.phrases>[string] | undefined =>
    course.phrases?.[k]
  const formEx = (cur: Extract<Question, { type: 'form' }>): FormExample | undefined =>
    course.forms?.[cur.key]?.examples[cur.ex]

  /** 这一题要不要先放音：听音选字、听音选短语 */
  const isListen = (cur: Question | null): boolean =>
    cur?.type === 'listen' || (cur?.type === 'phrase' && cur.mode === 'listen')

  function play(): void {
    const cur = q
    const s =
      cur?.type === 'word'
        ? sayable(cur.word.say)
        : cur?.type === 'phrase'
          ? sayable(phrase(cur.key)?.say)
          : cur?.type === 'form'
            ? sayable(formEx(cur)?.say)
            : cur && 'key' in cur
              ? sayable(sym(cur.key)?.say)
              : null
    if (s) void audio.say(s)
  }

  // 换题：清空输入框；听音题自动放一遍；输入题把光标放进输入框
  $effect(() => {
    void run.i
    untrack(() => {
      typed = ''
      if (isListen(q)) play()
      if (q?.type === 'type') queueMicrotask(() => input?.focus())
    })
  })

  /** 选项的值（交给 courses.answer 的）与显示的字 */
  function choices(cur: Question): { value: string; label: string; font: string }[] {
    switch (cur.type) {
      case 'read':
        return cur.choices.map((k) => ({ value: k, label: sym(k)?.reading ?? k, font: '' }))
      case 'write':
      case 'listen':
        return cur.choices.map((k) => ({
          value: k,
          label: sym(k)?.symbol ?? k,
          font: scriptCss(sym(k)?.scriptId)
        }))
      case 'word':
        return cur.choices.map((w) => ({ value: w.text, label: w.reading, font: '' }))
      case 'meaning':
        return cur.choices.map((k) => ({
          value: k,
          label: meanings(course.grammar[k]?.meaning ?? {}).main,
          font: ''
        }))
      case 'fill':
      case 'form':
        return cur.choices.map((s) => ({ value: s, label: s, font: '' }))
      case 'phrase':
        return cur.choices.map((k) => ({
          value: k,
          label: cur.mode === 'meaning' ? txt(phrase(k)?.meaning) : (phrase(k)?.text ?? k),
          font: ''
        }))
      default:
        return []
    }
  }

  /** 正确答案（选择题是哪个值，输入题是读音） */
  function correct(cur: Question): string {
    switch (cur.type) {
      case 'fill':
        return fillAnswer(course, cur)
      case 'form':
        return formEx(cur)?.form ?? ''
      case 'word':
        return cur.word.text
      default:
        return cur.key
    }
  }

  /** 答错时说正确答案是什么 */
  function answerText(cur: Question): string {
    const c = choices(cur).find((x) => x.value === correct(cur))
    if (c) return c.label
    return cur.type === 'type' ? (sym(cur.key)?.reading ?? '') : ''
  }

  function choose(value: string): void {
    if (given === null) courses.answer(value)
  }

  function submitTyped(e: KeyboardEvent): void {
    if (e.key !== 'Enter' || given !== null || !typed.trim()) return
    // 别让回车再冒泡到窗口上直接翻到下一题
    e.stopPropagation()
    e.preventDefault()
    courses.answer(typed)
  }

  function onkey(e: KeyboardEvent): void {
    const inInput = !!(e.target as HTMLElement).closest('input, textarea, select')
    if (e.key === 'Escape') {
      courses.exit()
      return
    }
    if (run.done || !q) return
    if (given === null) {
      if (inInput) return
      const list = choices(q)
      if (/^[1-9]$/.test(e.key) && Number(e.key) <= list.length) {
        e.preventDefault()
        choose(list[Number(e.key) - 1].value)
      } else if ((e.key === 'r' || e.key === 'R') && isListen(q)) play()
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      courses.next()
    }
  }

  // ── 结果 ──
  const pct = (x: number): number => Math.round(x * 100)
  const rightCount = $derived(run.answers.filter((a) => a.right).length)
  /** 答错的：去重后列出来（字：字 — 读音；词：词 — 读法；语法：名字 — 意思） */
  const missed = $derived.by(() => {
    const seen = new Set<string>()
    const out: { key: string; head: string; font: string; body: string }[] = []
    for (const a of run.answers) {
      if (a.right) continue
      const cur = run.questions[a.q]
      let item: { key: string; head: string; font: string; body: string }
      if (cur.type === 'word')
        item = {
          key: `w:${cur.word.text}`,
          head: cur.word.text,
          font: scriptCss(cur.word.scriptId),
          body: cur.word.reading
        }
      else if (cur.type === 'meaning' || cur.type === 'fill') {
        const g = course.grammar[cur.key]
        item = { key: cur.key, head: g.name, font: '', body: meanings(g.meaning).main }
      } else if (cur.type === 'form') {
        const ex = formEx(cur)
        item = {
          key: `${cur.key}#${cur.ex}`,
          head: `${ex?.base ?? ''} → ${txt(course.forms?.[cur.key]?.title)}`,
          font: '',
          body: ex?.form ?? ''
        }
      } else if (cur.type === 'phrase') {
        const ph = phrase(cur.key)
        item = { key: cur.key, head: ph?.text ?? '', font: '', body: txt(ph?.meaning) }
      } else {
        const s = sym(cur.key)
        item = {
          key: cur.key,
          head: s?.symbol ?? '',
          font: scriptCss(s?.scriptId),
          body: s?.reading ?? ''
        }
      }
      if (seen.has(item.key)) continue
      seen.add(item.key)
      out.push(item)
    }
    return out
  })
  const following = $derived(
    run.done && run.kind === 'lesson' && run.result?.passed
      ? lessonAfter(course, courses.progress!, run.target)
      : null
  )

  function goNext(): void {
    if (!following) return
    // 先记下要去哪一课再清掉这一轮：清掉之后 run、course 这些派生值就没有了，再读会报错
    const courseId = course.id
    const lessonId = following.lesson.id
    courses.openLesson(courseId, lessonId)
    courses.quiz = null
  }
</script>

<svelte:window onkeydown={onkey} />

<div class="quiz" data-quiz={run.kind}>
  <header class="bar">
    <strong>{title}</strong>
    {#if !run.done}
      <span class="faint" data-quiz-progress
        >{t('courses.quiz.progress', { i: run.i + 1, n: run.questions.length })}</span
      >
    {/if}
    <div class="grow"></div>
    <button
      class="btn ghost"
      data-quiz-exit
      title={t('courses.quiz.exit')}
      onclick={() => courses.exit()}><X size={16} /></button
    >
  </header>
  <div class="track">
    <div class="fill" style:width="{(run.i / run.questions.length) * 100}%"></div>
  </div>

  {#if run.done}
    <div class="card result" data-quiz-result data-passed={run.result?.passed ? '' : undefined}>
      <h2>{t(`courses.quiz.done.${run.kind}`)}</h2>
      <p class="score" data-score={pct(run.result?.score ?? 0)}>
        {t('courses.quiz.score', {
          right: rightCount,
          n: run.answers.length,
          pct: pct(run.result?.score ?? 0)
        })}
      </p>
      {#if run.kind === 'practice'}
        <p class="muted">{t('courses.quiz.practiceNote')}</p>
      {:else if run.result?.passed}
        <p class="good"><Check size={16} />{t('courses.quiz.passed')}</p>
      {:else}
        <p class="bad">{t('courses.quiz.notPassed')}</p>
      {/if}
      {#if missed.length}
        <div class="missed">
          <h3>{t('courses.quiz.missed')}</h3>
          <ul>
            {#each missed as m (m.key)}
              <li data-missed={m.key}>
                <span class="mh" style={m.font} {lang}>{m.head}</span>
                <span class="muted">{m.body}</span>
              </li>
            {/each}
          </ul>
        </div>
      {/if}
      <div class="row">
        {#if following}
          <button class="btn primary" data-next-lesson onclick={goNext}
            >{t('courses.quiz.nextLesson', { lesson: txt(following.lesson.title) })}<ArrowRight
              size={14}
            /></button
          >
        {/if}
        <button class="btn" data-retry onclick={() => courses.retry()}
          ><RotateCcw size={14} />{t('courses.quiz.retry')}</button
        >
        <button class="btn" data-back-course onclick={() => courses.exit()}
          >{t('courses.quiz.backToCourse')}</button
        >
      </div>
    </div>
  {:else if q}
    <div class="card question" data-question={q.type}>
      {#if q.type === 'read' || q.type === 'type'}
        <p class="big" style={scriptCss(sym(q.key)?.scriptId)} {lang} data-prompt>
          {sym(q.key)?.symbol}
        </p>
        <p class="muted">{t(q.type === 'read' ? 'courses.quiz.read' : 'courses.quiz.type')}</p>
      {:else if q.type === 'write'}
        <p class="big reading" data-prompt>{sym(q.key)?.reading}</p>
        <p class="muted">{t('courses.quiz.write', { reading: sym(q.key)?.reading ?? '' })}</p>
      {:else if q.type === 'listen'}
        <button class="btn listen" data-replay onclick={play} title={t('courses.quiz.replay')}
          ><Volume2 size={28} /></button
        >
        <p class="muted">{t('courses.quiz.listen')}</p>
      {:else if q.type === 'word'}
        <p class="big word" style={scriptCss(q.word.scriptId)} {lang} data-prompt>{q.word.text}</p>
        <p class="muted">{t('courses.quiz.word')}</p>
      {:else if q.type === 'meaning'}
        {@const ex = course.grammar[q.key].examples[q.ex]}
        <p class="sentence">
          {#if ja}<JaSentence text={ex.ja} start={ex.start} end={ex.end} />{:else}<PlainSentence
              text={ex.ja}
              start={ex.start}
              end={ex.end}
              {lang}
            />{/if}
        </p>
        <p class="muted">{t('courses.quiz.meaning')}</p>
      {:else if q.type === 'fill'}
        {@const ex = course.grammar[q.key].examples[q.ex]}
        <p class="sentence">
          {#if ja}
            <JaSentence
              text={ex.ja}
              start={ex.start}
              end={ex.end}
              mode={given === null ? 'blank' : 'mark'}
            />
          {:else}
            <PlainSentence
              text={ex.ja}
              start={ex.start}
              end={ex.end}
              mode={given === null ? 'blank' : 'filled'}
              {lang}
            />
          {/if}
        </p>
        <p class="muted">{translation(ex).text}</p>
        <p class="muted">{t('courses.quiz.fill')}</p>
      {:else if q.type === 'form'}
        {@const ex = formEx(q)}
        <p class="big word" class:data={!lang} {lang} data-prompt>{ex?.base}</p>
        {#if ex?.baseReading}<p class="faint" {lang}>{ex.baseReading}</p>{/if}
        {#if ex?.meaning}<p class="faint">{txt(ex.meaning)}</p>{/if}
        <p class="muted">{t('courses.quiz.form', { form: txt(course.forms?.[q.key]?.title) })}</p>
      {:else if q.type === 'phrase' && q.mode === 'listen'}
        <button class="btn listen" data-replay onclick={play} title={t('courses.quiz.replay')}
          ><Volume2 size={28} /></button
        >
        <p class="muted">{t('courses.quiz.phraseListen')}</p>
      {:else if q.type === 'phrase'}
        {@const ph = phrase(q.key)}
        {#if q.mode === 'meaning'}
          <p class="phrase-prompt" class:data={!lang} {lang} data-prompt>{ph?.text}</p>
          {#if ph?.script}<p class="script" style={scriptCss(ph.scriptId)}>{ph.script}</p>{/if}
          <p class="muted">{t('courses.quiz.phraseMeaning')}</p>
        {:else}
          <p class="phrase-prompt" data-prompt>{txt(ph?.meaning)}</p>
          <p class="muted">{t('courses.quiz.phrasePick')}</p>
        {/if}
      {/if}

      {#if q.type === 'type'}
        <div class="typed">
          <input
            bind:this={input}
            bind:value={typed}
            data-typed
            data-expect={sym(q.key)?.reading}
            disabled={given !== null}
            placeholder={t('courses.quiz.typeHint')}
            onkeydown={submitTyped}
          />
          {#if given === null}
            <button
              class="btn primary"
              data-check
              disabled={!typed.trim()}
              onclick={() => courses.answer(typed)}>{t('courses.quiz.check')}</button
            >
          {/if}
        </div>
      {:else}
        <div class="choices" class:symbols={q.type === 'write' || q.type === 'listen'}>
          {#each choices(q) as c, i (c.value)}
            {@const isCorrect = c.value === correct(q)}
            <button
              class="btn choice"
              class:right={given !== null && isCorrect}
              class:wrong={given !== null && c.value === given && !isCorrect}
              class:dim={given !== null && !isCorrect && c.value !== given}
              data-choice={c.value}
              data-correct={isCorrect ? '' : undefined}
              disabled={given !== null}
              onclick={() => choose(c.value)}
            >
              <span class="n faint">{i + 1}</span>
              <span
                class="label"
                style={c.font}
                class:data={!lang &&
                  (q.type === 'form' || (q.type === 'phrase' && q.mode !== 'meaning'))}
                lang={q.type === 'write' ||
                q.type === 'listen' ||
                q.type === 'fill' ||
                q.type === 'form' ||
                (q.type === 'phrase' && q.mode !== 'meaning')
                  ? lang
                  : undefined}>{c.label}</span
              >
            </button>
          {/each}
        </div>
      {/if}
    </div>

    {#if given !== null}
      <div class="feedback" data-feedback={last?.right ? 'right' : 'wrong'}>
        <p class={last?.right ? 'good' : 'bad'}>
          {last?.right
            ? t('courses.quiz.right')
            : t('courses.quiz.wrong', { answer: answerText(q) })}
        </p>
        {#if q.type === 'word'}
          <p class="explain">
            <span style={scriptCss(q.word.scriptId)} {lang}>{q.word.text}</span>
            {#if q.word.head}<span {lang}>（{q.word.head}）</span>{/if}
            = {q.word.reading}
            <span class="muted">{txt(q.word.meaning)}</span>
            {#if sayable(q.word.say)}<Pronounce item={sayable(q.word.say)!} />{/if}
          </p>
        {:else if q.type === 'meaning' || q.type === 'fill'}
          {@const g = course.grammar[q.key]}
          <p class="explain">
            <strong {lang}>{g.name}</strong>
            <span>{meanings(g.meaning).main}</span>
            <span class="muted">{translation(g.examples[q.ex]).text}</span>
          </p>
        {:else if q.type === 'form'}
          {@const ex = formEx(q)}
          {#if ex}
            <p class="explain">
              <span {lang}>{ex.base}</span> → <strong {lang}>{ex.form}</strong>
              {#if ex.formReading}<span class="muted" {lang}>{ex.formReading}</span>{/if}
              {#if sayable(ex.say)}<Pronounce item={sayable(ex.say)!} />{/if}
            </p>
          {/if}
        {:else if q.type === 'phrase'}
          {@const ph = phrase(q.key)}
          {#if ph}
            <p class="explain">
              <strong {lang}>{ph.text}</strong>
              {#if ph.reading}<span class="muted" {lang}>{ph.reading}</span>{/if}
              <span>{txt(ph.meaning)}</span>
              {#if sayable(ph.say)}<Pronounce item={sayable(ph.say)!} />{/if}
            </p>
          {/if}
        {:else}
          {@const s = sym(q.key)}
          {#if s}
            <p class="explain">
              <span class="mh" style={scriptCss(s.scriptId)} {lang}>{s.symbol}</span>
              = {s.reading}
              {#if s.pair}<span class="muted" {lang}>{s.pair}</span>{/if}
              {#if sayable(s.say)}<Pronounce item={sayable(s.say)!} />{/if}
            </p>
          {/if}
        {/if}
        <button class="btn primary" data-quiz-next onclick={() => courses.next()}
          >{run.i + 1 < run.questions.length
            ? t('courses.quiz.next')
            : t('courses.quiz.finish')}<ArrowRight size={16} /></button
        >
      </div>
    {/if}
    <p class="faint keys">{t('courses.quiz.keys')}</p>
  {/if}
</div>

<style>
  .quiz {
    max-width: 760px;
    margin: 0 auto;
    padding: 20px 24px 40px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .bar {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .grow {
    flex: 1;
  }
  .track {
    height: 4px;
    border-radius: 2px;
    background: var(--bg-sunken);
    overflow: hidden;
  }
  .fill {
    height: 100%;
    background: var(--accent);
    transition: width 0.2s;
  }
  .question {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    padding: 28px 24px;
    text-align: center;
  }
  .big {
    font-size: 72px;
    line-height: 1.15;
  }
  .big.reading {
    font-family: var(--font-data);
    font-size: 44px;
  }
  .big.word {
    font-size: 44px;
  }
  .sentence {
    font-size: 22px;
  }
  .phrase-prompt {
    font-size: 30px;
    font-weight: 600;
  }
  .script {
    font-size: 24px;
  }
  .data {
    font-family: var(--font-data);
  }
  .listen {
    padding: 18px 22px;
    border-radius: 999px;
  }
  .choices {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    width: 100%;
  }
  .choices.symbols {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
  .choice {
    justify-content: flex-start;
    gap: 10px;
    padding: 12px 14px;
    white-space: normal;
    text-align: start;
  }
  .choices.symbols .choice {
    justify-content: center;
  }
  .choices.symbols .label {
    font-size: 30px;
  }
  .choice .label {
    font-size: 17px;
  }
  .choice:disabled {
    opacity: 1;
  }
  .choice.right {
    border-color: #2f9e63;
    background: color-mix(in srgb, #2f9e63 14%, var(--bg-elev));
  }
  .choice.wrong {
    border-color: var(--danger);
    background: var(--danger-soft);
  }
  .choice.dim {
    opacity: 0.55;
  }
  .n {
    min-width: 12px;
  }
  .typed {
    display: flex;
    gap: 8px;
  }
  .typed input {
    font-size: 20px;
    padding: 6px 10px;
    width: 220px;
  }
  .feedback {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }
  .good {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: #23804f;
    font-weight: 600;
  }
  .bad {
    color: var(--danger);
    font-weight: 600;
  }
  .explain {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: center;
  }
  .mh {
    font-size: 22px;
  }
  .keys {
    text-align: center;
  }
  .result {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 32px;
    text-align: center;
  }
  .score {
    font-size: 20px;
  }
  .missed {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .missed ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 6px 14px;
  }
  .missed li {
    display: flex;
    align-items: baseline;
    gap: 6px;
  }
  .row {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: center;
  }
</style>
