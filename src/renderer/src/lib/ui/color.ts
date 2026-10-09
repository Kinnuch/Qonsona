/** 强调色底上用白字还是深字：按 WCAG 相对亮度，哪个对比度高用哪个 */
export function contrastText(hex: string): string {
  const m = hex.replace('#', '')
  const full = m.length === 3 ? [...m].map((c) => c + c).join('') : m
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(full.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
  // 白字对比度 (1.05)/(L+0.05)，深字（#1f1f1f，亮度约 0.0137）对比度 (L+0.05)/0.0637
  return 1.05 / (lum + 0.05) >= (lum + 0.05) / 0.0637 ? '#ffffff' : '#1f1f1f'
}
