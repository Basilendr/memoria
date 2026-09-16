# Memoria

Application web d'apprentissage par cœur : tu donnes un cours, Memoria détecte les notions
importantes, te fait travailler avec plusieurs types d'exercices, détecte précisément ce que tu
oublies, et programme tes prochaines révisions avec un algorithme de répétition espacée.

Site statique en **un seul fichier** (`index.html`) — HTML/CSS/JS pur, aucune dépendance à
installer, aucun build. Choix délibéré : cette machine n'a pas Node.js/npm installé, et ce
fichier peut s'ouvrir, se lire et se déployer directement.

## Installation et lancement

Rien à installer. Pour prévisualiser en local (un vrai serveur est nécessaire — Firebase Auth ne
fonctionne pas en `file://`) :

```bash
python3 -m http.server 8080
```

puis ouvrir `http://localhost:8080`. En production, héberger `index.html` (+ `manifest.json`,
`icon.svg`, `sw.js`) sur n'importe quel hébergeur statique (Vercel, Netlify, GitHub Pages...) —
un `git push` suffit avec un hébergeur branché sur le dépôt.

## Mode démo (aucune configuration requise)

Tant que `FIREBASE_CONFIG.apiKey` vaut `"DEMO"` dans `index.html` (section JS **A**), toute
l'application tourne **en local dans le navigateur**, sans aucun serveur :

- comptes et mots de passe (hachés en SHA-256 côté client) stockés dans `localStorage` ;
- un bouton « Essayer avec des données d'exemple » crée un compte invité et un cours d'exemple
  (Révolution française) instantanément ;
- toutes les données restent sur cet appareil, dans ce navigateur.

C'est le mode dans lequel le projet a été livré et testé. Aucune action n'est nécessaire pour
l'essayer : ouvrir le site, cliquer sur « Essayer avec des données d'exemple ».

## Passer en production avec Firebase (comptes réels, multi-appareil)

1. Créer un projet sur [console.firebase.google.com](https://console.firebase.google.com).
2. Authentication → Sign-in method → activer **Email/Password** et **Google**.
3. Authentication → Settings → Authorized domains → ajouter le domaine de production une fois
   déployé (le domaine de preview d'un hébergeur change à chaque déploiement de branche).
4. Firestore Database → créer la base, puis publier le contenu de `firestore.rules`
   (Firestore → Rules → coller → Publier).
5. Récupérer la config web (Paramètres du projet → Vos applications → SDK) et la coller dans
   `index.html`, section JS **A**, objet `FIREBASE_CONFIG` — **transmettre le fichier, pas du
   texte copié-collé** (un caractère altéré dans une clé API donne une erreur
   `auth/api-key-not-valid` difficile à repérer).

Dès que `apiKey` n'est plus `"DEMO"`, l'app bascule automatiquement sur de vrais comptes
Firebase Auth + Firestore (le code est écrit pour supporter les deux modes sans modification —
voir `Store` et `Auth`, sections C et E).

Storage Firebase n'est volontairement **pas utilisé** (pas de photo de profil envoyée sur un
serveur) : l'avatar est redimensionné en local (canvas) et stocké comme image compacte
directement dans le profil Firestore, pour éviter la contrainte du plan payant Blaze qu'exige
Firebase Storage.

## Base de données (Firestore)

Isolée par utilisateur, en sous-collections :

```
users/{uid}                    profil (prénom, nom, streak, xp, préférences de rappel...)
  /matieres/{id}                matière (nom, couleur, icône)
  /cours/{id}                   cours (titre, matière, contenu brut, favori, archive)
  /chapitres/{id}                chapitre d'un cours (détecté depuis les titres # du contenu)
  /notions/{id}                 notion détectée + sa progression (étape, maîtrise, prochaine
                                 révision, éléments oubliés...) — voir § Moteur ci-dessous
  /historique/{id}               chaque tentative de révision (date, type d'exercice, résultat)
  /sessions/{id}                 résumé de chaque session de révision terminée
  /examens/{id}                  résultats des sessions en mode examen
  /controles/{id}                dates de contrôle enregistrées (pour la planification)
  /notifications/{id}            centre de notifications in-app
```

Les **exercices ne sont jamais stockés** : ils sont régénérés à la volée par le moteur
d'apprentissage à partir des champs de la notion (`question`, `reponse`, `elements`), à chaque
session. Seules la notion elle-même, sa progression, et l'historique des tentatives sont
persistés.

## Moteur d'apprentissage (le cœur du produit)

Tout dans `index.html`, section JS **D** :

- **`Analyseur`** — détection heuristique (expressions régulières + mots-clés) des définitions,
  dates, personnages, chiffres, listes/étapes, causes/conséquences, vocabulaire et règles dans un
  texte de cours. Aucune IA : c'est un moteur par motifs, pas une compréhension sémantique.
- **`Moteur`** — génère les 7 types d'exercices (QCM, vrai/faux, texte à trous, réponse libre,
  réécriture, association, remise en ordre) à partir d'une notion, et évalue les réponses. Pour
  les réponses libres, la comparaison se fait par éléments essentiels couverts (mots-clés), pas
  mot à mot — heuristique également, pas une vraie compréhension du sens.
