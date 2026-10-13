/** Identity includes both the language-load generation and individual start request. */
export interface StudyRequest {
  readonly id: number
  readonly packId: string | null
  readonly loadEpoch: number
}
export class StudyRequestGate {
  #id = 0
  begin(packId: string | null, loadEpoch: number): StudyRequest {
    return { id: ++this.#id, packId, loadEpoch }
  }
  cancel(): void {
    this.#id++
  }
  accepts(request: StudyRequest, packId: string | null, loadEpoch: number): boolean {
    return (
      !!request.packId &&
      request.id === this.#id &&
      request.packId === packId &&
      request.loadEpoch === loadEpoch
    )
  }
}
