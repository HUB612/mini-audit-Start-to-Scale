> **Note :** ces workflows de déploiement Vercel via GitHub Actions ne sont plus utilisés. Le déploiement est désormais géré directement par Vercel.

# GitHub Actions Workflows

Ce dossier contient les workflows GitHub Actions pour automatiser les tâches du projet.

## deploy-vercel.yml

Workflow qui déploie automatiquement l'application sur Vercel à chaque push sur la branche `main`.

### Déclencheurs

- Push sur la branche `main`
- Pull requests vers `main`
- Déclenchement manuel via `workflow_dispatch`

### Prérequis

**⚠️ Important : Désactiver le déploiement automatique de Vercel**

Avant d'utiliser ce workflow, vous devez désactiver le déploiement automatique de Vercel pour éviter les déploiements en double :

1. Allez sur votre projet Vercel
2. Settings → Git
3. Désactivez "Automatic deployments from Git"
4. Le déploiement sera géré uniquement par GitHub Actions

### Configuration des secrets GitHub

Pour que ce workflow fonctionne, vous devez configurer les secrets suivants dans les paramètres GitHub du dépôt :

1. **VERCEL_TOKEN** : Token d'API Vercel
   - Générer sur [Vercel Settings → Tokens](https://vercel.com/account/tokens)
   - Créer un nouveau token avec les permissions nécessaires

2. **VERCEL_ORG_ID** : ID de votre organisation Vercel
   - Trouvable dans les paramètres du projet Vercel
   - Ou via la CLI : `vercel whoami` puis regarder dans les paramètres

3. **VERCEL_PROJECT_ID** : ID de votre projet Vercel
   - Trouvable dans les paramètres du projet Vercel
   - Ou via la CLI après avoir lié le projet

### Ajouter les secrets dans GitHub

1. Allez dans votre dépôt GitHub
2. Settings → Secrets and variables → Actions
3. Cliquez sur "New repository secret"
4. Ajoutez chaque secret avec son nom et sa valeur

### Comment obtenir les IDs Vercel

**Via l'interface web :**
1. Allez sur votre projet Vercel
2. Settings → General
3. Scroll jusqu'à "Project ID" et "Team ID" (Org ID)

**Via la CLI :**
```bash
vercel link
# Cela créera un fichier .vercel/project.json avec les IDs
cat .vercel/project.json
```

### Comportement

- **Sur push vers main** : Déploie en production (`--prod`)
- **Sur pull request** : Crée un preview deployment
- Le build utilise Rust stable et Trunk pour compiler vers WebAssembly

