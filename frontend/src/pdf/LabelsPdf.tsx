import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'

// 1 mm en points PDF (unité par défaut de @react-pdf).
const MM = 2.83465
const A4_W = 210
const A4_H = 297
const MARGIN = 8 // marge blanche autour de la planche (mm)

export interface LabelItem {
  name: string
  /** Prix déjà formaté (ex. « 1,80 € »), ou null pour ne pas l'afficher. */
  price: string | null
}

export interface LabelsPdfData {
  items: LabelItem[]
  widthMm: number
  heightMm: number
  brand: string
  /** Couleurs du modèle (libres). */
  bgColor: string
  textColor: string
  /** Logo de l'entreprise (data URL), affiché en petit en bas — ou null. */
  logoUrl: string | null
}

/** Planche A4 d'étiquettes à découper (grille calculée selon la taille demandée). */
export function LabelsPdf({ data }: { data: LabelsPdfData }) {
  const { items, widthMm, heightMm, brand, bgColor, textColor, logoUrl } = data
  const w = widthMm * MM
  const h = heightMm * MM

  // Police du nom adaptée à la largeur de l'étiquette.
  const nameSize = Math.max(8, Math.min(24, Math.round(widthMm * 0.2)))
  const priceSize = Math.max(8, Math.min(18, Math.round(widthMm * 0.16)))
  const logoH = Math.min(heightMm * 0.16, 9) * MM

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
      paddingVertical: 5 * MM,
      paddingHorizontal: 6 * MM,
      justifyContent: 'space-between',
    },
    nameWrap: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
    name: {
      fontFamily: 'Helvetica-Bold',
      color: textColor,
      fontSize: nameSize,
      textAlign: 'center',
      textTransform: 'uppercase',
      lineHeight: 1.15,
    },
    sep: { borderTopWidth: 0.7, borderTopColor: textColor, opacity: 0.25, marginTop: 4 * MM, marginBottom: 3 * MM },
    footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
    brandWrap: { flexDirection: 'row', alignItems: 'center', maxWidth: '65%' },
    logo: { height: logoH, maxWidth: 22 * MM, objectFit: 'contain', marginRight: 3 * MM },
    brand: {
      color: textColor,
      opacity: 0.7,
      fontSize: 8,
      letterSpacing: 1,
      textTransform: 'uppercase',
      fontFamily: 'Helvetica-Bold',
    },
    price: { color: textColor, fontSize: priceSize, fontFamily: 'Helvetica-Bold' },
  })

  // Pagination déterministe : combien d'étiquettes tiennent par page A4.
  const cols = Math.max(1, Math.floor((A4_W - 2 * MARGIN) / widthMm))
  const rows = Math.max(1, Math.floor((A4_H - 2 * MARGIN) / heightMm))
  const perPage = cols * rows
  const pages: LabelItem[][] = []
  for (let i = 0; i < items.length; i += perPage) pages.push(items.slice(i, i + perPage))
  if (pages.length === 0) pages.push([])

  return (
    <Document>
      {pages.map((pageItems, p) => (
        <Page key={p} size="A4" style={styles.page}>
          <View style={styles.grid}>
            {pageItems.map((it, i) => (
              <View key={i} style={styles.label} wrap={false}>
                <View style={styles.nameWrap}>
                  <Text style={styles.name}>{it.name}</Text>
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
            ))}
          </View>
        </Page>
      ))}
    </Document>
  )
}