- **`Revision`** — l'algorithme de répétition espacée (inspiré de SM-2), qui calcule le niveau de
  maîtrise, la prochaine date de révision et la priorité de chaque notion à partir du résultat,
  de la confiance déclarée et des indices utilisés.

## API IA

**Aucune API d'IA n'est appelée.** Ce projet est un site 100% statique sans serveur : une clé
d'API IA ne pourrait jamais rester secrète côté client (elle serait visible dans le code source
envoyé au navigateur). Le moteur heuristique ci-dessus tient donc lieu de « mode démo » en
permanence, conformément à ce principe.

Pour brancher une vraie API d'IA un jour (meilleure détection des notions, évaluation plus fine
des réponses libres), il faudrait un backend — par exemple des Firebase Cloud Functions qui
appellent l'API avec la clé côté serveur. C'est un changement d'architecture (ce n'est plus un
site 100% statique), à rediscuter avant de l'entreprendre.

## Tests

Aucun framework de test automatisé (Jest, Vitest...) n'est installé — même contrainte « aucun
outillage » que pour le reste du projet. La vérification s'est faite manuellement dans un
navigateur réel, en rejouant le parcours complet : inscription, onboarding, création de cours,
analyse, validation des notions, session de révision (chaque type d'exercice), correction,
calcul de la prochaine révision, mode examen, calendrier, statistiques.

Si des tests automatisés deviennent nécessaires, les fonctions pures du moteur d'apprentissage
(`Analyseur.analyser`, `Moteur.evaluer`, `Revision.calculerRevisionSuivante`) sont les meilleures
candidates : elles ne touchent ni au DOM ni à Firestore et sont donc testables isolément une fois
un outil comme Vitest introduit.

## Déploiement

Pousser sur un dépôt Git relié à un hébergeur statique (Vercel, Netlify...) avec redéploiement
automatique à chaque push — pas de build à configurer, juste servir les fichiers à la racine.

## Pistes non faites

- Notifications réelles hors application (nécessiterait un backend — Firebase Cloud Functions +
  Cloud Messaging). Le centre de notifications in-app fonctionne tant que l'app est ouverte.
- Graphique d'évolution de la maîtrise par notion dans le temps (§36 du cahier des charges) :
  aucun instantané historique n'est conservé pour le reconstruire fidèlement ; la page
  Progression affiche à la place une activité réelle (tentatives par jour) et les compteurs
  agrégés, tous directement dérivés des données.
- Import de fichiers autres que `.txt`, `.pdf`, `.docx`.
- Récupération de mot de passe par e-mail en mode démo local (nécessite un vrai projet Firebase).
