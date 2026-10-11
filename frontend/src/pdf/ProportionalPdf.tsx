import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { formatQty, type PropTable } from '../utils/proportional'

/** Fiche proportionnelle (A4 paysage) : poids de fabrication en lignes, ingrédients en colonnes. */
export function ProportionalPdf({
  name,
  code,
  table,
  color,
}: {
  name: string
  code?: string
  table: PropTable
  color: string
}) {
  const c = /^#[0-9a-fA-F]{3,8}$/.test(color) ? color : '#b5651d'
  const s = StyleSheet.create({
    page: { padding: 28, fontSize: 9, fontFamily: 'Helvetica', color: '#222' },
    kicker: { fontSize: 9, color: c, letterSpacing: 2, fontFamily: 'Helvetica-Bold' },
    h1: { fontSize: 18, color: c, fontFamily: 'Helvetica-Bold', marginTop: 2 },
    top: { borderBottomWidth: 3, borderBottomColor: c, paddingBottom: 6, marginBottom: 10 },
    note: { fontSize: 8, color: '#666', marginBottom: 8 },
    head: { flexDirection: 'row', backgroundColor: c },
    row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#eee' },
    alt: { backgroundColor: '#f7f7f7' },
    first: { width: 70, paddingVertical: 4, paddingHorizontal: 4, fontFamily: 'Helvetica-Bold' },
    cell: { flex: 1, paddingVertical: 4, paddingHorizontal: 4, textAlign: 'right' },
    hText: { color: '#fff', fontFamily: 'Helvetica-Bold' },
    hSub: { color: '#fff', fontSize: 7 },
    footer: { position: 'absolute', bottom: 16, left: 28, right: 28, fontSize: 7, color: '#aaa', textAlign: 'center' },
  })
  return (
    <Document title={`Fiche proportionnelle — ${name}`}>
      <Page size="A4" orientation="landscape" style={s.page}>
        <View style={s.top}>
          <Text style={s.kicker}>FICHE PROPORTIONNELLE{code ? ` — ${code}` : ''}</Text>
          <Text style={s.h1}>{name}</Text>
        </View>
        <Text style={s.note}>
          Recette de base : {formatQty(table.baseKg, 3)} kg. Quantités au prorata du poids de fabrication.
        </Text>
        <View style={s.head} fixed>
          <Text style={[s.first, s.hText]}>Fabrication</Text>
          {table.columns.map((col, i) => (
            <View key={i} style={s.cell}>
              <Text style={s.hText}>{col.label}</Text>
              <Text style={s.hSub}>
                {col.unit}
                {col.percent != null ? ` · ${formatQty(col.percent, 1)} %` : ''}
              </Text>
            </View>
          ))}
        </View>
        {table.weights.map((w, r) => (
          <View key={r} style={r % 2 === 1 ? [s.row, s.alt] : s.row} wrap={false}>
            <Text style={s.first}>{formatQty(w, 3)} kg</Text>
            {table.values[r].map((v, i) => (
              <Text key={i} style={s.cell}>
                {formatQty(v, table.columns[i].decimals)}
              </Text>
            ))}
          </View>
        ))}
        <Text style={s.footer} fixed>
          Fiche proportionnelle — atelier · Généré par ARGÉNEO
        </Text>
      </Page>
    </Document>
  )
}
