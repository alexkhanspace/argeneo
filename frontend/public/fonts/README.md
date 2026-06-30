# Polices des étiquettes

Déposer ici les fichiers de police **TTF** utilisés par le générateur d'étiquettes
(PDF via @react-pdf). Ils sont servis en local (même origine), donc fiables et
hors-ligne — contrairement à un CDN.

## Police « craie » (option ardoise)

Fichier attendu :

    frontend/public/fonts/PermanentMarker-Regular.ttf

Comment l'obtenir :

1. Aller sur https://fonts.google.com/specimen/Permanent+Marker
2. « Get font » → « Download all » (zip).
3. Extraire `PermanentMarker-Regular.ttf` et le placer dans ce dossier.
4. Rebuild / redéploy. La case « Police craie » du générateur d'étiquettes
   utilisera alors cette police dans le PDF.

Tant que le fichier est absent, les étiquettes en mode « craie » sont générées
avec une police standard (repli automatique), sans erreur.

Tu peux utiliser une autre police manuscrite : garde le même nom de fichier,
ou change le `src` dans `frontend/src/pdf/LabelsPdf.tsx`.
