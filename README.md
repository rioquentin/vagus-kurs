# Logopädie-Kurse

Une plateforme de révision web, en allemand, construite pour une étudiante en orthophonie à partir de ses polycopiés de cours.

**Site en ligne : https://rioquentin.github.io/vagus-kurs/**

## Le contexte

L'utilisatrice est en 2e année de formation en orthophonie (*Logopädie*) en Allemagne. Ses cours portent sur la voix et le larynx : anatomie, nerfs, pathologies, rééducation. J'ai transformé ses polycopiés en six cours interactifs, avec les outils qu'elle utilise pour réviser ses examens. Elle s'en sert au quotidien, sur téléphone et sur ordinateur.

## Ce que fait la plateforme

### Les cours

| Cours (allemand) | Traduction |
|---|---|
| N. vagus und Stimme | Le nerf vague et la voix |
| Laryngitis | Laryngite |
| Funktionelle, psychogene und neurogene Stimmstörungen | Troubles de la voix fonctionnels, psychogènes et neurologiques |
| Gutartige Stimmlippenveränderungen | Lésions bénignes des cordes vocales |
| Verletzungen, Gelenk, Hormone und Mutation | Lésions, articulation, hormones et mue de la voix |
| Schnellkurs: alle Stimmstörungen auf einen Blick | Cours express : tous les troubles de la voix en un coup d'œil |

Chaque cours est découpé en chapitres, avec des schémas en SVG, des questions de rappel et un examen blanc.

### Les fonctionnalités

- **Recherche** dans tout le contenu (raccourci `/` ou `Ctrl+K`) : chapitres, réponses, termes.
- **Fiches de révision** (`lernkarten.html`) : les questions de chaque chapitre, en répétition espacée. Un mode texte à trous existe aussi.
- **Glossaire** (`begriffe.html`) : chaque terme technique, avec la phrase qui l'explique et un lien vers l'endroit du cours.
- **Carnet** (`merkheft.html`) : on surligne un passage, on ajoute une note. Les questions ratées y sont listées et disparaissent après deux bonnes réponses de suite.
- **Quiz et examens blancs** : un quiz à la fin de chaque chapitre, un examen blanc chronométré par cours (pages `*-pruefung.html`), avec un historique des notes.
- **Session du jour** : environ 15 minutes de révision qui mélangent points faibles, fiches à revoir et nouvelles fiches.
- **Schémas** : zoom plein écran, légendes masquables pour s'entraîner, zone de dessin pour refaire un schéma de mémoire.
- **Lecture** : mode lecture (deux polices, quatre tailles), lecture à voix haute par la synthèse vocale du navigateur.
- **Interface bilingue** : allemand ou anglais. Seule l'interface est traduite, le contenu des cours reste en allemand.
- **Hors ligne et installable** : un service worker met le site en cache, un manifeste permet de l'installer comme une application sur téléphone.
- **Compte optionnel** : la progression, les fiches et les notes se synchronisent entre appareils. Sans compte, tout reste dans le navigateur.
- **Rappels** : notifications push et export d'un rappel au format `.ics` pour l'agenda.

## En chiffres

Comptés le 18/11/2026 sur le code et les données générées.

| | |
|---|---|
| Cours | 6 |
| Chapitres (y compris les fiches de synthèse) | 60 |
| Pages HTML générées | 71 |
| Figures dans les cours | 218 |
| Questions de rappel (fiches) | 478 |
| Questions à choix multiple | 104 |
| Termes du glossaire | 291 |
| Lignes de contenu de cours (HTML source) | 24 942 |
| Lignes du générateur (Node.js) | 1 706 |
| Lignes de JavaScript côté navigateur | 4 473 |
| Lignes de CSS | 1 696 |
| Entrées du dictionnaire d'interface anglais | environ 200 |

## Comment c'est construit

