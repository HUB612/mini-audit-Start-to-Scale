# Guide de contribution

Merci de votre intérêt pour contribuer à Hub Survey ! Ce document fournit des directives pour contribuer au projet.

## Comment contribuer

### Signaler un bug

Si vous trouvez un bug, veuillez créer une [issue](../../issues) avec :
- Une description claire du problème
- Les étapes pour reproduire le bug
- Le comportement attendu vs le comportement observé
- Votre environnement (OS, version de Rust, navigateur, etc.)

### Proposer une fonctionnalité

Les suggestions de fonctionnalités sont les bienvenues ! Créez une [issue](../../issues) avec :
- Une description détaillée de la fonctionnalité
- Le cas d'usage et la valeur ajoutée
- Des exemples d'utilisation si possible

### Contribuer du code

1. **Fork le projet** et clonez votre fork
2. **Créez une branche** pour votre fonctionnalité ou correction :
   ```bash
   git checkout -b feature/ma-fonctionnalite
   # ou
   git checkout -b fix/mon-bug
   ```
3. **Faites vos modifications** en suivant les conventions du projet
4. **Testez vos modifications** :
   ```bash
   # Lancer l'application en mode développement
   trunk serve index.html
   ```
5. **Vérifiez le formatage** :
   ```bash
   cargo fmt --check
   ```
6. **Vérifiez les lints** :
   ```bash
   cargo clippy -- -D warnings
   ```
7. **Commitez vos changements** avec des messages clairs :
   ```bash
   git commit -m "feat: ajouter une nouvelle fonctionnalité"
   # ou
   git commit -m "fix: corriger un bug"
   ```
8. **Pushez vers votre fork** :
   ```bash
   git push origin feature/ma-fonctionnalite
   ```
9. **Ouvrez une Pull Request** sur GitHub

## Conventions de code

### Formatage

Le projet utilise `rustfmt`. Assurez-vous que votre code est formaté :
```bash
cargo fmt
```

### Linting

Le projet utilise `clippy`. Vérifiez qu'il n'y a pas d'avertissements :
```bash
cargo clippy -- -D warnings
```

### Tests

- Testez manuellement toutes les fonctionnalités avant de soumettre une PR
- Vérifiez que l'application compile et fonctionne correctement
- Testez sur différents navigateurs si possible

### Messages de commit

Nous utilisons des conventions de commit pour faciliter la maintenance :
- `feat:` : Nouvelle fonctionnalité
- `fix:` : Correction de bug
- `docs:` : Documentation uniquement
- `style:` : Changements de formatage (pas de changement de code)
- `refactor:` : Refactorisation du code
- `test:` : Ajout ou modification de tests
- `chore:` : Tâches de maintenance

Exemples :
```
feat: ajouter l'export des résultats en PDF
fix: corriger le calcul des scores par catégorie
docs: mettre à jour la documentation sur les questions
style: améliorer le responsive design
```

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
├── static/             # Fichiers statiques (images, etc.)
├── index.html          # Page HTML principale
├── style.css           # Styles CSS
├── Cargo.toml          # Dépendances Rust
└── Trunk.toml          # Configuration Trunk
```

## Modifier les questions

Pour modifier ou ajouter des questions :

1. Modifiez le fichier YAML approprié dans `questions/`
2. Suivez le format existant :
   ```yaml
   thematic: "Nom de la thématique"
   questions:
     - text: "Votre question"
       description: "Description optionnelle"
   ```
3. Testez que les questions se chargent correctement

## Ajouter une nouvelle thématique

1. Créez un nouveau fichier YAML dans `questions/` avec le format standard
2. Ajoutez le fichier dans `src/survey.rs` dans la liste `thematics` :
   ```rust
   let thematics = vec![
       ("business-model", include_str!("../questions/business-model.yaml")),
       ("nouvelle-thematique", include_str!("../questions/nouvelle-thematique.yaml")),
       // ...
   ];
   ```
3. Testez que la nouvelle thématique apparaît correctement dans l'application

## Modifier les messages de résultats

Les messages de résultats sont définis dans `src/components/results.rs` :
- `get_global_message()` : Messages pour le score global
- `get_feedback_message()` : Messages pour chaque catégorie selon le score

Pour modifier ces messages, éditez directement ces fonctions.

## Processus de review

- Les PR seront examinées par les mainteneurs
- Des commentaires peuvent être demandés pour améliorer le code
- Les PR doivent compiler sans erreur et fonctionner correctement avant d'être mergées

## Questions ?

Si vous avez des questions, n'hésitez pas à ouvrir une issue ou à contacter les mainteneurs.

Merci de contribuer à Hub Survey ! 🎉

