import { CLAUDE_MODEL_HAIKU } from "@/lib/claude/models";
import { formaterDossiersOrganisationPourPrompt } from "@/lib/documents/ged-dossiers-server";
import { nomsDossiersQuasiIdentiques } from "@/lib/documents/ged-dossier-utils";
import type { PropositionDocumentIA } from "@/types/documents";

interface DossierPourProposition {
  id: string;
  nom: string;
  majeur_id: string;
  parent_id: string | null;
}

interface MajeurPourProposition {
  id: string;
  nom: string;
  prenom: string;
}

interface ProposerDocumentParams {
  nomOriginal: string;
  typeDocument: string;
  dossiers: DossierPourProposition[];
  majeurs: MajeurPourProposition[];
  pdfBase64?: string | null;
  imageBase64?: string | null;
  imageMediaType?: string;
}

type MessageContent =
  | { type: "text"; text: string }
  | {
      type: "document";
      source: {
        type: "base64";
        media_type: "application/pdf";
        data: string;
      };
    }
  | {
      type: "image";
      source: {
        type: "base64";
        media_type: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
        data: string;
      };
    };

interface ReponseClassificationJson {
  emetteur?: string | null;
  type_document?: string | null;
  famille?: string | null;
  majeur_id?: string | null;
  dossier_id?: string | null;
  nouveau_chemin_dossier?: unknown;
  nouveau_dossier_nom?: string | null;
  nom_fichier?: string | null;
  confiance?: string | null;
}

