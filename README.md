# Salle de sport

Réservation des créneaux de la salle de musculation de l'École d'ingénieurs de Castelmont : les créneaux des 7 prochains jours, la liste d'attente et l'initiation validée par un référent.

Projet du cours Développement Web, ISMIN 3A. API NestJS + Prisma (SQLite) dans `api/`, front React dans `web/`.

## Lancer

```bash
docker compose up --build
```

- Front : http://localhost:8080
- API : http://localhost:3000 (Swagger : http://localhost:3000/docs)

## Comptes de test

Créés au démarrage, tous avec le mot de passe `salle-de-sport` :

| Email | Rôle | Initiation |
|---|---|---|
| `referent1@castelmont.fr` … `referent6@castelmont.fr` | référent | validée |
| `alice.martin@castelmont.fr` | étudiante | validée |
| `bob.durand@castelmont.fr` | étudiant | non validée |

L'inscription crée toujours un compte étudiant, avec un email en `@castelmont.fr`.

## Tests

`npm ci` puis `npm test`, dans `api/` et dans `web/`.
