# ChocoAvent — PWA Familiale (Ionic + Angular + Firebase)

Application web mobile (**PWA**) permettant à 4 membres d'une famille de suivre en temps réel qui a récupéré quelles cases de son calendrier de l'Avent (1 à 24 décembre).

## Stack technique

- **Frontend / UI mobile** : **Angular 22** (Standalone Components + Signals + Zoneless) + **Ionic 9** (`@ionic/angular`) + **Ionicons 8**
- **PWA** : **`@angular/pwa`** (`@angular/service-worker`, `manifest.webmanifest`, `ngsw-config.json`)
- **Backend / Temps réel / Hébergement** : **Firebase 13** (Plan Spark gratuit : Cloud Firestore `onSnapshot` + Firebase Hosting)

---

## Architecture Backend Firestore (2 collections)

Aucune gestion d'e-mail ou de mot de passe complexe : tu crées simplement les 4 utilisateurs directement dans Firestore avec leur **nom** et leur **code PIN**.

1. **`members/{id}`** — Les utilisateurs créés manuellement dans la console Firestore (ex. les 4 participants + un éventuel compte superviseur) :
   - `name` *(string)* : ex. `"Kyllian"`
   - `pin` *(string)* : `"0000"` *(lorsque le membre change son PIN dans l'app, il est automatiquement remplacé par un `pinHash` SHA-256)*
   - `isSupervisor` *(boolean, optionnel)* : `true` pour un compte en lecture seule (superviseur qui consulte sans prendre de chocolats ni apparaître dans les participants)
2. **`claims/{claimId}`** — Créée automatiquement par l'application lors des appuis sur `Claim` (`memberUid`, `memberName`, `dayNumber`, `createdAt`), avec verrouillage anti-triche passé 35 secondes dans [firestore.rules](firestore.rules).

---

## Déploiement Firebase (Plan Spark gratuit — sans carte bancaire)

### 1. Créer le projet & la base Firestore
1. Va sur [console.firebase.google.com](https://console.firebase.google.com) → **Créer un projet**.
2. Active **Firestore Database** → **Créer une base de données** (région Europe, mode production).
3. Dans **Firestore Database → Données**, clique sur **Démarrer une collection** → nomme-la **`members`**, et ajoute les **4 documents** (ID automatique) avec juste 2 champs par document :
   - `name` (type `string`) : prénom du membre (ex. `Kyllian`, `Marie`, `Lucas`, `Papa`)
   - `pin` (type `string`) : `0000`

### 2. Renseigner les clés Firebase dans le frontend
Dans **Paramètres du projet → Vos applications → Web (`</>`)**, copie `firebaseConfig` dans :
- `src/environments/environment.ts`
- `src/environments/environment.prod.ts`

### 3. Build & Déploiement
```bash
npm test -- --watch=false
npm run build
npx firebase-tools login
npx firebase-tools use --add
npx firebase-tools deploy --only firestore:rules,hosting
```
