# Salle de sport

Réservation des créneaux de la salle de musculation de l'École d'ingénieurs de Castelmont : les créneaux des 7 prochains jours, la liste d'attente et l'initiation validée par un référent.

Projet du cours Développement Web, ISMIN 3A. API NestJS + Prisma (SQLite) dans `api/`, front React dans `web/`.

## Lancer avec Docker

Prérequis : Docker et Docker Compose v2, ports 3000 et 8080 libres. À la racine du dépôt :

```bash
docker compose up --build
```

- Front : http://localhost:8080
- API : http://localhost:3000 (`GET /health` répond 200), documentation Swagger sur http://localhost:3000/docs

Le service `migrate` applique les migrations et remplit la base, puis s'arrête ; l'API attend qu'il ait fini, et le front attend que l'API réponde. La base SQLite vit dans le volume `data` et survit aux redémarrages.

- `docker compose down` arrête tout et garde les données.
- `docker compose down -v` supprime aussi le volume, donc la base.

Le secret qui signe les tokens a une valeur de développement dans `compose.yaml`, pour que le projet démarre sans configuration. Pour en utiliser un autre, définir la variable `JWT_SECRET` avant de lancer : `JWT_SECRET=un-autre-secret docker compose up --build`.

## Tests

`npm ci` puis `npm test`, dans `api/` et dans `web/`.
