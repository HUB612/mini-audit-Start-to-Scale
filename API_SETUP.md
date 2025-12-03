# Configuration de l'API Brevo

Ce document explique comment configurer l'intégration avec l'API Brevo pour le formulaire de contact.

## Variables d'environnement requises

Pour que l'edge function fonctionne correctement, vous devez configurer les variables d'environnement suivantes dans votre projet Vercel :

### Variables obligatoires

1. **BREVO_API_KEY** : Votre clé API Brevo
   - Vous pouvez obtenir cette clé depuis votre compte Brevo (anciennement Sendinblue)
   - Allez dans Paramètres > Clés API
   - Créez une nouvelle clé API si nécessaire

2. **BREVO_RECIPIENT_EMAIL** : L'adresse email qui recevra les messages du formulaire
   - Exemple : `contact@hub612.com`

### Variables optionnelles

3. **BREVO_SENDER_EMAIL** : L'adresse email de l'expéditeur (par défaut : `noreply@hub612.com`)
   - Cette adresse doit être vérifiée dans votre compte Brevo

4. **BREVO_SENDER_NAME** : Le nom de l'expéditeur (par défaut : `Hub612`)

## Configuration dans Vercel

1. Allez sur votre projet dans le dashboard Vercel
2. Naviguez vers **Settings** > **Environment Variables**
3. Ajoutez les variables d'environnement listées ci-dessus
4. Assurez-vous de les ajouter pour les environnements appropriés (Production, Preview, Development)

## Test de l'intégration

Une fois les variables d'environnement configurées :

1. Déployez votre projet sur Vercel
2. Testez le formulaire de contact sur votre site
3. Vérifiez que vous recevez bien les emails dans la boîte configurée dans `BREVO_RECIPIENT_EMAIL`

## Structure de l'email envoyé

L'email envoyé contiendra :
- Nom de la startup
- Nom du contact
- Email du contact
- Téléphone (si fourni)
- Message (si fourni)

L'email de réponse sera automatiquement configuré pour répondre à l'adresse email du contact.

