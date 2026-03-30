# Guide de Désinstallation

[English Version (UNINSTALL.md)](UNINSTALL.md) | [Version Espagnole (UNINSTALL_es.md)](UNINSTALL_es.md)

Ce document décrit les procédures pour supprimer complètement la plateforme DisherIo de votre système.

> **Avertissement :** Toutes les opérations de cette page sont irréversibles. Sauvegardez vos données avant de continuer.

---

## 1. Arrêter et Supprimer les Conteneurs

Arrête tous les services et supprime les conteneurs, réseaux, volumes et conteneurs orphelins :

```bash
cd disherio
docker compose down --volumes --remove-orphans
```

Cette commande :
- Arrête et supprime tous les conteneurs DisherIO (`disherio_mongo`, `disherio_backend`, `disherio_frontend`, `disherio_caddy`)
- Supprime les réseaux Docker associés (`disherio_disherio_net`)
- Supprime les volumes persistants (`mongo_data`, `uploads`, `caddy_data`, `caddy_config`)
- Supprime les conteneurs orphelins non définis dans le `docker-compose.yml` actuel

---

## 2. Supprimer les Images Personnalisées

Supprime les images de l'application construites lors de l'installation :

```bash
docker rmi disherio-backend:latest disherio-frontend:latest
```

---

## 3. Nettoyer les Images de Base Non Utilisées

Supprime les images de base téléchargées lors de l'installation qui ne sont plus utilisées :

```bash
docker image prune -af
```

Cela supprime toutes les images inutilisées du système, y compris `mongo:7`, `caddy:2-alpine` et `node:20-alpine` si aucun autre projet ne les référence.

---

## 4. Supprimer le Répertoire du Projet

```bash
rm -rf /chemin/vers/disherio
```

Remplacez `/chemin/vers/disherio` par le chemin réel de votre répertoire d'installation.

---

## Récapitulatif

| Étape | Commande | Effet |
|-------|---------|-------|
| 1 | `docker compose down --volumes --remove-orphans` | Supprime conteneurs, réseaux, volumes et orphelins |
| 2 | `docker rmi disherio-backend:latest disherio-frontend:latest` | Supprime les images personnalisées |
| 3 | `docker image prune -af` | Supprime les images de base inutilisées |
| 4 | `rm -rf /chemin/vers/disherio` | Supprime le répertoire du projet |