function normaliserTexte(valeur: string): string {
  return valeur
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function resoudreMajeurId(
  valeur: string,
  majeurs: MajeurPourProposition[],
): string | null {
  const normalise = normaliserTexte(valeur);

  const parId = majeurs.find((majeur) => majeur.id === valeur);
  if (parId) {
    return parId.id;
  }

  return (
    majeurs.find((majeur) => {
      const nomComplet = `${majeur.nom} ${majeur.prenom}`;
      const prenomNom = `${majeur.prenom} ${majeur.nom}`;
      return (
        normaliserTexte(nomComplet) === normalise ||
        normaliserTexte(prenomNom) === normalise
      );
    })?.id ?? null
  );
}

export function resoudreDossierId(
  valeur: string,
  majeurId: string | null,
  dossiers: DossierPourProposition[],
): string | null {
  if (!majeurId || !valeur || valeur === "null") {
    return null;
  }

  const dossiersDuMajeur = dossiers.filter(
    (dossier) => dossier.majeur_id === majeurId,
  );

  const parId = dossiersDuMajeur.find((dossier) => dossier.id === valeur);
  if (parId) {
    return parId.id;
  }

  const nomNormalise = normaliserTexte(valeur);
  const correspondancesExactes = dossiersDuMajeur.filter(
    (dossier) => normaliserTexte(dossier.nom) === nomNormalise,
  );

  if (correspondancesExactes.length === 1) {
    return correspondancesExactes[0]!.id;
  }

  const correspondancesProches = dossiersDuMajeur.filter((dossier) =>
    nomsDossiersQuasiIdentiques(dossier.nom, valeur),
  );

  return correspondancesProches.length === 1
    ? correspondancesProches[0]!.id
    : null;
}

function normaliserNouveauCheminDossier(json: {
  nouveau_chemin_dossier?: unknown;
  nouveau_dossier_nom?: string | null;
}): string[] | null {
  if (Array.isArray(json.nouveau_chemin_dossier)) {
    const segments = json.nouveau_chemin_dossier
      .filter((segment): segment is string => typeof segment === "string")
      .map((segment) => segment.trim())
      .filter(Boolean);

    return segments.length > 0 ? segments : null;
  }

  if (
    typeof json.nouveau_dossier_nom === "string" &&
    json.nouveau_dossier_nom !== "null"
  ) {
    const segment = json.nouveau_dossier_nom.trim();
    return segment ? [segment] : null;
  }

  return null;
}

function champDiagnostiqueOptionnel(
  valeur: string | null | undefined,
): string | null {
  if (typeof valeur !== "string") {
    return null;
  }
  const trimme = valeur.trim();
  if (!trimme || trimme === "null") {
    return null;
  }
  return trimme;
}

function loguerAnalyseClassification(
  json: ReponseClassificationJson,
  fichier: string,
): void {
  const emetteur = champDiagnostiqueOptionnel(json.emetteur);
  const typeDocument = champDiagnostiqueOptionnel(json.type_document);
  const famille = champDiagnostiqueOptionnel(json.famille);

  if (emetteur === null && typeDocument === null && famille === null) {
    return;
  }

  console.log(
    "[proposerDocumentNonClasse] analyse:",
    fichier,
    "emetteur=",
    emetteur,
    "type_document=",
    typeDocument,
    "famille=",
    famille,
    "confiance=",
    champDiagnostiqueOptionnel(json.confiance),
  );
}

function construirePrompt(params: ProposerDocumentParams): string {
  const majeursListe = params.majeurs
    .map((majeur) => `- ${majeur.nom} ${majeur.prenom} (id: ${majeur.id})`)
    .join("\n");

  const dossiersParMajeur = params.majeurs
    .map((majeur) => {
      const liste = formaterDossiersOrganisationPourPrompt(
        params.dossiers,
        majeur.id,
      );

      return `${majeur.nom} ${majeur.prenom} :\n${liste}`;
    })
    .join("\n\n");

  return `<proteges_actifs>
${majeursListe}
</proteges_actifs>

<arborescences_par_protege>
${dossiersParMajeur}
</arborescences_par_protege>

<fichier>
Nom du fichier source : ${params.nomOriginal}
Type MIME : ${params.typeDocument}
</fichier>

Tu es l'assistant de classement documentaire de Matima, un logiciel utilisé par des mandataires judiciaires à la protection des majeurs (MJPM) en France. Tu reçois un document scanné, le plus souvent un courrier papier reçu pour un protégé, et tu dois le rattacher au bon protégé puis au bon dossier de sa GED.

Une erreur de classement a des conséquences réelles : un document mal rangé devient introuvable au moment d'une échéance, d'un renouvellement de mesure ou d'un contrôle du juge. La précision prime toujours. Dans le doute, dis-le : confiance "basse", ou null.

Suis les étapes ci-dessous dans l'ordre.

# ÉTAPE 1 — Identifier le protégé

- majeur_id DOIT être l'UUID exact d'un protégé présent dans <proteges_actifs>. N'invente jamais d'id, n'utilise jamais un nom absent de la liste.
- IGNORE systématiquement tout nom associé à : « tuteur », « curateur », « curatelle », « tutelle », « mandataire judiciaire », « MJPM », « représentant légal », « pour le compte de », ainsi que l'en-tête, la signature ou le cachet d'un cabinet de mandataire. Ce nom est celui du MJPM, jamais celui du protégé.
- Cherche le nom du SUJET du document : « concernant », « à l'attention de », « bénéficiaire », « assuré », « patient », « allocataire », « titulaire du compte », objet du courrier (« M./Mme … »), ou la personne principale dont parle le contenu.
- Le mot « assuré » sert UNIQUEMENT à repérer la personne concernée. Il ne dit RIEN sur la famille du document : un relevé bancaire peut contenir le mot « assuré », il reste un document bancaire.
- Si, après avoir écarté le nom du MJPM, aucun nom ne correspond CLAIREMENT à un protégé de la liste, renvoie majeur_id: null. Ne choisis jamais le protégé « le plus proche » par défaut. Un null est toujours préférable à une mauvaise attribution.

# ÉTAPE 2 — Identifier l'ÉMETTEUR

L'émetteur est l'organisme qui a PRODUIT le document : logo, en-tête, raison sociale, adresse de retour, références propres (n° client, n° de contrat, n° allocataire, n° fiscal…). C'est le signal le plus fiable pour choisir la famille, plus fiable que les mots du contenu.

Ne confonds pas l'émetteur avec :
- le MJPM ou son cabinet (souvent présent comme destinataire ou comme transmetteur) ;
- le protégé ;
- un organisme simplement MENTIONNÉ dans le contenu. Exemple : une ligne « PRLV AXA » dans un relevé bancaire ne fait pas d'AXA l'émetteur, l'émetteur reste la banque.

Le nom du fichier source est un indice faible. Les noms générés par un scanner (« scan_batch1.pdf », « doc0001.pdf », « IMG_1234.jpg ») ne veulent rien dire : ignore-les.

Si le document contient plusieurs pages, la première page est généralement la plus informative sur l'émetteur et le type.

# ÉTAPE 3 — Identifier la FAMILLE du document

Choisis UNE famille parmi les suivantes. Chaque famille liste ses émetteurs typiques, ses signaux, et les confusions à éviter.

1. IDENTITÉ — carte nationale d'identité, passeport, titre de séjour, acte de naissance, de mariage ou de décès, livret de famille. Émetteurs : préfecture, mairie, ANTS, État.

2. BANQUE — relevé de compte, RIB, courrier de la banque, carte bancaire, découvert, chéquier, ouverture ou clôture de compte, réponse FICOBA. Émetteurs : une banque (Crédit Agricole, BNP Paribas, Société Générale, La Banque Postale, Caisse d'Épargne, LCL, Crédit Mutuel, CIC, Banque Populaire, Crédit du Nord, Boursorama…). Signaux : liste de mouvements datés, débits et crédits, solde, IBAN du compte.
   PIÈGE : un relevé bancaire qui LISTE des prélèvements d'assurance, de mutuelle, d'EDF, d'impôts ou de loyer reste un document BANQUE. Ce sont de simples lignes de mouvement, pas l'émetteur.

3. PLACEMENTS ET ÉPARGNE — livret A, LDDS, LEP, PEL, assurance-vie, contrat de capitalisation, compte-titres, relevé annuel d'épargne, réponse FICOVIE. Émetteurs : banque ou assureur.
   PIÈGE : l'assurance-vie est un PLACEMENT financier, pas une assurance au sens habitation ou responsabilité civile. Elle ne va jamais dans ASSURANCES.

4. ASSURANCES — habitation, responsabilité civile, auto, obsèques, prévoyance, dépendance : attestation, avis d'échéance, contrat, conditions particulières, déclaration ou suivi de sinistre, résiliation. Émetteurs : un assureur (AXA, MAIF, MACIF, MAAF, Allianz, Groupama, MMA, Generali, Matmut, GMF…). Signaux : n° de police ou de contrat, garanties, cotisation, échéance annuelle.
   PIÈGE : un document d'assurance ne contient jamais de liste de transactions ni de solde de compte. Si tu vois une liste de mouvements bancaires datés, ce n'est PAS un document d'assurance. La présence d'un IBAN de prélèvement sur un avis d'échéance ne fait pas de lui un document bancaire.

5. SANTÉ — ordonnance, compte-rendu médical, analyses, hospitalisation, certificat médical, carte Vitale, documents de la CPAM (attestation de droits, relevé de remboursements), mutuelle ou complémentaire santé, Complémentaire santé solidaire. Émetteurs : professionnel ou établissement de santé, CPAM / Assurance Maladie, mutuelle.
   PIÈGE : la CPAM (« l'Assurance Maladie ») est un organisme de sécurité sociale, pas un assureur. Famille SANTÉ, jamais ASSURANCES.
   PIÈGE : une mutuelle ou complémentaire santé va en SANTÉ, sauf si l'arborescence du protégé range déjà explicitement la mutuelle ailleurs : dans ce cas, respecte l'existant.
   Un document au contenu médical est confidentiel : il ne va jamais ailleurs qu'en SANTÉ.

6. LOGEMENT ET HÉBERGEMENT — bail, quittance ou avis d'échéance de loyer, charges locatives, syndic, état des lieux, bailleur social, EHPAD ou résidence (contrat de séjour, facture d'hébergement). Émetteurs : bailleur, agence immobilière, syndic, bailleur social, établissement d'hébergement.

7. FACTURES ET ABONNEMENTS — électricité, gaz, eau, téléphone, internet, télévision. Émetteurs : fournisseur (EDF, Engie, TotalEnergies, Veolia, Suez, régie des eaux, Orange, SFR, Free, Bouygues Telecom…).
   PIÈGE : loyer et charges locatives vont en LOGEMENT, pas ici. Une facture d'EHPAD va en LOGEMENT ET HÉBERGEMENT.

8. IMPÔTS — avis d'imposition ou de non-imposition, déclaration de revenus, taxe foncière, taxe d'habitation, échéancier de prélèvement fiscal, courrier du centre des finances publiques. Émetteurs : DGFiP, impots.gouv.fr, Trésor Public, SIP.

9. PRESTATIONS SOCIALES — CAF (AAH, APL, RSA, prime d'activité…), MDPH, APA et aide sociale à l'hébergement (Conseil départemental), CCAS, France Travail. Émetteurs : organisme social.
   PIÈGE : CPAM va en SANTÉ, les caisses de retraite vont en RETRAITE.

10. RETRAITE ET REVENUS — pension, attestation de paiement, relevé de carrière, retraite complémentaire, bulletin de salaire, ESAT. Émetteurs : CARSAT, CNAV, Assurance retraite, AGIRC-ARRCO, MSA, CNRACL, IRCANTEC, employeur, ESAT.

11. JUSTICE ET MESURE DE PROTECTION — jugement (ouverture, renouvellement, modification ou mainlevée de la mesure), ordonnance du juge des contentieux de la protection, convocation au tribunal, courrier du greffe, inventaire, compte de gestion, requête, courrier d'avocat, acte de commissaire de justice (huissier). Émetteurs : tribunal judiciaire, greffe, juge, avocat, commissaire de justice.

12. PATRIMOINE ET SUCCESSION — acte notarié, succession, donation, titre de propriété, vente ou acquisition immobilière. Émetteurs : notaire, office notarial.

13. DETTES ET RECOUVREMENT — relance d'impayé, mise en demeure, société de recouvrement, dossier de surendettement (Banque de France). Émetteurs : créancier, société de recouvrement, Banque de France (commission de surendettement).

14. COURRIER DIVERS — uniquement si AUCUNE famille ci-dessus ne correspond clairement.

Cas du courrier transmis : si le cabinet du MJPM ou un tiers ne fait que TRANSMETTRE un document (bordereau, lettre d'accompagnement), l'émetteur à retenir est celui du document transmis, pas celui du bordereau.

# ÉTAPE 4 — Choisir le dossier

Dans <arborescences_par_protege>, regarde UNIQUEMENT les dossiers du protégé choisi à l'étape 1. Un dossier_id appartenant à un autre protégé est toujours une erreur.

Ordre de décision :
1. Cherche le dossier existant qui correspond à la famille ET, si possible, à l'émetteur ou au sous-type précis. Préfère toujours le dossier le plus spécifique (« Banque > Crédit Agricole » plutôt que « Banque ») à n'importe quel niveau de l'arborescence.
2. Les noms varient d'un cabinet à l'autre : « Banque », « Banques », « Comptes bancaires » désignent la même famille ; « Assurance » et « Assurances » aussi ; « Santé » et « Médical » aussi ; « Impôts » et « Fiscalité » aussi. Un dossier existant au singulier ou au pluriel, ou à une formulation très proche (casse, accents, espaces), EST ce dossier : réutilise son dossier_id. Ne propose JAMAIS un nouveau chemin qui reformule légèrement un dossier existant.
3. Si aucun dossier existant ne correspond à la famille, propose nouveau_chemin_dossier avec les noms standards ci-dessous.
4. Ne force jamais un document dans un dossier d'une AUTRE famille sous prétexte qu'il existe. Créer un nouveau dossier est toujours préférable à un mauvais classement.

Noms standards pour une création (remplace les crochets par la valeur réelle) :
- Identité > [Carte d'identité | Passeport | Titre de séjour | État civil]
- Banque > [Nom de la banque] > Relevés de compte   (uniquement pour les relevés de compte)
- Banque > [Nom de la banque]   (RIB, courriers de la banque, carte, chéquier)
- Placements > [Nom de l'établissement]
- Assurances > [Habitation | Responsabilité civile | Auto | Obsèques | Prévoyance]
- Santé > [Ordonnances | Comptes-rendus médicaux | Analyses | Hospitalisation | Assurance maladie | Mutuelle]
- Logement > [Bail | Loyers | Charges]
- Hébergement > [Nom de l'établissement]
- Factures > [Nom du fournisseur]
- Impôts > [Impôt sur le revenu | Taxe foncière | Taxe d'habitation]
- Prestations sociales > [CAF | MDPH | APA | Aide sociale | France Travail]
- Retraite > [Nom de la caisse]
- Revenus > [Bulletins de salaire | ESAT]
- Justice > [Jugements | Tribunal | Avocat | Commissaire de justice]
- Patrimoine > [Notaire | Succession | Immobilier]
- Dettes et recouvrement > [Nom du créancier]
- Courrier divers

RÈGLE CRITIQUE SUR LE MOT « RELEVÉ » : dans Matima, tout dossier dont le nom contient « Relevé » déclenche automatiquement une extraction de transactions bancaires. Donc :
- Un relevé de compte bancaire va dans un dossier dont le nom contient « Relevés » (réutilise celui qui existe, sinon crée « Banque > [Nom de la banque] > Relevés de compte »).
- N'utilise JAMAIS le mot « Relevé » dans un nouveau nom de dossier pour autre chose qu'un relevé de compte bancaire. Relevé de carrière → « Retraite > [Caisse] ». Relevé de remboursements CPAM → « Santé > Assurance maladie ». Relevé d'épargne ou d'assurance-vie → « Placements > [Établissement] ».
- Ne range jamais un document non bancaire dans un dossier existant dont le nom contient « Relevé ».

# ÉTAPE 5 — Nom de fichier

Format : « AAAA-MM Émetteur - Type de document.extension »
- La date est celle du DOCUMENT (date d'émission ou période couverte), pas la date du jour. Si aucune date n'est identifiable, omets-la.
- Garde l'extension du fichier source.
- N'invente aucune information absente du document.
Exemples : « 2026-08 Crédit Agricole - Relevé de compte.pdf », « 2026-01 AXA - Avis d'échéance habitation.pdf », « 2025-11 Tribunal judiciaire de Créteil - Jugement de renouvellement.pdf ».

# ÉTAPE 6 — Confiance

confiance = "haute" UNIQUEMENT si les trois conditions sont réunies : le protégé est identifié sans ambiguïté, l'émetteur est clairement identifié, et le dossier (existant ou créé) découle évidemment de la famille.

confiance = "basse" dès que : le scan est peu lisible ou manuscrit, plusieurs protégés sont possibles, l'émetteur est incertain, la famille hésite entre deux choix, ou le document semble contenir plusieurs documents distincts (dans ce cas, classe selon la première page).

# EXEMPLES DE CAS PIÈGES

A. Relevé mensuel du Crédit Agricole listant « PRLV AXA HABITATION », « PRLV EDF » et « VIR CAF ». Émetteur : Crédit Agricole. Famille : BANQUE. Les lignes AXA, EDF et CAF sont de simples mouvements. Dossier : le dossier « Relevés » existant sous la banque, sinon « Banque > Crédit Agricole > Relevés de compte ».

B. Avis d'échéance AXA pour l'assurance habitation, avec n° de contrat, cotisation annuelle et IBAN de prélèvement. Émetteur : AXA. Famille : ASSURANCES. Dossier : « Assurances > Habitation ». L'IBAN n'en fait pas un document bancaire.

C. Relevé de remboursements de la CPAM. Émetteur : CPAM. Famille : SANTÉ. Dossier : « Santé > Assurance maladie ». Jamais ASSURANCES, jamais un dossier contenant « Relevé ».

D. Relevé de carrière de la CARSAT. Émetteur : CARSAT. Famille : RETRAITE ET REVENUS. Dossier : « Retraite > CARSAT ». Jamais un dossier contenant « Relevé ».

E. Relevé annuel d'un contrat d'assurance-vie Predica. Famille : PLACEMENTS ET ÉPARGNE. Dossier : « Placements > Predica ». Jamais ASSURANCES.

F. Lettre sur papier à en-tête d'un cabinet de mandataire, transmettant une facture EDF concernant M. DUPONT. Émetteur retenu : EDF. Famille : FACTURES ET ABONNEMENTS. Protégé : M. DUPONT (le nom du mandataire est ignoré).

G. Jugement de renouvellement d'une curatelle renforcée, mentionnant en tête le nom du curateur. Famille : JUSTICE ET MESURE DE PROTECTION. Dossier : « Justice > Jugements ». Le nom du curateur est ignoré pour l'identification du protégé.

# FORMAT DE RÉPONSE

Réponds UNIQUEMENT avec un objet JSON valide, sans markdown, sans texte avant ou après. Remplis les champs DANS CET ORDRE : l'analyse (émetteur, type, famille) d'abord, la décision ensuite.

{"emetteur":"nom de l'organisme émetteur, ou null","type_document":"type précis, ex. relevé de compte mensuel","famille":"une des 14 familles, ex. BANQUE","majeur_id":"uuid ou null","dossier_id":"uuid ou null","nouveau_chemin_dossier":["Segment 1","Segment 2"] ou null,"nom_fichier":"nom suggéré avec extension","confiance":"haute ou basse"}

Règles de cohérence :
- Jamais dossier_id ET nouveau_chemin_dossier en même temps.
- nouveau_chemin_dossier : tableau de 1 à 4 chaînes, jamais une chaîne seule.
- Si majeur_id est null, dossier_id et nouveau_chemin_dossier sont null aussi.
- dossier_id appartient obligatoirement à l'arborescence du protégé choisi.`;
}

function construireMessageContent(
  params: ProposerDocumentParams,
): MessageContent[] {
  const contenu: MessageContent[] = [];

  if (params.pdfBase64) {
    contenu.push({
      type: "document",
      source: {
        type: "base64",
        media_type: "application/pdf",
        data: params.pdfBase64,
      },
    });
  } else if (params.imageBase64 && params.imageMediaType) {
    const mediaType = params.imageMediaType as
      | "image/jpeg"
      | "image/png"
      | "image/gif"
      | "image/webp";

    contenu.push({
      type: "image",
      source: {
        type: "base64",
        media_type: mediaType,
        data: params.imageBase64,
      },
    });
  }

  contenu.push({ type: "text", text: construirePrompt(params) });
  return contenu;
}

function parserReponseJson(texte: string): ReponseClassificationJson | null {
  try {
    return JSON.parse(texte) as ReponseClassificationJson;
  } catch {
    const debut = texte.indexOf("{");
    const fin = texte.lastIndexOf("}");
    if (debut === -1 || fin === -1) {
      return null;
    }

    try {
      return JSON.parse(
        texte.slice(debut, fin + 1),
      ) as ReponseClassificationJson;
    } catch {
      return null;
    }
  }
}

function interpreterProposition(
  json: ReponseClassificationJson,
  params: ProposerDocumentParams,
): PropositionDocumentIA {
  loguerAnalyseClassification(json, params.nomOriginal);

  const majeurId =
    json.majeur_id && json.majeur_id !== "null"
      ? resoudreMajeurId(json.majeur_id, params.majeurs)
      : null;

  const gedDossierId =
    json.dossier_id && json.dossier_id !== "null"
      ? resoudreDossierId(json.dossier_id, majeurId, params.dossiers)
      : null;

  const nouveauCheminDossier = !gedDossierId
    ? normaliserNouveauCheminDossier(json)
    : null;

  const nomFichier =
    json.nom_fichier && json.nom_fichier !== "null"
      ? json.nom_fichier.trim()
      : null;

  return { gedDossierId, majeurId, nomFichier, nouveauCheminDossier };
}

export async function proposerDocumentNonClasse(
  params: ProposerDocumentParams,
): Promise<PropositionDocumentIA> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.error("[proposerDocumentNonClasse] ANTHROPIC_API_KEY manquante");
    return {
      gedDossierId: null,
      majeurId: null,
      nomFichier: null,
      nouveauCheminDossier: null,
    };
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL_HAIKU,
        max_tokens: 800,
        temperature: 0,
        messages: [
          { role: "user", content: construireMessageContent(params) },
        ],
      }),
    });

    if (!response.ok) {
      console.error(
        "[proposerDocumentNonClasse] Erreur API:",
        await response.text(),
      );
      return {
        gedDossierId: null,
        majeurId: null,
        nomFichier: null,
        nouveauCheminDossier: null,
      };
    }

    const result = (await response.json()) as {
      content: { type: string; text: string }[];
    };

    const texte =
      result.content.find((bloc) => bloc.type === "text")?.text?.trim() ?? "";
    const json = parserReponseJson(texte);

    if (!json) {
      return {
        gedDossierId: null,
        majeurId: null,
        nomFichier: null,
        nouveauCheminDossier: null,
      };
    }

    return interpreterProposition(json, params);
  } catch (error) {
    console.error("[proposerDocumentNonClasse] Erreur:", error);
    return {
      gedDossierId: null,
      majeurId: null,
      nomFichier: null,
      nouveauCheminDossier: null,
    };
  }
}
