// =============================================================================
// Export PDF DeviceCMYK (test) — construit un PDF où l'image est stockée en CMJN.
// =============================================================================
// Objectif : contourner la conversion RGB→CMJN que fait l'imprimante (souvent trop
// sombre) en fournissant DIRECTEMENT des valeurs CMJN. Conversion « naïve » (sans
// profil ICC) : ce n'est pas de la gestion de couleur pro, mais un essai pour voir
// si le tirage sort plus proche de l'écran. Aucune dépendance : on écrit le PDF à la
// main (flux compressé zlib via CompressionStream, sinon flux brut).

/** Déflate (format zlib, attendu par /FlateDecode) via l'API CompressionStream. */
async function deflateZlib(bytes: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream('deflate')
  const writer = cs.writable.getWriter()
  void writer.write(bytes as unknown as BufferSource)
  void writer.close()
  const chunks: Uint8Array[] = []
  const reader = cs.readable.getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value as Uint8Array)
  }
  let n = 0
  for (const c of chunks) n += c.length
  const out = new Uint8Array(n)
  let o = 0
  for (const c of chunks) {
    out.set(c, o)
    o += c.length
  }
  return out
}

/**
 * Construit un PDF d'une page (A4/A5) contenant le visuel en DeviceCMYK.
 * @param gamma éclaircissement appliqué AVANT la conversion (1 = aucun) — même logique que la
 *              compensation impression, pour comparer à armes égales avec le PDF RGB.
 */
export async function buildPosterPdfCmykBlob(
  canvas: HTMLCanvasElement,
  size: 'A4' | 'A5',
  gamma = 1,
): Promise<Blob> {
  const w = canvas.width
  const h = canvas.height
  const rgba = canvas.getContext('2d')!.getImageData(0, 0, w, h).data

  // Table gamma (éclaircissement optionnel) réutilisée pour chaque canal.
  const lut = new Uint8Array(256)
  if (gamma > 1.001) {
    const inv = 1 / gamma
    for (let i = 0; i < 256; i++) lut[i] = Math.round(255 * Math.pow(i / 255, inv))
  } else {
    for (let i = 0; i < 256; i++) lut[i] = i
  }

  // RGB -> CMJN (8 bits/canal, 0 = pas d'encre, 255 = encre pleine).
  const cmyk = new Uint8Array(w * h * 4)
  for (let p = 0, q = 0; q < cmyk.length; p += 4, q += 4) {
    const r = lut[rgba[p]]
    const g = lut[rgba[p + 1]]
    const b = lut[rgba[p + 2]]
    const k = 255 - Math.max(r, g, b)
    if (k >= 255) {
      cmyk[q + 3] = 255 // noir pur (C=M=Y=0 déjà par défaut)
    } else {
      const d = 255 - k
      cmyk[q] = Math.round(((255 - r - k) * 255) / d)
      cmyk[q + 1] = Math.round(((255 - g - k) * 255) / d)
      cmyk[q + 2] = Math.round(((255 - b - k) * 255) / d)
      cmyk[q + 3] = k
    }
  }

  // Flux image : compressé si CompressionStream dispo, sinon brut (PDF plus lourd mais valide).
  let stream: Uint8Array = cmyk
  let filter = ''
  if (typeof CompressionStream !== 'undefined') {
    stream = await deflateZlib(cmyk)
    filter = ' /Filter /FlateDecode'
  }

  // Dimensions page en points (1/72"). A-series au ratio √2 → l'image couvre la page.
  const [pw, ph] = size === 'A4' ? [595.28, 841.89] : [419.53, 595.28]

  const enc = new TextEncoder()
  const chunks: Uint8Array[] = []
  let len = 0
  const off: number[] = []
  const put = (x: string | Uint8Array) => {
    const bytes = typeof x === 'string' ? enc.encode(x) : x
    chunks.push(bytes)
    len += bytes.length
  }

  // En-tête + marqueur binaire.
  put(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x35, 0x0a, 0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]))
  off[1] = len
  put('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n')
  off[2] = len
  put('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n')
  off[3] = len
  put(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] ` +
      `/Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`,
  )
  off[4] = len
  put(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} ` +
      `/ColorSpace /DeviceCMYK /BitsPerComponent 8${filter} /Length ${stream.length} >>\nstream\n`,
  )
  put(stream)
  put('\nendstream\nendobj\n')
  const content = `q ${pw} 0 0 ${ph} 0 0 cm /Im0 Do Q`
  off[5] = len
  put(`5 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`)

  const xref = len
  let table = 'xref\n0 6\n0000000000 65535 f \n'
  for (let i = 1; i <= 5; i++) table += String(off[i]).padStart(10, '0') + ' 00000 n \n'
  put(table)
  put(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`)

  const total = new Uint8Array(len)
  let o = 0
  for (const c of chunks) {
    total.set(c, o)
    o += c.length
  }
  return new Blob([total as BlobPart], { type: 'application/pdf' })
}
