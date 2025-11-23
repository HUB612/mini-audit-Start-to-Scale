# Politique de sécurité

## Versions supportées

Nous fournissons des mises à jour de sécurité pour les versions suivantes :

| Version | Supportée          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |
| < 0.1   | :x:                |

## Signaler une vulnérabilité

Si vous découvrez une vulnérabilité de sécurité, veuillez **ne pas** ouvrir une issue publique.

Au lieu de cela, veuillez envoyer un email aux mainteneurs du projet avec les détails suivants :

- Description de la vulnérabilité
- Étapes pour reproduire le problème
- Impact potentiel
- Suggestions de correction (si vous en avez)

Nous examinerons votre rapport et vous répondrons dans les 48 heures. Si la vulnérabilité est acceptée, nous travaillerons sur un correctif et vous tiendrons informé de la progression.

## Processus de divulgation

1. **Rapport initial** : Vous signalez la vulnérabilité par email
2. **Confirmation** : Nous confirmons la réception dans les 48 heures
3. **Évaluation** : Nous évaluons la vulnérabilité et son impact
4. **Correctif** : Nous développons et testons un correctif
5. **Publication** : Nous publions le correctif et créditons le rapporteur (si souhaité)

## Récompenses

Actuellement, nous n'offrons pas de programme de récompenses pour les vulnérabilités, mais nous créditons volontiers les chercheurs en sécurité dans nos notes de version.

## Bonnes pratiques de sécurité

Pour contribuer à la sécurité du projet :

- Gardez vos dépendances à jour avec `cargo update`
- Signalez les vulnérabilités de manière responsable
- Suivez les meilleures pratiques de développement sécurisé
- Utilisez des outils d'analyse statique comme `cargo audit` et `cargo clippy`
- Vérifiez régulièrement les vulnérabilités connues dans les dépendances :
  ```bash
  cargo audit
  ```

## Notes de sécurité

### Application WebAssembly

Cette application s'exécute côté client dans le navigateur. Les données du questionnaire ne sont pas envoyées à un serveur et restent locales au navigateur. Cependant, soyez conscient que :

- Les données peuvent être stockées dans le localStorage du navigateur
- Les données peuvent être visibles dans les outils de développement du navigateur
- Aucune donnée personnelle ne devrait être collectée sans consentement explicite

### Dépendances

Nous nous efforçons de maintenir les dépendances à jour et de suivre les alertes de sécurité. Si vous découvrez une vulnérabilité dans une dépendance, veuillez nous en informer.

