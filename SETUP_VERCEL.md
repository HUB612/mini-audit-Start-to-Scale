> **Note :** ce guide décrit l’ancienne configuration via GitHub Actions. Le projet utilise désormais le déploiement automatique natif de Vercel (voir `README.md`).

# Guide : Configuration des secrets Vercel pour GitHub Actions

Ce guide vous explique étape par étape comment obtenir les valeurs nécessaires pour configurer les secrets GitHub Actions.

## 📋 Les 3 secrets nécessaires

1. **VERCEL_TOKEN** - Token d'API Vercel
2. **VERCEL_ORG_ID** - ID de votre organisation/équipe Vercel
3. **VERCEL_PROJECT_ID** - ID de votre projet Vercel

---

## 🔑 1. Obtenir VERCEL_TOKEN

### Méthode 1 : Via l'interface web (recommandé)

1. Allez sur [https://vercel.com/account/tokens](https://vercel.com/account/tokens)
2. Connectez-vous à votre compte Vercel
3. Cliquez sur **"Create Token"**
4. Donnez un nom au token (ex: "GitHub Actions - mini-audit")
5. Choisissez une expiration (recommandé : "No Expiration" pour les CI/CD)
6. Cliquez sur **"Create"**
7. **⚠️ IMPORTANT** : Copiez immédiatement le token affiché (vous ne pourrez plus le voir après)
8. Collez-le dans le secret GitHub `VERCEL_TOKEN`

### Méthode 2 : Via la CLI

```bash
# Si vous avez déjà la CLI Vercel installée
vercel login
# Le token sera stocké dans ~/.vercel/auth.json
# Mais il est préférable d'en créer un nouveau via l'interface web
```

---

## 🏢 2. Obtenir VERCEL_ORG_ID

L'**ORG_ID** est aussi appelé **Team ID** dans l'interface Vercel.

### Méthode 1 : Via l'interface web

1. Allez sur [vercel.com](https://vercel.com)
2. Connectez-vous et allez sur votre **projet** (ou créez-en un si nécessaire)
3. Cliquez sur **Settings** (en haut à droite ou dans le menu)
4. Dans le menu de gauche, cliquez sur **General**
5. Faites défiler jusqu'à la section **"Team"** ou **"Organization"**
6. Vous verrez **"Team ID"** ou **"Organization ID"** - c'est votre `VERCEL_ORG_ID`
7. Copiez cette valeur

**Note** : Si vous êtes sur un compte personnel (pas une équipe), l'ORG_ID peut être votre User ID.

### Méthode 2 : Via la CLI

```bash
# Installer Vercel CLI si nécessaire
npm install -g vercel

# Se connecter
vercel login

# Lier le projet (si pas déjà fait)
cd /home/kdelfour/Workspace/Personnel/Prototype/_hub-survey
vercel link

# Cela créera un fichier .vercel/project.json
cat .vercel/project.json
# Vous verrez quelque chose comme :
# {
#   "orgId": "team_xxxxxxxxxxxxx",
#   "projectId": "prj_xxxxxxxxxxxxx"
# }
```

Le `orgId` dans ce fichier est votre `VERCEL_ORG_ID`.

---

## 📦 3. Obtenir VERCEL_PROJECT_ID

### Méthode 1 : Via l'interface web

1. Allez sur votre projet Vercel
2. Cliquez sur **Settings**
3. Dans le menu de gauche, cliquez sur **General**
4. Faites défiler jusqu'à la section **"Project ID"**
5. Copiez cette valeur (commence généralement par `prj_`)

### Méthode 2 : Via la CLI

```bash
# Après avoir fait 'vercel link'
cat .vercel/project.json
# Le 'projectId' est votre VERCEL_PROJECT_ID
```

### Méthode 3 : Via l'URL du projet

Quand vous êtes sur votre projet Vercel, l'URL ressemble à :
```
https://vercel.com/[team-name]/[project-name]/[deployment-id]
```

Mais le Project ID n'est pas directement visible dans l'URL, donc utilisez les méthodes 1 ou 2.

---

## ✅ 4. Ajouter les secrets dans GitHub

Une fois que vous avez les 3 valeurs :

1. Allez sur votre dépôt GitHub : `https://github.com/HUB612/mini-audit-Start-to-Scale`
2. Cliquez sur **Settings** (en haut du dépôt)
3. Dans le menu de gauche, cliquez sur **Secrets and variables** → **Actions**
4. Cliquez sur **"New repository secret"**
5. Ajoutez chaque secret un par un :

   **Secret 1 :**
   - Name: `VERCEL_TOKEN`
   - Secret: [collez votre token Vercel]
   - Cliquez sur **"Add secret"**

   **Secret 2 :**
   - Name: `VERCEL_ORG_ID`
   - Secret: [collez votre Org ID / Team ID]
   - Cliquez sur **"Add secret"**

   **Secret 3 :**
   - Name: `VERCEL_PROJECT_ID`
   - Secret: [collez votre Project ID]
   - Cliquez sur **"Add secret"**

---

## 🧪 5. Tester la configuration

Après avoir ajouté les secrets :

1. Faites un petit changement dans le code (ou créez un commit vide)
2. Poussez vers `main` :
   ```bash
   git commit --allow-empty -m "test: vérifier le déploiement Vercel"
   git push
   ```
3. Allez dans l'onglet **Actions** de votre dépôt GitHub
4. Vous devriez voir le workflow "Deploy to Vercel" se lancer
5. Si tout est correct, le build devrait réussir et déployer sur Vercel

---

## 🆘 Dépannage

### Le workflow échoue avec "Invalid token"
- Vérifiez que le `VERCEL_TOKEN` est correctement copié (sans espaces)
- Assurez-vous que le token n'a pas expiré
- Créez un nouveau token si nécessaire

### Le workflow échoue avec "Project not found"
- Vérifiez que `VERCEL_PROJECT_ID` est correct
- Assurez-vous que le projet existe bien sur Vercel
- Vérifiez que vous avez les permissions sur ce projet

### Le workflow échoue avec "Organization not found"
- Vérifiez que `VERCEL_ORG_ID` est correct
- Si vous êtes sur un compte personnel, utilisez votre User ID
- Vérifiez que vous êtes membre de l'organisation

---

## 📝 Résumé rapide

| Secret | Où le trouver |
|--------|---------------|
| `VERCEL_TOKEN` | [vercel.com/account/tokens](https://vercel.com/account/tokens) → Create Token |
| `VERCEL_ORG_ID` | Vercel Project → Settings → General → Team ID |
| `VERCEL_PROJECT_ID` | Vercel Project → Settings → General → Project ID |

Ou via CLI : `vercel link` puis `cat .vercel/project.json`

