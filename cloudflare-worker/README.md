# ChocoAvent — Cloudflare Push Worker (100 % gratuit, sans CB)

Ce dossier contient le micro-relais Cloudflare Workers pour envoyer :
1. Les **notifications Push** lors des propositions/acceptations d'échanges (`/notify-trade`) ;
2. Le **rappel quotidien** à l'heure choisie par chaque membre (toutes les 5 min via Cron Trigger).

## Mise en place (1 seule fois)

```bash
cd cloudflare-worker
npm install

# 1. Générer une paire de clés VAPID (sans compte)
npx web-push generate-vapid-keys

# 2. Se connecter à Cloudflare (compte gratuit, sans carte bancaire)
npx wrangler login

# 3. Enregistrer les clés secrètes dans Cloudflare
npx wrangler secret put VAPID_PUBLIC_KEY
npx wrangler secret put VAPID_PRIVATE_KEY

# 4. Déployer le Worker
npx wrangler deploy
```

Ensuite, copie :
- l'URL affichée (`https://chocoavent-push-worker.<ton-compte>.workers.dev`) dans `push.workerUrl`
- la clé publique VAPID dans `push.vapidPublicKey`

dans `src/environments/environment.ts` et `src/environments/environment.prod.ts`, puis redéploie l'app Firebase (`npm run build && npx firebase-tools deploy --only firestore:rules,hosting`).
