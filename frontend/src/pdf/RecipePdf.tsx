import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'
import type { Pnet } from '../api/types'

export interface RecipePdfData {
  name: string
  code: string
  gtin?: string | null
  salePriceTtc?: number | null
  pnet: Pnet | null
  /** Fournisseur par id de matière (pour la colonne « Fournisseur » de la fiche coût). */
  supplierById?: Record<number, string | null>
  steps: string[]
  method: string
  yieldQuantity: string
  yieldUnit: string
  lossPercent: string
  durationMinutes: string
  photoUrl: string | null
  logoUrl: string | null
  color: string
}

const eur = (v: number | null | undefined): string =>
  v == null ? '—' : v.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 4 })

function makeStyles(color: string) {
  return StyleSheet.create({
    page: { padding: 34, fontSize: 10, fontFamily: 'Helvetica', color: '#222' },
    topbar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      borderBottomWidth: 3,
      borderBottomColor: color,
      paddingBottom: 8,
      marginBottom: 14,
    },
    kicker: { fontSize: 9, color, letterSpacing: 2, fontFamily: 'Helvetica-Bold' },
    h1: { fontSize: 20, color, fontFamily: 'Helvetica-Bold', marginTop: 2 },
    logo: { height: 42, maxWidth: 150, objectFit: 'contain' },
    head: { flexDirection: 'row', marginBottom: 14 },
    photo: { width: 150, height: 150, objectFit: 'cover', borderRadius: 6, marginRight: 16 },
    photoBig: { width: 190, height: 190, objectFit: 'cover', borderRadius: 8, marginRight: 18 },
    meta: { fontSize: 10, color: '#444', lineHeight: 1.6 },
    metaStrong: { fontFamily: 'Helvetica-Bold', color: '#222' },
    h2: {
      fontSize: 12,
      color,
      fontFamily: 'Helvetica-Bold',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      borderBottomWidth: 1,
      borderBottomColor: '#e3e3e3',
      paddingBottom: 3,
      marginTop: 16,
      marginBottom: 8,
    },
    prices: { flexDirection: 'row', marginBottom: 6 },
    pbox: {
      flex: 1,
      borderWidth: 1,
      borderColor: '#e3e3e3',
      borderRadius: 6,
      paddingVertical: 8,
      paddingHorizontal: 6,
      marginRight: 8,
      alignItems: 'center',
    },
    pl: { fontSize: 8, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 },
    pv: { fontSize: 15, color, fontFamily: 'Helvetica-Bold', marginTop: 3 },
    tHead: { flexDirection: 'row', backgroundColor: color, paddingVertical: 5, paddingHorizontal: 6 },
    tHeadCell: { color: '#fff', fontFamily: 'Helvetica-Bold', fontSize: 9 },
    tRow: { flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: '#eee' },
    tRowAlt: { backgroundColor: '#f7f7f7' },
    cName: { flex: 1 },
    cSupplier: { width: 100 },
    cQty: { width: 78, textAlign: 'right' },
    cCost: { width: 78, textAlign: 'right' },
    tFoot: { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 6, borderTopWidth: 2, borderTopColor: color },
    muted: { color: '#888', fontStyle: 'italic' },
    step: { flexDirection: 'row', marginBottom: 6 },
    stepNum: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: color,
      color: '#fff',
      fontSize: 10,
      fontFamily: 'Helvetica-Bold',
      textAlign: 'center',
      paddingTop: 4,
      marginRight: 8,
    },
    stepText: { flex: 1, fontSize: 11, lineHeight: 1.5, paddingTop: 3 },
    method: { fontSize: 11, lineHeight: 1.5, color: '#333' },
    footer: { position: 'absolute', bottom: 20, left: 34, right: 34, fontSize: 8, color: '#aaa', textAlign: 'center' },
  })
}

function Header({ s, kicker, name, logoUrl }: { s: ReturnType<typeof makeStyles>; kicker: string; name: string; logoUrl: string | null }) {
  return (
    <View style={s.topbar}>
      <View>
        <Text style={s.kicker}>{kicker}</Text>
        <Text style={s.h1}>{name}</Text>
      </View>
      {logoUrl ? <Image style={s.logo} src={logoUrl} /> : null}
    </View>
  )
}

function MetaBlock({ s, d }: { s: ReturnType<typeof makeStyles>; d: RecipePdfData }) {
  return (
    <View style={s.meta}>
      <Text>
        Code : <Text style={s.metaStrong}>{d.code}</Text>
      </Text>
      {d.gtin ? <Text>GTIN : {d.gtin}</Text> : null}
      <Text>
        Rendement : {d.yieldQuantity} {d.yieldUnit}
        {d.lossPercent && Number(d.lossPercent) > 0 ? ` — perte ${d.lossPercent} %` : ''}
      </Text>
      {d.durationMinutes ? <Text>Durée : {d.durationMinutes} min</Text> : null}
    </View>
  )
}

