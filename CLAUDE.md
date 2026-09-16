# Memoria

Application web d'apprentissage par cœur : l'utilisateur donne un cours, l'app détecte les
notions importantes, génère des exercices variés, détecte précisément ce qui est oublié, et
programme les prochaines révisions par répétition espacée. Voir [README.md](README.md) pour
l'installation, la configuration Firebase et le détail du moteur d'apprentissage.

Site statique en **un seul fichier** (`index.html`) — HTML/CSS/JS pur, aucune dépendance, aucun
build. Choix imposé par l'environnement : cette machine n'a **pas Node.js/npm** installé (ni
Homebrew). Même famille de contrainte que le projet voisin `vieenfamille` (même utilisateur),
dont ce projet reprend le pattern « site à un seul fichier + Firebase », en l'adaptant : ici les
données sont **isolées par utilisateur** (pas de notion de famille/maison partagée).

## Stack

- HTML/CSS/JS pur. Firebase (Authentication + Firestore) chargé par CDN en modules ES,
  **v12.17.1** (`https://www.gstatic.com/firebasejs/12.17.1/...`).
- **Pas de Firebase Storage** : l'avatar est redimensionné côté client (canvas) et stocké comme
  petite image dans le doc profil Firestore, pour éviter la contrainte du plan payant Blaze.
