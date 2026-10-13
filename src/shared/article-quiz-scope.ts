import type { ArticleQuizProgress } from './article-quiz'

export interface ArticleQuizScope {
  readonly packId: string
  readonly id: string
  readonly generation: number
}
/** A returned A is a new generation, even when its material id equals the departed A. */
export class ArticleQuizScopeGate {
  #generation = 0
  begin(packId: string, id: string): ArticleQuizScope {
    return Object.freeze({ packId, id, generation: ++this.#generation })
  }
  invalidate(): void {
    this.#generation++
  }
  current(scope: ArticleQuizScope, packId: string, id: string): boolean {
    return scope.generation === this.#generation && scope.packId === packId && scope.id === id
  }
}
/** Capture both the destination and content before asynchronous writes; completion belongs to that scope. */
export async function saveScopedArticleQuiz(
  scope: ArticleQuizScope,
  progress: ArticleQuizProgress,
  write: (packId: string, id: string, data: ArticleQuizProgress) => Promise<unknown>,
  completed?: (scope: ArticleQuizScope) => void
): Promise<void> {
  const captured = structuredClone(progress)
  await write(scope.packId, scope.id, captured)
  completed?.(scope)
}
