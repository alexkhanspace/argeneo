import { Document, Page, View, Text, Image, Font, StyleSheet } from '@react-pdf/renderer'

// 1 mm en points PDF (unité par défaut de @react-pdf).
const MM = 2.83465
const A4_W = 210
const A4_H = 297
const MARGIN = 5 // marge blanche autour de la planche (mm) — réduite pour limiter les pertes

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
  /** Couleur de la bordure (pointillés de découpe). */
  borderColor: string
  /** Agrandit les étiquettes pour remplir l'A4 (moins de blanc/perte), ratio conservé. */
  fill: boolean
  /** Multiplicateur de taille de police du nom/prix (1 = auto). */
  fontScale: number
  /** Cadre décoratif : aucun ou « bois ». */
  frame: 'none' | 'wood'
  /** Police manuscrite type craie (pour le rendu ardoise). */
  chalk: boolean
  /** Logo de l'entreprise (data URL), affiché en petit en bas — ou null. */
  logoUrl: string | null
  /** Badge perso (ex. « Kasher », médaille) — image prioritaire, sinon texte. */
  badgeText?: string | null
  badgeUrl?: string | null
  /** Position du badge : haut-droite, haut-gauche, ou dans le pied (entre marque et prix). */
  badgePos?: 'tr' | 'tl' | 'footer'
  /** Multiplicateur de taille de l'image du badge (médaille). */
  badgeScale?: number
  /** Couleur du badge texte (texte + contour). */
  badgeColor?: string
}

/** Planche A4 d'étiquettes à découper (grille calculée selon la taille demandée). */
export function LabelsPdf({ data }: { data: LabelsPdfData }) {
  const { items, widthMm, heightMm, brand, bgColor, textColor, borderColor, fill, fontScale, frame, chalk, logoUrl } =
    data
  const badgeText = data.badgeText?.trim() || null
  const badgeUrl = data.badgeUrl || null
  const badgePos = data.badgePos ?? 'tr'
  const badgeScale = data.badgeScale ?? 1
  const badgeColor = data.badgeColor ?? textColor

  // Combien d'étiquettes par page A4, puis agrandissement éventuel pour remplir la feuille.
  const usableW = A4_W - 2 * MARGIN
  const usableH = A4_H - 2 * MARGIN
  const cols = Math.max(1, Math.floor(usableW / widthMm))
  const rows = Math.max(1, Math.floor(usableH / heightMm))
  // « Remplir » : agrandit uniformément (ratio conservé) jusqu'à la dimension la plus contraignante.
  const fillScale = fill ? Math.min(usableW / (cols * widthMm), usableH / (rows * heightMm)) : 1
  const effW = widthMm * fillScale
  const effH = heightMm * fillScale

  const w = effW * MM
  const h = effH * MM
  const titleFont = chalk ? CHALK : 'Helvetica-Bold'

  // Police du nom adaptée à la largeur, ajustée par le multiplicateur du modèle.
  const nameSize = Math.max(7, Math.min(60, Math.round(effW * 0.2 * fontScale)))
  const priceSize = Math.max(7, Math.min(44, Math.round(effW * 0.16 * fontScale)))
  const logoH = Math.min(effH * 0.16, 9) * MM
  const woodW = Math.max(4, Math.min(16, Math.round(Math.min(effW, effH) * 0.06)))

  const styles = StyleSheet.create({
    page: { padding: MARGIN * MM, backgroundColor: '#ffffff' },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    label: {
      width: w,
      height: h,
      backgroundColor: bgColor,
      borderWidth: 0.7,
      borderStyle: 'dashed',
      borderColor: borderColor,
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
    badgeCorner: {
      position: 'absolute',
      // On écarte de la bordure (et de l'épaisseur du cadre bois) pour ne pas « manger » le badge.
      top: (frame === 'wood' ? woodW + 2.5 : 4) * MM,
      ...(badgePos === 'tl'
        ? { left: (frame === 'wood' ? woodW + 2.5 : 4) * MM }
        : { right: (frame === 'wood' ? woodW + 2.5 : 4) * MM }),
      alignItems: 'center',
    },
    badgeImg: {
      width: Math.min(effW * 0.24, 18) * MM * badgeScale,
      height: Math.min(effW * 0.24, 18) * MM * badgeScale,
      objectFit: 'contain',
    },
    badgeImgFooter: { height: logoH * badgeScale, maxWidth: 26 * MM, objectFit: 'contain', alignSelf: 'center' },
    badgeText: {
      fontFamily: 'Helvetica-Bold',
      fontSize: Math.max(6, Math.round(nameSize * 0.34)),
      color: badgeColor,
      borderWidth: 0.8,
      borderColor: badgeColor,
      borderRadius: 3,
      paddingTop: 1.4 * MM,
      paddingBottom: 0.6 * MM,
      paddingHorizontal: 2 * MM,
      textAlign: 'center',
      textTransform: 'uppercase',
    },
    badgeTextFooter: {
      fontFamily: 'Helvetica-Bold',
      fontSize: 8,
      color: badgeColor,
      borderWidth: 0.7,
      borderColor: badgeColor,
      borderRadius: 2,
      paddingTop: 1 * MM,
      paddingBottom: 0.4 * MM,
      paddingHorizontal: 1.6 * MM,
      textAlign: 'center',
      textTransform: 'uppercase',
      alignSelf: 'center',
    },
  })

  const hasBadge = Boolean(badgeUrl || badgeText)
  // Badge en coin (absolu) — sauf en mode « footer ».
  const cornerBadge = hasBadge && badgePos !== 'footer' && (
    <View style={styles.badgeCorner}>
      {badgeUrl ? <Image src={badgeUrl} style={styles.badgeImg} /> : <Text style={styles.badgeText}>{badgeText}</Text>}
    </View>
  )
  // Badge dans le pied (entre la marque et le prix).
  const footerBadge =
    hasBadge && badgePos === 'footer' ? (
      badgeUrl ? (
        <Image src={badgeUrl} style={styles.badgeImgFooter} />
      ) : (
        <Text style={styles.badgeTextFooter}>{badgeText}</Text>
      )
    ) : null

  // Pagination déterministe : autant d'étiquettes que la grille cols×rois calculée plus haut.
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
          {footerBadge}
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
                {cornerBadge}
              </View>
            ))}
          </View>
        </Page>
      ))}
    </Document>
  )
}
