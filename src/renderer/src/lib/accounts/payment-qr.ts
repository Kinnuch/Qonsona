import qrcode from 'qrcode-generator'

/** Encode the main-process-validated payment URL locally; no remote image requests or HTML. */
export function paymentQr(value: string): { size: number; path: string } | null {
  if (!value || value.length > 2048) return null
  try {
    const code = qrcode(0, 'M')
    code.addData(value, 'Byte')
    code.make()
    const count = code.getModuleCount()
    const paths: string[] = []
    for (let row = 0; row < count; row++)
      for (let column = 0; column < count; column++)
        if (code.isDark(row, column)) paths.push(`M${column + 4} ${row + 4}h1v1h-1z`)
    return { size: count + 8, path: paths.join('') }
  } catch {
    return null
  }
}
