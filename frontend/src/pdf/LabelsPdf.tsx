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
  /** Badges propres à CETTE étiquette (Kasher, Vegan, médaille…). */
  badges?: { text?: string | null; img?: string | null; color?: string | null }[]
}

/** Mise en forme d'un modèle d'étiquette (taille, couleurs, cadre…). */
export interface LabelStyle {
  widthMm: number
  heightMm: number
  brand: string
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
  /** Position des badges : haut-droite, haut-gauche, ou dans le pied (entre marque et prix). */
  badgePos?: 'tr' | 'tl' | 'footer'
  /** Multiplicateur de taille de l'image du badge (médaille). */
  badgeScale?: number
}

/** Un groupe = un modèle d'étiquette + les étiquettes qui le portent (ses propres planches A4). */
export interface LabelGroup extends LabelStyle {
  items: LabelItem[]
}

export interface LabelsPdfData {
  /** Un groupe par modèle : chaque modèle démarre sur ses propres pages (grille à sa taille). */
  groups: LabelGroup[]
  /** Logo de l'entreprise (data URL), affiché en petit en bas — ou null. */
  logoUrl: string | null
}

/** Rend les pages A4 d'UN groupe (un modèle) : grille calculée selon sa taille d'étiquette. */
function groupPages(group: LabelGroup, logoUrl: string | null, keyPrefix: string) {
  const { items, widthMm, heightMm, brand, bgColor, textColor, borderColor, fill, fontScale, frame, chalk } = group
  const badgePos = group.badgePos ?? 'tr'
  const badgeScale = group.badgeScale ?? 1

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
    footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    brandWrap: { flexDirection: 'row', alignItems: 'center', maxWidth: '50%' },
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
      alignItems: badgePos === 'tl' ? 'flex-start' : 'flex-end',
      gap: 1.5 * MM,
    },
    footerBadges: { flexDirection: 'row', alignItems: 'center', gap: 1.2 * MM, marginHorizontal: 2 * MM },
    badgeImg: {
      width: Math.min(effW * 0.24, 18) * MM * badgeScale,
      height: Math.min(effW * 0.24, 18) * MM * badgeScale,
      objectFit: 'contain',
    },
    badgeImgFooter: { height: logoH * badgeScale, maxWidth: 26 * MM, objectFit: 'contain', alignSelf: 'center' },
    badgeText: {
      fontFamily: 'Helvetica-Bold',
      fontSize: Math.max(6, Math.round(nameSize * 0.32 * badgeScale)),
      color: '#ffffff',
      borderRadius: 3,
      paddingTop: 1.4 * MM,
      paddingBottom: 0.6 * MM,
      paddingHorizontal: 2 * MM,
      textAlign: 'center',
      textTransform: 'uppercase',
    },
    badgeTextFooter: {
      fontFamily: 'Helvetica-Bold',
      fontSize: Math.max(6, Math.round(8 * badgeScale)),
      color: '#ffffff',
      borderRadius: 2,
      paddingTop: 0.8 * MM,
      paddingBottom: 0.5 * MM,
      paddingHorizontal: 1.6 * MM,
      textAlign: 'center',
      textTransform: 'uppercase',
      alignSelf: 'center',
    },
  })

  // Pastille pleine : fond = couleur du badge, police blanche.
  const renderBadge = (b: { text?: string | null; img?: string | null; color?: string | null }, i: number, footer: boolean) =>
    b.img ? (
      <Image key={i} src={b.img} style={footer ? styles.badgeImgFooter : styles.badgeImg} />
    ) : (
      <Text key={i} style={[footer ? styles.badgeTextFooter : styles.badgeText, { backgroundColor: b.color || textColor }]}>
        {b.text}
      </Text>
    )
  // Badges de l'étiquette courante (chaque produit peut avoir les siens).
  const itemBadges = (it: LabelItem) => (it.badges ?? []).filter((b) => b.img || b.text?.trim())
  const cornerBadgeFor = (it: LabelItem) => {
    const bs = itemBadges(it)
    return bs.length > 0 && badgePos !== 'footer' ? (
      <View style={styles.badgeCorner}>{bs.map((b, i) => renderBadge(b, i, false))}</View>
    ) : null
  }
  const footerBadgeFor = (it: LabelItem) => {
    const bs = itemBadges(it)
    return bs.length > 0 && badgePos === 'footer' ? (
      <View style={styles.footerBadges}>{bs.map((b, i) => renderBadge(b, i, true))}</View>
    ) : null
  }

  // Pagination déterministe : autant d'étiquettes que la grille cols×rows calculée plus haut.
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
          {footerBadgeFor(it)}
          {it.price ? <Text style={styles.price}>{it.price}</Text> : null}
        </View>
      </View>
    </View>
  )

  return pages.map((pageItems, p) => (
    <Page key={`${keyPrefix}-${p}`} size="A4" style={styles.page}>
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
            {cornerBadgeFor(it)}
          </View>
        ))}
      </View>
    </Page>
  ))
}

// Style neutre pour le cas « aucune étiquette » (une page A4 vide plutôt qu'un PDF invalide).
const EMPTY_STYLE: LabelStyle = {
  widthMm: 100,
  heightMm: 60,
  brand: '',
  bgColor: '#ffffff',
  textColor: '#111111',
  borderColor: '#111111',
  fill: false,
  fontScale: 1,
  frame: 'none',
  chalk: false,
}

/** Planches A4 d'étiquettes à découper — un groupe de pages par modèle sélectionné. */
export function LabelsPdf({ data }: { data: LabelsPdfData }) {
  const groups = data.groups.filter((g) => g.items.length > 0)
  return (
    <Document>
      {groups.length === 0
        ? groupPages({ ...EMPTY_STYLE, items: [] }, data.logoUrl, 'empty')
        : groups.flatMap((g, gi) => groupPages(g, data.logoUrl, `g${gi}`))}
    </Document>
  )
}
