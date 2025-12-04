# Configuration de l'API Brevo

Ce document explique comment configurer l'intégration avec l'API Brevo pour le formulaire de contact.

## Fonctionnalités

L'edge function effectue les actions suivantes lors de la soumission du formulaire :

1. **Ajoute le contact à une liste Brevo** : Le contact est automatiquement ajouté à votre liste de contacts Brevo avec ses informations (nom, email, startup, téléphone, message)
2. **Envoie un email de remerciement** : Un email automatique est envoyé au contact pour le remercier et l'informer qu'un membre de l'équipe reviendra vers lui rapidement

## Variables d'environnement requises

Pour que l'edge function fonctionne correctement, vous devez configurer les variables d'environnement suivantes dans votre projet Vercel :

### Variables obligatoires

1. **BREVO_API_KEY** : Votre clé API Brevo
   - Vous pouvez obtenir cette clé depuis votre compte Brevo (anciennement Sendinblue)
   - Allez dans Paramètres > Clés API
   - Créez une nouvelle clé API si nécessaire

2. **BREVO_LIST_ID** : L'ID de la liste Brevo où ajouter les contacts
   - Vous pouvez trouver l'ID de votre liste dans Brevo : Contacts > Listes
   - L'ID est un nombre (exemple : `2` pour la liste par défaut)
   - Vous pouvez créer une nouvelle liste dédiée "Start to Scale" si vous le souhaitez

### Variables optionnelles

3. **BREVO_SENDER_EMAIL** : L'adresse email de l'expéditeur (par défaut : `noreply@hub612.com`)
   - Cette adresse doit être vérifiée dans votre compte Brevo
   - Elle sera utilisée pour envoyer l'email de remerciement

4. **BREVO_SENDER_NAME** : Le nom de l'expéditeur (par défaut : `Hub612`)
   - Le nom qui apparaîtra dans l'email de remerciement

## Configuration dans Vercel

1. Allez sur votre projet dans le dashboard Vercel
2. Naviguez vers **Settings** > **Environment Variables**
3. Ajoutez les variables d'environnement listées ci-dessus
4. Assurez-vous de les ajouter pour les environnements appropriés (Production, Preview, Development)

## Configuration dans Brevo

### Créer une liste (si nécessaire)

1. Connectez-vous à votre compte Brevo
2. Allez dans **Contacts** > **Listes**
3. Cliquez sur **Créer une liste**
4. Nommez-la par exemple "Start to Scale"
5. Notez l'ID de la liste (visible dans l'URL ou les détails de la liste)
6. Ajoutez cet ID dans la variable d'environnement `BREVO_LIST_ID`

### Créer les attributs personnalisés (recommandé)

Pour mieux organiser les données des contacts, vous pouvez créer des attributs personnalisés dans Brevo :

1. Allez dans **Contacts** > **Attributs**
2. Créez les attributs suivants (s'ils n'existent pas déjà) :
   - `STARTUP` (type: texte)
   - `TELEPHONE` (type: texte)
   - `MESSAGE` (type: texte long)
   - `PRENOM` (type: texte)
   - `NOM` (type: texte)

Ces attributs seront automatiquement remplis lors de l'ajout du contact.

## Test de l'intégration

Une fois les variables d'environnement configurées :

1. Déployez votre projet sur Vercel
2. Testez le formulaire de contact sur votre site
3. Vérifiez que :
   - Le contact apparaît dans votre liste Brevo
   - L'email de remerciement est bien envoyé au contact

## Structure de l'email de remerciement

L'email envoyé au contact contient :
- Un message de remerciement personnalisé avec son nom
- Le nom de sa startup
- Une confirmation que l'équipe reviendra vers lui rapidement
- Une signature de l'équipe Hub612

## Données stockées dans Brevo

Les informations suivantes sont stockées pour chaque contact :
- **Email** : Email du contact
- **PRENOM** : Prénom du contact
- **NOM** : Nom de famille du contact
- **STARTUP** : Nom de la startup
- **TELEPHONE** : Numéro de téléphone (si fourni)
- **MESSAGE** : Message du formulaire (si fourni)

