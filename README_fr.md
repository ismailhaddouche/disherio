# DisherIo

[English Version (README.md)](README.md) | [Versión en Español (README_es.md)](README_es.md)

DisherIo est une plateforme intégrée de gestion de restaurant offrant des solutions pour la commande en libre-service, l'assistance à table, les systèmes d'affichage en cuisine (KDS) et les opérations de point de vente (POS).

## Index de la Documentation

- [Guide d'installation en anglais](docs/INSTALL.md) : Prérequis système et procédures de déploiement.
- [Configuration et maintenance en anglais](docs/CONFIGURE.md) : Gestion opérationnelle et utilisation des scripts.
- [Architecture et stack technique en anglais](docs/ARCHITECTURE.md) : Aperçu technique et modèles de conception.
- [Dépannage en anglais](docs/ERRORS.md) : Résolution d'erreurs et procédures de diagnostic.

## Modules Principaux

- Borne de Libre-service : Interface client pour la prise de commande via authentification par code QR.
- Système d'Affichage en Cuisine (KDS) : Gestion du cycle de vie des commandes en temps réel pour la cuisine.
- Point de Vente (POS) : Traitement des transactions, paiements et historique. Fermer une session la maintient disponible pour l'encaissement ; l'archiver règle ses tickets, la retire des vues actives et la conserve dans l'historique.
- Service d'Assistance à Table (TAS) : Outils numériques pour serveurs dédiés à la gestion des tables et aux demandes de service.
- Tableau de Bord Administratif : Analytiques centralisées, administration du personnel et configuration des menus.

## Stack Technique

- Frontend : Angular 21, TailwindCSS, Socket.IO Client.
- Backend : Node.js (Express 5), Socket.IO, Mongoose 9.
- Base de données : MongoDB 7.
- État partagé : Redis 7 pour le cache, Socket.IO et le cycle de vie des
  jetons.
- Infrastructure : Docker, Caddy (Proxy Inverse).
- Observabilité : journaux structurés Pino, endpoints de santé et `/metrics`
  uniquement sur le réseau interne du backend.
- Langage : TypeScript 5.

DisherIo n'intègre ni Grafana, ni serveur Prometheus, ni Alertmanager, ni
exportateurs de métriques. L'endpoint interne `/metrics` conserve le format
d'exposition Prometheus pour des intégrations externes facultatives, mais Caddy
ne le publie pas et la topologie Compose par défaut ne le collecte pas.

Pour les spécifications techniques, consultez la [documentation d'architecture en anglais](docs/ARCHITECTURE.md).

## Déploiement

Déploiement automatisé standard sur Linux :

```bash
git clone https://github.com/ismailhaddouche/disherio.git
cd disherio
sudo ./scripts/install.sh
```

Des instructions détaillées sont disponibles dans le [guide d'installation en anglais](docs/INSTALL.md).

## Cadre de Maintenance

Le répertoire `scripts/` contient les outils d'administration système :

- install.sh : Orchestre le déploiement complet du système.
- configure.sh : Gère les paramètres réseau et les identifiants administratifs.
- backup.sh : Sauvegarde la base de données, les images et la configuration du déploiement.
- restore.sh : Vérifie et restaure une sauvegarde compatible.
- info.sh : Affiche l'état des services et les informations d'accès.
- check-resources.sh : Effectue des contrôles locaux du CPU et de la mémoire à
  la demande ou dans un terminal ; ce n'est pas un service de supervision.

Consultez le [guide de configuration en anglais](docs/CONFIGURE.md) pour les détails opérationnels.

## Licence

DisherIo est un logiciel open source publié sous la [GNU Affero General Public License v3.0](LICENSE) (`AGPL-3.0-only`). Il peut être utilisé, copié, modifié et distribué conformément aux conditions de cette licence.

Les versions modifiées et les œuvres basées sur DisherIo doivent conserver la même licence ainsi que les avis de licence et de copyright, indiquer les modifications importantes et mettre à disposition leur code source correspondant complet. Cette obligation s'applique également lorsqu'une version modifiée est proposée aux utilisateurs par l'intermédiaire d'un réseau.

Copyright (C) Ismail Haddouche Rhali.
