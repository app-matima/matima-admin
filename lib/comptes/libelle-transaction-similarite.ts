const LONGUEUR_PREFIXE_SIGNIFICATIF = 16;
/** Préfixe commerçant commun minimal (évite les faux positifs sur "recu", "2024", etc.). */
const LONGUEUR_PREFIXE_MINIMUM = 10;
/** Au-dessous de ce seuil après nettoyage, pas de similarité par préfixe. */
const LONGUEUR_RESTE_MINIMUM = 10;

/**
 * Rails bancaires + mots de liaison génériques (forme normalisée).
 * Du plus long au plus court pour éviter les matches partiels.
 */
const PREFIXES_BANCAIRES_GENERIQUES = [
  "paiement par carte",
  "paiement carte",
  "prelevement sepa",
  "virement sepa",
  "paiement cb",
  "achat cb",
  "prlv sepa",
  "vir sepa",
  "emis par",
  "recu de",
  "reference",
  "prelevement",
  "virement",
  "carte bancaire",
  "cotisation",
  "echeance",
  "recu",
  "emis",
  "prlv",
  "vir",
  "ref",
  "cb",
  "2024",
  "2025",
  "2026",
].sort((a, b) => b.length - a.length);

export function normaliserLibelleBrut(libelle: string): string {
  return libelle
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Retire une date isolée en tête (année ou jj/mm/aaaa, jj-mm-aaaa…).
 */
function retirerDateEnTete(libelle: string): string {
  return libelle
    .replace(/^20\d{2}(?=\s|$)/, "")
    .replace(/^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}(?=\s|$)/, "")
    .trim();
}

/**
 * Retire les préfixes bancaires / mots de liaison génériques en tête
 * pour ne garder que la partie commerçant / émetteur.
 */
export function retirerPrefixesBancairesGeneriques(
  libelleNormalise: string
): string {
  let reste = libelleNormalise.trim();
  let aChange = true;

  // Plusieurs passes si rails + liaisons s'enchaînent
  // (ex. "vir sepa recu de 2024 caf ...")
  while (aChange && reste.length > 0) {
    aChange = false;

    const sansDate = retirerDateEnTete(reste);
    if (sansDate !== reste) {
      reste = sansDate;
      aChange = true;
      continue;
    }

    for (const prefixe of PREFIXES_BANCAIRES_GENERIQUES) {
      if (reste === prefixe) {
        return "";
      }

      if (reste.startsWith(`${prefixe} `)) {
        reste = reste.slice(prefixe.length).trim();
        aChange = true;
        break;
      }
    }
  }

  return reste;
}

function extrairePrefixeSignificatif(libelleDejaNettoye: string): string {
  const sansSuffixeNumerique = libelleDejaNettoye
    .replace(/[\d\s./-]+$/, "")
    .trim();

  return (sansSuffixeNumerique || libelleDejaNettoye).slice(
    0,
    LONGUEUR_PREFIXE_SIGNIFICATIF
  );
}

function longueurPrefixeCommun(a: string, b: string): number {
  const max = Math.min(a.length, b.length);
  let index = 0;

  while (index < max && a[index] === b[index]) {
    index += 1;
  }

  return index;
}

/**
 * Similarité de libellés pour mémorisation et validation groupée :
 * comparaison sur la partie commerçant, hors préfixes bancaires génériques.
 */
export function libellesBrutsSontSimilaires(
  libelleA: string,
  libelleB: string
): boolean {
  const normaliseA = normaliserLibelleBrut(libelleA);
  const normaliseB = normaliserLibelleBrut(libelleB);

  if (!normaliseA || !normaliseB) {
    return false;
  }

  if (normaliseA === normaliseB) {
    return true;
  }

  const resteA = retirerPrefixesBancairesGeneriques(normaliseA);
  const resteB = retirerPrefixesBancairesGeneriques(normaliseB);

  if (!resteA || !resteB) {
    return false;
  }

  // Identité du commerçant même si le nom est court (ex. CAF, EDF)
  if (resteA === resteB) {
    return true;
  }

  // Texte trop court : pas de similarité par préfixe (évite les faux positifs)
  if (
    resteA.length < LONGUEUR_RESTE_MINIMUM ||
    resteB.length < LONGUEUR_RESTE_MINIMUM
  ) {
    return false;
  }

  const prefixeA = extrairePrefixeSignificatif(resteA);
  const prefixeB = extrairePrefixeSignificatif(resteB);

  return (
    longueurPrefixeCommun(prefixeA, prefixeB) >= LONGUEUR_PREFIXE_MINIMUM
  );
}
