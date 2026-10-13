/** Artwork stays at its source pixel size; frame limits can only shrink it. */
export function spriteSize(
  source: { width: number; height: number },
  frame: { width: number; height: number }
): { width: number; height: number } {
  const scale = Math.min(1, frame.width / source.width, frame.height / source.height)
  return { width: source.width * scale, height: source.height * scale }
}
