import { Document, Page, View, Text, Image, Font, StyleSheet } from '@react-pdf/renderer'

// 1 mm en points PDF (unité par défaut de @react-pdf).
const MM = 2.83465
const A4_W = 210
const A4_H = 297
const MARGIN = 8 // marge blanche autour de la planche (mm)

// Police « craie » manuscrite — servie en local (public/fonts), même origine que l'app.
// Déposer le fichier TTF à : frontend/public/fonts/PermanentMarker-Regular.ttf
// (téléchargeable sur fonts.google.com → « Permanent Marker »). Si absent, repli Helvetica.
const CHALK = 'ChalkHand'
try {
  Font.register({ family: CHALK, src: '/fonts/PermanentMarker-Regular.ttf' })
} catch {
  // Police indisponible → repli silencieux sur Helvetica.
}

export interface LabelItem {
  name: string
  /** Prix déjà formaté (ex. « 1,80 € »), ou null pour ne pas l'afficher. */
  price: string | null
  /** Texte libre sous le nom (allergènes, ingrédients, promo…), ou null. */
  note?: string | null
}

export interface LabelsPdfData {
  items: LabelItem[]
  widthMm: number
  heightMm: number
  brand: string
  /** Couleurs du modèle (libres). */
  bgColor: string
  textColor: string
  /** Multiplicateur de taille de police du nom/prix (1 = auto). */
  fontScale: number
  /** Cadre décoratif : aucun ou « bois ». */
  frame: 'none' | 'wood'
  /** Police manuscrite type craie (pour le rendu ardoise). */
  chalk: boolean
  /** Logo de l'entreprise (data URL), affiché en petit en bas — ou null. */
  logoUrl: string | null
}

/** Planche A4 d'étiquettes à découper (grille calculée selon la taille demandée). */
export function LabelsPdf({ data }: { data: LabelsPdfData }) {
  const { items, widthMm, heightMm, brand, bgColor, textColor, fontScale, frame, chalk, logoUrl } = data
  const w = widthMm * MM
  const h = heightMm * MM
  const titleFont = chalk ? CHALK : 'Helvetica-Bold'

  // Police du nom adaptée à la largeur, ajustée par le multiplicateur du modèle.
  const nameSize = Math.max(7, Math.min(44, Math.round(widthMm * 0.2 * fontScale)))
  const priceSize = Math.max(7, Math.min(32, Math.round(widthMm * 0.16 * fontScale)))
  const logoH = Math.min(heightMm * 0.16, 9) * MM
  const woodW = Math.max(4, Math.min(16, Math.round(Math.min(widthMm, heightMm) * 0.06)))

  const styles = StyleSheet.create({
    page: { padding: MARGIN * MM, backgroundColor: '#ffffff' },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    label: {
      width: w,
      height: h,
      backgroundColor: bgColor,
      borderWidth: 0.7,
      borderStyle: 'dashed',
      borderColor: textColor,
    },
    woodOuter: { flexGrow: 1, borderWidth: woodW, borderColor: '#6b4423' },
    woodInner: { flexGrow: 1, borderWidth: 0.8, borderColor: '#caa06a' },
    body: {
      flexGrow: 1,
      paddingVertical: 5 * MM,
      paddingHorizontal: 6 * MM,
      justifyContent: 'space-between',
    },
    nameWrap: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
    name: {
      fontFamily: titleFont,
      color: textColor,
      fontSize: nameSize,
      textAlign: 'center',
      textTransform: 'uppercase',
      lineHeight: 1.15,
    },
    note: {
      fontFamily: chalk ? CHALK : 'Helvetica',
      color: textColor,
      opacity: 0.85,
      fontSize: Math.max(6, Math.round(nameSize * 0.42)),
      textAlign: 'center',
      marginTop: 2 * MM,
      lineHeight: 1.2,
    },
    sep: { borderTopWidth: 0.7, borderTopColor: textColor, opacity: 0.25, marginTop: 4 * MM, marginBottom: 3 * MM },
    footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
    brandWrap: { flexDirection: 'row', alignItems: 'center', maxWidth: '65%' },
    logo: { height: logoH, maxWidth: 22 * MM, objectFit: 'contain', marginRight: 3 * MM },
    brand: {
      fontFamily: titleFont,
      color: textColor,
      opacity: 0.7,
      fontSize: 8,
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    price: { fontFamily: titleFont, color: textColor, fontSize: priceSize },
  })

  // Pagination déterministe : combien d'étiquettes tiennent par page A4.
  const cols = Math.max(1, Math.floor((A4_W - 2 * MARGIN) / widthMm))
  const rows = Math.max(1, Math.floor((A4_H - 2 * MARGIN) / heightMm))
  const perPage = cols * rows
  const pages: LabelItem[][] = []
  for (let i = 0; i < items.length; i += perPage) pages.push(items.slice(i, i + perPage))
  if (pages.length === 0) pages.push([])

  const body = (it: LabelItem) => (
    <View style={styles.body}>
      <View style={styles.nameWrap}>
        <Text style={styles.name}>{it.name}</Text>
        {it.note ? <Text style={styles.note}>{it.note}</Text> : null}
      </View>
      <View>
        <View style={styles.sep} />
        <View style={styles.footer}>
          <View style={styles.brandWrap}>
            {logoUrl ? <Image src={logoUrl} style={styles.logo} /> : null}
            <Text style={styles.brand}>{brand}</Text>
          </View>
          {it.price ? <Text style={styles.price}>{it.price}</Text> : null}
        </View>
      </View>
    </View>
  )

  return (
    <Document>
      {pages.map((pageItems, p) => (
        <Page key={p} size="A4" style={styles.page}>
          <View style={styles.grid}>
            {pageItems.map((it, i) => (
              <View key={i} style={styles.label} wrap={false}>
                {frame === 'wood' ? (
                  <View style={styles.woodOuter}>
                    <View style={styles.woodInner}>{body(it)}</View>
                  </View>
                ) : (
                  body(it)
                )}
              </View>
            ))}
          </View>
        </Page>
      ))}
    </Document>
  )
}
