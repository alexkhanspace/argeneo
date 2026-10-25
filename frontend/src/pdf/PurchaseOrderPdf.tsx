import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'

export interface PoPdfLine {
  section: string | null
  code: string | null
  designation: string
  designationAlt?: string | null
  packaging: string | null
  unitPrice: number | null
  priceUnit: string | null
  /** null = case vide (cadencier vierge). */
  quantity: number | null
}

export interface PoPdfData {
  title: string
  supplierName: string | null
  etablissementName: string | null
  orderDate: string | null
  deliveryDate: string | null
  notes: string | null
  createdByName: string | null
  color: string
  showPrices: boolean
  logoUrl: string | null
  lines: PoPdfLine[]
}

const eur = (v: number) =>
  v.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 4 })
const qty = (v: number) => v.toLocaleString('fr-FR', { maximumFractionDigits: 3 })
const date = (iso: string | null) => (iso ? new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR') : '')

/**
 * Bon de commande fournisseur (A4 portrait). « order » : lignes commandées avec quantités ;
 * « blank » : cadencier complet avec colonne quantité vide, à remplir à la main.
 */
export function PurchaseOrderPdf({ data, mode }: { data: PoPdfData; mode: 'order' | 'blank' }) {
  const c = /^#[0-9a-fA-F]{6}$/.test(data.color) ? data.color : '#1f4e79'
  const hasCode = data.lines.some((l) => l.code)
  const hasAlt = data.lines.some((l) => l.designationAlt)
  const hasPrice = data.showPrices && data.lines.some((l) => l.unitPrice != null)
  const s = StyleSheet.create({
    page: { padding: 28, paddingBottom: 40, fontSize: 9, fontFamily: 'Helvetica', color: '#222' },
    band: {
      backgroundColor: c,
      color: '#fff',
      paddingVertical: 10,
      paddingHorizontal: 12,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    title: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#fff' },
    sub: { fontSize: 9, color: '#fff', marginTop: 2 },
    logo: { height: 34, maxWidth: 120, objectFit: 'contain' },
    meta: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, marginBottom: 8 },
    metaItem: { marginRight: 18, marginBottom: 3 },
    metaLabel: { color: '#777' },
    metaVal: { fontFamily: 'Helvetica-Bold' },
    head: { flexDirection: 'row', backgroundColor: '#e8edf3', borderBottomWidth: 1, borderBottomColor: c },
    hCell: { paddingVertical: 5, paddingHorizontal: 4, fontFamily: 'Helvetica-Bold', fontSize: 8.5 },
    row: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#ddd' },
    alt: { backgroundColor: '#f7f8fa' },
    cell: { paddingVertical: 4, paddingHorizontal: 4 },
    section: {
      backgroundColor: '#f0f0f0',
      paddingVertical: 3,
      paddingHorizontal: 4,
      fontFamily: 'Helvetica-Bold',
      color: c,
      marginTop: 4,
    },
    cCode: { width: 62 },
    cName: { flex: 2 },
    cAlt: { flex: 1.5 },
    cPack: { width: 80, textAlign: 'center' },
    cPrice: { width: 62, textAlign: 'right' },
    cQty: { width: 58, textAlign: 'center', backgroundColor: '#fff8e1' },
    qtyStrong: { fontFamily: 'Helvetica-Bold', fontSize: 10 },
    notes: { marginTop: 10, padding: 6, borderWidth: 0.5, borderColor: '#ccc' },
    sign: { marginTop: 14, flexDirection: 'row', justifyContent: 'space-between', color: '#555' },
    footer: { position: 'absolute', bottom: 16, left: 28, right: 28, fontSize: 7, color: '#aaa', textAlign: 'center' },
  })

  return (
    <Document title={`${mode === 'blank' ? 'Cadencier' : 'Commande'} — ${data.title}`}>
      <Page size="A4" style={s.page}>
        <View style={s.band}>
          <View>
            <Text style={s.title}>{data.title.toUpperCase()}</Text>
            {data.supplierName ? <Text style={s.sub}>Fournisseur : {data.supplierName}</Text> : null}
          </View>
          {data.logoUrl ? <Image style={s.logo} src={data.logoUrl} /> : null}
        </View>

        <View style={s.meta}>
          <Text style={s.metaItem}>
            <Text style={s.metaLabel}>Lieu : </Text>
            <Text style={s.metaVal}>{data.etablissementName ?? '________________'}</Text>
          </Text>
          <Text style={s.metaItem}>
            <Text style={s.metaLabel}>Date : </Text>
            <Text style={s.metaVal}>{date(data.orderDate) || '____/____/______'}</Text>
          </Text>
          <Text style={s.metaItem}>
            <Text style={s.metaLabel}>Livraison : </Text>
            <Text style={s.metaVal}>{date(data.deliveryDate) || '____/____/______'}</Text>
          </Text>
          {data.createdByName ? (
            <Text style={s.metaItem}>
              <Text style={s.metaLabel}>Par : </Text>
              <Text style={s.metaVal}>{data.createdByName}</Text>
            </Text>
          ) : null}
        </View>

        <View style={s.head} fixed>
          {hasCode ? <Text style={[s.hCell, s.cCode]}>Code</Text> : null}
          <Text style={[s.hCell, s.cName]}>Désignation</Text>
          {hasAlt ? <Text style={[s.hCell, s.cAlt]}>Désignation (2)</Text> : null}
          <Text style={[s.hCell, s.cPack]}>Conditionnement</Text>
          {hasPrice ? <Text style={[s.hCell, s.cPrice]}>Prix</Text> : null}
          <Text style={[s.hCell, s.cQty]}>Quantité</Text>
        </View>

        {data.lines.map((l, i) => {
          const showSection = l.section && l.section !== data.lines[i - 1]?.section
          return (
            <View key={i} wrap={false}>
              {showSection ? <Text style={s.section}>{l.section}</Text> : null}
              <View style={i % 2 === 1 ? [s.row, s.alt] : s.row}>
                {hasCode ? <Text style={[s.cell, s.cCode]}>{l.code ?? ''}</Text> : null}
                <Text style={[s.cell, s.cName]}>{l.designation}</Text>
                {hasAlt ? <Text style={[s.cell, s.cAlt]}>{l.designationAlt ?? ''}</Text> : null}
                <Text style={[s.cell, s.cPack]}>{l.packaging ?? ''}</Text>
                {hasPrice ? (
                  <Text style={[s.cell, s.cPrice]}>
                    {l.unitPrice != null ? `${eur(l.unitPrice)}${l.priceUnit ? `/${l.priceUnit}` : ''}` : ''}
                  </Text>
                ) : null}
                <Text style={[s.cell, s.cQty, s.qtyStrong]}>{l.quantity != null ? qty(l.quantity) : ''}</Text>
              </View>
            </View>
          )
        })}

        {data.notes ? (
          <View style={s.notes}>
            <Text style={s.metaLabel}>Remarques</Text>
            <Text>{data.notes}</Text>
          </View>
        ) : null}

        {mode === 'order' ? (
          <View style={s.sign}>
            <Text>{data.lines.length} produit(s) commandé(s)</Text>
            <Text>Signature : ______________________</Text>
          </View>
        ) : null}

        <Text
          style={s.footer}
          fixed
          render={({ pageNumber, totalPages }) => `${data.title} — page ${pageNumber}/${totalPages} · Généré par ARGÉNEO`}
        />
      </Page>
    </Document>
  )
}