- **Mode démo local** : tant que `FIREBASE_CONFIG.apiKey === "DEMO"` (valeur par défaut tant que
  personne n'a collé une vraie config), l'app tourne entièrement dans `localStorage` — comptes,
  mots de passe hachés (SHA-256 natif du navigateur), toutes les données. C'est le mode dans
  lequel le projet a été construit et testé (aucun projet Firebase n'existe encore). Voir `Store`
  (section C) et `DemoAuth`/`Auth` (section E) : le même code applicatif sert les deux backends.
- Import de fichiers cours : `.txt` natif, `.pdf` via pdf.js (import dynamique ES module,
  `pdf.js/6.3.289`), `.docx` via mammoth.js (`mammoth/1.12.3`, UMD, chargé à la demande).
- Aucune API d'IA : voir § Moteur d'apprentissage ci-dessous et le README (§ API IA) — c'est un
  choix architectural, pas un manque temporaire.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | Tout le site (structure + styles + logique), sections numérotées A-H (JS) et 1-9 (CSS) |
| `firestore.rules` | Règles de sécurité Firestore — isolation stricte par `uid`, à publier dans la console Firebase une fois un vrai projet créé |
| `manifest.json` + `icon.svg` | Installation sur écran d'accueil |
| `sw.js` | Service worker : coquille disponible hors connexion |
| `design-system/memoria/MASTER.md` | Direction de design issue du skill `ui-ux-pro-max` (Flat Design, teal `#0D9488` + accent orange `#EA580C`, Plus Jakarta Sans) — les tokens CSS réels (section 1) s'en inspirent mais ont été ajustés (fonds moins saturés) pour rester sobres |
| `.claude/launch.json` | Serveur de prévisualisation locale (développement uniquement) |

## Organisation de `index.html`

- **CSS** : 1. jetons · 2. base · 3. utilitaires · 4. composants · 5. modale/toast/états ·
  6. coquille applicative · 7. écrans hors application · 8. pages · 9. préférences système
- **JS** : A. Firebase/constantes/utilitaires · B. thème/toasts/modales/formulaires génériques ·
  C. état global & Store (démo vs Firestore) · **D. moteur d'apprentissage** (le cœur du produit :
  `Analyseur`, `Moteur`, `Revision`) · E. authentification/onboarding · F. routeur & coquille ·
  G1-G12. pages · H. délégation d'événements globale + démarrage

Pas de registre `ACTIONS`/`GESTIONNAIRES` façon `vieenfamille` : un seul écouteur global
(section H) gère les actions génériques (`data-action="aller|basculer-theme|notifications|
menu-profil|deconnexion|commencer-session"`), mais chaque page attache ses propres écouteurs pour
ses interactions spécifiques (formulaires, exercices). Ce projet est assez petit pour que ce soit
plus simple à suivre qu'un registre centralisé unique — pas de contrainte de bulles d'événements
comme celle qui avait forcé ce choix dans `vieenfamille`.

`ouvrirFormulaire({ titre, champs, valeurs, onValider, onSupprimer })` (section B) est le même
type de constructeur de formulaire générique que dans `vieenfamille`, avec les types de champ :
`texte`, `zone`, `select`, `nombre`, `date`, `coche`, `couleur`.

## Modèle de données Firestore

Isolé par utilisateur, sous-collections de `users/{uid}` : `matieres`, `cours`, `chapitres`,
`notions`, `historique`, `sessions`, `examens`, `controles`, `notifications`. Détail complet des
champs dans le README. Point notable : **les exercices ne sont jamais persistés**, régénérés à
la volée par `Moteur.genererExercice` à partir des champs de la notion — seules la notion (avec
sa progression repliée dans un champ `progression`), l'historique et les sessions le sont.

## Moteur d'apprentissage — décisions clés

- **Chapitres** détectés automatiquement à l'analyse via les titres markdown (`# `, `## `) du
  contenu collé ; sans titre, un unique chapitre « Cours entier » est créé
  (`decouperChapitres`, section G3).
- **Validation des notions** : après analyse, les candidats sont persistés immédiatement avec
  `statutValidation: "en_attente"` (pas de round-trip serveur à revalider) ; accepter les passe à
  `"gardee"` et leur attribue `progression: Revision.progressionInitiale()`. Rien n'est stocké
  pour un candidat rejeté.
- **Répétition espacée** : `Revision.calculerRevisionSuivante` (section D), inspiré de SM-2,
  adapté à un vecteur qualité 0-5 dérivé de (correct/partiel/faux, confiance déclarée, indices
  utilisés). Distingue explicitement *maîtrise actuelle* et *maîtrise durable* (§23/24 du cahier
  des charges) : la maîtrise durable n'augmente que si la révision réussie arrive ≥3 jours après
  la précédente.
- **`extraireElements`/`motsSignificatifsOriginaux`** (sections A/D) doivent conserver
  **accents et casse d'origine** des éléments essentiels d'une notion — ils sont affichés
  directement à l'utilisateur (« Essaie de retenir : reprÉsente, dispose... ») et servent aussi de
  cible de recherche littérale dans le texte pour le texte à trous. Une normalisation complète
  (comme pour la comparaison de réponses) les rendrait à la fois moche à l'affichage et
  introuvables dans le texte source accentué.
- **Élisions** (« d'une », « qu'ils »...) : un mot-token conservant l'apostrophe doit être jugé
  sur ce qu'il y a *après* l'élision pour le filtre de mots vides, sinon des fragments comme
  « d'une » passent entre les mailles et polluent les éléments essentiels d'une notion (et, plus
  grave, produisent de faux positifs dans `evaluerReponseLibre` : un très court mot comme « d »
  matche par inclusion de sous-chaîne presque n'importe quoi).
- **Texte à trous** : l'étiquette `{{n}}` posée dans le texte doit être l'index réel dans le
  tableau `reponses` (celui qu'on vient de `push`), **pas** la position dans le tableau `cibles`
  de départ — si un mot-cible ne matche pas dans le texte (accent, forme différente), les deux
  indices divergent et un trou affiche littéralement son numéro au lieu d'un champ de saisie.
- **Mode "apprentissage" (apprendre en profondeur)** : à chaque point d'entrée qui lançait
  directement `PageSession.demarrer("apprendre", …)` (Cartes rapides, page d'un cours, "Découvrir
  de nouvelles notions"), on demande maintenant via `PageSession.demarrerApprendre(opts)` si
  l'utilisateur veut réviser rapidement (mode `"apprendre"`, **strictement inchangé**) ou apprendre
  en profondeur (nouveau mode `"apprentissage"`). Les deux partagent le même moteur "drill"
  (`estDrill()`), mais `PageSession.modePedagogique` active trois différences ciblées : l'ordre des
  types d'exercice n'est jamais mélangé (`choisirTypeDrill`, du plus facile — QCM — au plus dur —
  réponse libre), on reste sur la même notion tant qu'elle n'est pas maîtrisée au lieu de faire
  tourner tout le lot (`resoudreDrill`), et deux écrans de pause s'ajoutent (`rendreTransition`
  avant le premier exercice, `rendreRecapFinal` avant la réécriture de confirmation) — c'est
  directement la réponse à un retour utilisateur : le mode "apprendre" habituel donnait l'impression
  d'aller trop vite et d'être trop dur pour une vraie première découverte.

## Pièges rencontrés

- **`versDateISO` doit utiliser les composants de date LOCAUX, jamais `toISOString()`** (qui est
  UTC) : un `Date` à minuit local devient la veille en UTC dans tout fuseau à l'est de Greenwich
  (le cas de l'utilisateur, Europe/Paris). Ce bug décalait d'un jour les pastilles du calendrier
  par rapport aux dates réellement stockées (un contrôle au 28 apparaissait sous le 29). Portée
  large : `versDateISO` sert à comparer des dates-jour partout (file de révision du jour,
  streak/gamification, rappels). `Utils.versDate()` a la même exigence pour parser une chaîne
  `"YYYY-MM-DD"` (`new Date("2026-09-28")` est aussi interprété en UTC par le moteur JS).
- **Un objet littéral avec un `;` au lieu d'une `,` entre deux propriétés casse tout le module**
  (`SyntaxError: Unexpected token ';'`) sans indiquer la ligne fautive dans la console du
  navigateur pour un gros script inline. Méthode qui a fonctionné pour localiser l'erreur : servir
  le fichier, `fetch` son contenu depuis la page, et faire une recherche dichotomique sur des
  préfixes du script via `import(URL.createObjectURL(new Blob([préfixe], {type:
  "text/javascript"})))` jusqu'à isoler l'octet exact où l'erreur apparaît (bien plus fiable qu'un
  vérificateur de parenthèses/accolades maison, qui doit distinguer correctement littéraux de
  gabarit imbriqués, littéraux regex vs division, etc.)
- **Naviguer vers un simple changement de `#hash` sur la même page ne recharge PAS le JavaScript**
  — évident après coup, mais a fait perdre du temps à déboguer des « correctifs » qui semblaient
  ne jamais prendre effet en test. Après avoir modifié `index.html`, toujours forcer un vrai
  rechargement (`location.reload()` ou navigation vers l'origine nue) avant de re-tester, pas
  juste changer le hash.
- Sous macOS, un serveur local lancé par l'agent ne peut pas lire `~/Documents` (protection TCC) :
  copier le site dans le dossier temporaire de session pour le prévisualiser (même contrainte que
  `vieenfamille`).
- Seul un événement `data-terminer` sur plusieurs boutons partageant le même attribut doit être
  attaché avec `querySelectorAll(...).forEach(...)`, jamais `querySelector(...)` seul — piège
  classique qui a rendu deux des trois boutons de la dernière étape de l'onboarding inertes
  silencieusement (aucune erreur console, juste aucun écouteur posé).

## Configuration Firebase à faire (aucun projet créé à ce jour)

Voir README § « Passer en production avec Firebase » pour la procédure complète. Rien n'est
urgent : le mode démo local fonctionne dès maintenant sans aucune configuration.

## Direction visuelle

Design system généré via le skill `ui-ux-pro-max` (persisté dans
`design-system/memoria/MASTER.md`) : style Flat Design, teal `#0D9488` (clair) / `#2DD4BF`
(sombre) comme couleur principale, orange `#EA580C` / `#FB923C` comme accent d'action (CTA
principal, streak), Plus Jakarta Sans pour tout le texte. Pas d'emoji comme icône nulle part —
un petit jeu d'icônes SVG traits (inspiré Lucide, dessiné à la main) sert tout le site via la
fonction `icono(nom, classes)` (section B). Thème sombre/clair/système, comme `vieenfamille`,
mais **système par défaut** ici (pas de préférence utilisateur reconfirmée comme dans l'autre
projet — à re-régler seulement si demandé).

## Pistes non faites

Voir README § « Pistes non faites ».
