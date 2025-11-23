# Hub Survey - Mini Audit Start to Scale

Application web pour réaliser un mini audit des startups sur les thématiques du programme Start to Scale du Hub612.

## Description

Cette application permet aux startups de tester rapidement leur maturité sur 5 thématiques clés :
- **Business Model** : Modèle économique, pricing, positionnement
- **Produit** : Analytics, feedback utilisateur, tests
- **Go-to-Market** : KPIs, CAC, processus de vente
- **Organisation** : Structure, recrutement, culture d'entreprise
- **Financement** : Pitch deck, business plan, levée de fonds

Chaque thématique contient 5 questions, pour un total de 25 questions.

## Fonctionnalités

- ✅ **Framework Yew** : Application entièrement en Rust avec client-side rendering
- ✅ **Design responsive** adapté aux mobiles, tablettes et desktop
- ✅ Questionnaire interactif avec 25 questions (5 par thématique)
- ✅ Barre de progression en temps réel
- ✅ Graphique radar pour visualiser les résultats par thématique
- ✅ Résumé des scores par thématique
- ✅ Formulaire de contact pour être recontacté par l'équipe Hub612
- ✅ Transitions fluides entre les écrans

## Technologies

- **Rust** : Langage de programmation
- **Yew** : Framework Rust pour créer des applications web avec WebAssembly
- **WebAssembly** : Compilation vers WASM pour le navigateur
- **Trunk** : Outil de build et de développement
- **Serde** : Sérialisation/désérialisation JSON et YAML

## Installation

### Prérequis

- [Rust](https://www.rust-lang.org/tools/install) (dernière version stable)
- [Trunk](https://trunkrs.dev/) (outil de build pour WebAssembly)

### Étapes d'installation

```bash
# Installer Trunk
cargo install --locked trunk

# Ajouter la cible WebAssembly
rustup target add wasm32-unknown-unknown
```

## Utilisation

### Développement

```bash
# Lancer l'application en mode développement
trunk serve index.html
```

Puis ouvrez votre navigateur à l'adresse : **http://localhost:8080**

### Build de production

```bash
# Build de l'application
trunk build --release
```

Les fichiers générés seront dans le dossier `dist/`.

## Structure du projet

```
_hub-survey/
├── src/
│   ├── lib.rs          # Point d'entrée Yew
│   ├── app.rs          # Composant principal de l'application
│   ├── models.rs       # Modèles de données
│   ├── survey.rs       # Logique du questionnaire
│   └── components/     # Composants Yew
│       ├── mod.rs
│       ├── welcome.rs
│       ├── questions.rs
│       ├── results.rs
│       └── contact.rs
├── questions/          # Fichiers YAML des questions
│   ├── business-model.yaml
│   ├── produit.yaml
│   ├── go-to-market.yaml
│   ├── organisation.yaml
│   └── financement.yaml
├── index.html          # Page HTML principale (point d'ancrage pour Yew)
├── style.css           # Styles CSS
├── Cargo.toml          # Dépendances Rust
└── Trunk.toml          # Configuration Trunk
```

## Déploiement

### Déploiement automatique via Vercel (recommandé)

Le projet est déployé automatiquement par Vercel à chaque push sur la branche `main`.

**Configuration initiale :**

1. **Créer un projet sur Vercel** (une seule fois) :
   - Allez sur [vercel.com](https://vercel.com)
   - Importez le dépôt `HUB612/mini-audit-Start-to-Scale`
   - Notez l'**Org ID** et le **Project ID** (disponibles dans les paramètres du projet)

2. **Désactiver le déploiement automatique de Vercel** (important !) :
   - Allez sur votre projet Vercel → Settings → Git
   - Désactivez "Automatic deployments from Git"
   - Cela évite les déploiements en double (Vercel + GitHub Actions)

3. **Configurer les secrets GitHub** :
   - 📖 **Guide détaillé** : Voir [SETUP_VERCEL.md](SETUP_VERCEL.md) pour des instructions étape par étape
   - Allez dans les paramètres du dépôt GitHub → Secrets and variables → Actions
   - Ajoutez les secrets suivants :
     - `VERCEL_TOKEN` : Token d'API Vercel (généré dans [Vercel Settings → Tokens](https://vercel.com/account/tokens))
     - `VERCEL_ORG_ID` : ID de votre organisation Vercel (Team ID dans Settings → General)
     - `VERCEL_PROJECT_ID` : ID de votre projet Vercel (dans Settings → General)

4. **Le déploiement se fera automatiquement** à chaque push sur `main` via GitHub Actions !

Note : le workflow GitHub Actions historique `.github/workflows/deploy-vercel.yml` n'est plus utilisé, le déploiement est géré directement par Vercel.

### Déploiement sur Vercel (manuel)

Le projet est configuré pour être déployé sur Vercel. La configuration se trouve dans `vercel.json`.

**Option 1 : Déploiement via l'interface Vercel**

1. Allez sur [vercel.com](https://vercel.com) et connectez votre compte GitHub
2. Importez le dépôt `HUB612/mini-audit-Start-to-Scale`
3. Vercel détectera automatiquement la configuration dans `vercel.json`
4. Configurez les paramètres de build :
   - **Framework Preset** : Other
   - **Build Command** : `./build.sh` (déjà configuré dans vercel.json)
   - **Output Directory** : `dist` (déjà configuré dans vercel.json)
   - **Install Command** : (laisser vide, Rust sera installé automatiquement)
5. Cliquez sur "Deploy"

**Option 2 : Déploiement via CLI**

1. **Installer Vercel CLI** :

```bash
npm i -g vercel
```

2. **Se connecter** :

```bash
vercel login
```

3. **Déployer** :

```bash
vercel
```

4. **Pour un déploiement en production** :

```bash
vercel --prod
```

**Note** : Vercel installera automatiquement Rust et Trunk lors du build grâce au script `build.sh`.

### Déploiement sur Netlify

1. **Build de l'application** :

```bash
trunk build --release
```

2. **Configuration Netlify** :

Créez un fichier `netlify.toml` :

```toml
[build]
  command = "trunk build --release"
  publish = "dist"
```

3. **Déployer** :

Connectez votre dépôt GitHub à Netlify ou utilisez `netlify deploy`.

## Personnalisation

### Modifier les questions

Les questions sont définies dans les fichiers YAML du dossier `questions/`. Chaque fichier contient une thématique avec ses questions :

```yaml
thematic: "Business Model"
questions:
  - text: "Votre question ici"
    description: "Description optionnelle"
```

### Ajouter une nouvelle thématique

1. Créez un nouveau fichier YAML dans `questions/`
2. Ajoutez le fichier dans `src/survey.rs` dans la liste `thematics`

## Changelog

Voir [CHANGELOG.md](CHANGELOG.md) pour la liste des changements.

## Contribution

Les contributions sont les bienvenues ! Veuillez lire notre [Guide de contribution](CONTRIBUTING.md) pour plus de détails.

Avant de contribuer, veuillez également lire notre [Code de conduite](CODE_OF_CONDUCT.md).

## Sécurité

Si vous découvrez une vulnérabilité de sécurité, veuillez consulter notre [Politique de sécurité](SECURITY.md) pour savoir comment la signaler.

## Licence

Ce projet est sous licence MIT. Voir le fichier [LICENSE](LICENSE) pour plus de détails.

## Auteurs

Voir le fichier [AUTHORS.md](AUTHORS.md) pour la liste des contributeurs.

## Remerciements

Créé pour le Hub612 - Programme Start to Scale