**Stack.** HTML, CSS et JavaScript sans framework ni dépendance côté navigateur. Un générateur en Node.js, sans dépendance non plus. Hébergement statique sur GitHub Pages. Synchronisation des comptes via Supabase (authentification par e-mail, une table protégée par Row Level Security), appelé avec `fetch`, sans SDK.

**Génération du contenu.** Le contenu de chaque cours est écrit sous forme de pages HTML autonomes, une par chapitre. Ces pages ne sont jamais modifiées par le générateur. Le script `build.mjs` :

1. place chaque page dans un gabarit commun (navigation, sommaire, progression) ;
2. fusionne les blocs `<style>` de toutes les pages en feuilles de style partagées, en vérifiant que le rendu de chaque élément reste identique à l'original ;
3. extrait du contenu les données des outils de révision (`study.mjs`) : questions et réponses, termes, QCM, figures, index de recherche ;
4. écrit la liste des fichiers et le numéro de version dans le service worker.

Ce dépôt contient le résultat de cette génération. Le générateur et les tests sont dans un dépôt privé.

**Fichiers principaux.**

```
index.html                 choix du cours
vagus.html, laryngitis.html, …   sommaire de chaque cours
<cours>-NN-<titre>.html    un chapitre
lernkarten.html            fiches de révision
merkheft.html              carnet et points faibles
begriffe.html              glossaire
sw.js                      service worker
manifest.webmanifest       installation comme application
assets/
  courses.json             description des six cours
  data.js                  fiches, termes, QCM, figures (généré)
  data-search.js           texte des chapitres pour la recherche (généré)
  app.js                   navigation, progression, recherche
  study.js                 fiches, quiz, session du jour
  tools.js                 schémas, dessin, lecture, rappels
  i18n.js, i18n-en.js      interface anglaise
  sync.js                  synchronisation entre appareils
  fonts/                   polices auto-hébergées
.github/workflows/         vérification hebdomadaire du site, envoi des rappels
```

**Cache hors ligne.** Le service worker met en cache toutes les pages à l'installation. Pour les pages et les scripts, il interroge d'abord le réseau, pour que les mises à jour soient visibles tout de suite, et se rabat sur le cache hors connexion. Les polices, dont le nom ne change jamais, sont servies directement depuis le cache. À chaque nouvelle version, l'ancien cache est supprimé.

**Contrôle.** Un workflow GitHub Actions ouvre le site chaque lundi avec Playwright et vérifie les pages des cours. Les erreurs JavaScript rencontrées dans le navigateur sont remontées vers un tableau de bord privé (`tableau.html`), qui affiche aussi la progression, avec l'accord de l'utilisatrice.

## Construit avec Claude Code

Tout le code et la mise en forme des cours ont été produits avec Claude Code. Ma part :

- **Fournir la matière.** Je pars des polycopiés de l'étudiante. Le contenu des cours en est tiré, puis relu.
- **Piloter la structure.** Je décide de l'architecture (site statique généré, contenu jamais retouché par le générateur), des outils à construire et de leur ordre.
- **Vérifier.** Je relis le contenu et je teste chaque fonctionnalité. Une règle fixe : le texte des cours ne doit pas changer. Des tests comparent le texte et le rendu des pages générées avec les originaux.
- **Faire itérer.** Je recueille les retours de l'utilisatrice, puis je fais corriger et reprendre jusqu'à ce que le résultat convienne.

Claude Code écrit le code, les scripts de test et la mise en page. Je ne l'écris pas ligne à ligne, mais je décide de ce qui est construit et je valide ce qui part en ligne.

## Lancer en local

Ce dépôt est un site statique. Depuis sa racine :

```
python -m http.server 8000
```

Sous Windows, `py` remplace `python` si besoin. Puis ouvrir http://localhost:8000. Le service worker et l'installation fonctionnent sur `localhost`. Les comptes sont configurés pour l'adresse du site en ligne, donc la connexion ne fonctionne pas en local.