/** Fiche COÛT — pour le gérant : photo, prix, marge, détail des composants. */
function CostPage({ d, s }: { d: RecipePdfData; s: ReturnType<typeof makeStyles> }) {
  const pvTtc = d.salePriceTtc ?? d.pnet?.salePriceTtc ?? null
  return (
    <Page size="A4" style={s.page}>
      <Header s={s} kicker="FICHE COÛT" name={d.name} logoUrl={d.logoUrl} />
      <View style={s.head}>
        {d.photoUrl ? <Image style={s.photo} src={d.photoUrl} /> : null}
        <MetaBlock s={s} d={d} />
      </View>

      <View style={s.prices}>
        <View style={s.pbox}>
          <Text style={s.pl}>PV TTC</Text>
          <Text style={s.pv}>{eur(pvTtc)}</Text>
        </View>
        <View style={s.pbox}>
          <Text style={s.pl}>PNET HT</Text>
          <Text style={s.pv}>{d.pnet ? eur(d.pnet.unitCost) : '—'}</Text>
        </View>
        <View style={s.pbox}>
          <Text style={s.pl}>Marge HT</Text>
          <Text style={s.pv}>{eur(d.pnet?.marginHt)}</Text>
        </View>
        <View style={s.pbox}>
          <Text style={s.pl}>Marge %</Text>
          <Text style={s.pv}>{d.pnet?.markupRate != null ? `${(d.pnet.markupRate * 100).toFixed(0)} %` : '—'}</Text>
        </View>
        <View style={[s.pbox, { marginRight: 0 }]}>
          <Text style={s.pl}>Coef</Text>
          <Text style={s.pv}>{d.pnet?.coefficient != null ? `x${d.pnet.coefficient.toFixed(2)}` : '—'}</Text>
        </View>
      </View>

      <Text style={s.h2}>Composants & coût de revient</Text>
      {d.pnet ? (
        <View>
          <View style={s.tHead}>
            <Text style={[s.tHeadCell, s.cName]}>Composant</Text>
            <Text style={[s.tHeadCell, s.cSupplier]}>Fournisseur</Text>
            <Text style={[s.tHeadCell, s.cQty]}>Quantité</Text>
            <Text style={[s.tHeadCell, s.cCost]}>Coût</Text>
          </View>
          {d.pnet.lines.map((l, i) => (
            <View key={i} style={i % 2 === 1 ? [s.tRow, s.tRowAlt] : s.tRow}>
              <Text style={s.cName}>{l.label}</Text>
              <Text style={s.cSupplier}>
                {l.type === 'RAW' ? d.supplierById?.[l.refId] || '—' : '—'}
              </Text>
              <Text style={s.cQty}>
                {l.quantity} {l.unit}
              </Text>
              <Text style={s.cCost}>{eur(l.lineCost)}</Text>
            </View>
          ))}
          <View style={s.tFoot}>
            <Text style={[s.cName, { fontFamily: 'Helvetica-Bold' }]}>PNET / {d.pnet.unit}</Text>
            <Text style={s.cSupplier}></Text>
            <Text style={s.cQty}></Text>
            <Text style={[s.cCost, { fontFamily: 'Helvetica-Bold' }]}>{eur(d.pnet.unitCost)}</Text>
          </View>
        </View>
      ) : (
        <Text style={s.muted}>PNET non calculé (enregistrez la recette).</Text>
      )}

      <Text style={s.footer}>Fiche coût — usage interne (gérant){'\n'}Généré par ARGÉNEO</Text>
    </Page>
  )
}

/** Fiche PRÉPARATION — pour l'équipe : photo, étapes, méthode. */
function PrepPage({ d, s }: { d: RecipePdfData; s: ReturnType<typeof makeStyles> }) {
  const trimmed = d.steps.map((x) => x.trim()).filter((x) => x.length > 0)
  return (
    <Page size="A4" style={s.page}>
      <Header s={s} kicker="FICHE PRÉPARATION" name={d.name} logoUrl={d.logoUrl} />
      <View style={s.head}>
        {d.photoUrl ? <Image style={s.photoBig} src={d.photoUrl} /> : null}
        <MetaBlock s={s} d={d} />
      </View>

      <Text style={s.h2}>Étapes de préparation</Text>
      {trimmed.length ? (
        trimmed.map((step, i) => (
          <View key={i} style={s.step}>
            <Text style={s.stepNum}>{i + 1}</Text>
            <Text style={s.stepText}>{step}</Text>
          </View>
        ))
      ) : (
        <Text style={s.muted}>Aucune étape renseignée.</Text>
      )}

      {d.method.trim() ? (
        <View>
          <Text style={s.h2}>Méthode / notes</Text>
          <Text style={s.method}>{d.method}</Text>
        </View>
      ) : null}

      <Text style={s.footer}>Fiche préparation — atelier{'\n'}Généré par ARGÉNEO</Text>
    </Page>
  )
}

/** Document recette : « cost », « prep » ou les deux (P1 Coût, P2 Préparation). */
export function RecipePdf({ data, mode }: { data: RecipePdfData; mode: 'cost' | 'prep' | 'both' }) {
  const s = makeStyles(/^#[0-9a-fA-F]{3,8}$/.test(data.color) ? data.color : '#b5651d')
  return (
    <Document title={`Recette — ${data.name}`}>
      {(mode === 'cost' || mode === 'both') && <CostPage d={data} s={s} />}
      {(mode === 'prep' || mode === 'both') && <PrepPage d={data} s={s} />}
    </Document>
  )
}
