# Salle de sport

Réservation des créneaux de la salle de musculation de l'École d'ingénieurs de Castelmont : les créneaux des 7 prochains jours, la liste d'attente et l'initiation validée par un référent.

Projet du cours Développement Web, ISMIN 3A. API NestJS + Prisma (SQLite) dans `api/`, front React dans `web/`.

## Lancer

```bash
docker compose up --build
```

- Front : http://localhost:8080
- API : http://localhost:3000 (Swagger : http://localhost:3000/docs, santé : http://localhost:3000/health)

Sans Docker, dans `api/` puis dans `web/` :

```bash
# api/
cp .env.example .env && npm ci
npx prisma migrate deploy && npm run db:seed
npm run start:dev

# web/
cp .env.example .env && npm ci
npm run dev
```

Le front est alors sur http://localhost:5173.

## Comptes de test

Créés au démarrage, tous avec le mot de passe `salle-de-sport` :

| Email | Rôle | Initiation |
|---|---|---|
| `referent1@castelmont.fr` … `referent6@castelmont.fr` | référent | validée |
| `alice.martin@castelmont.fr` | élève | validée |
| `bob.durand@castelmont.fr` | élève | non validée |

Pour créer un compte élève : « Créer un compte » sur la page de connexion, avec un email en `@castelmont.fr`. L'inscription crée toujours un compte élève ; il peut réserver une fois son initiation validée par un référent (page « Initiations »).

## Tests

`npm ci` puis `npm test`, dans `api/` et dans `web/`.

## Limites connues

- Recherche d'élèves (référents) : les majuscules sont ignorées, sauf sur les lettres accentuées, et les accents comptent. « helene » ne trouve pas « Hélène ».
- Mes créneaux : « Désinscription fermée » est calculé à l'affichage. Si la page reste ouverte au-delà du délai d'une heure, le bouton reste actif jusqu'au prochain rafraîchissement, et l'API refuse la désinscription avec son message.
- Liste des inscrits d'un créneau : « ← Retour au planning » revient au premier jour, pas au jour consulté.
- Initiations : relancer « Rechercher » avec le même texte ne recharge pas la liste.
