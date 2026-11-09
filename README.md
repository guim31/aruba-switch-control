# Aruba Switch Control

Interface web pour piloter visuellement un switch **HP / Aruba 2530-48G-PoEP (J9772A)** sous ArubaOS-S : état des 52 ports, consommation PoE+, vue de baie avec panneau de brassage 24 ports et jarretières colorées, notes par port.

Back-end FastAPI qui interroge l'API REST du switch (v4), front-end HTML/JS sans build, métadonnées des ports dans SQLite.

## Fonctionnalités

- État en direct des ports (lien, vitesse, VLAN, PoE), rafraîchi toutes les 5 s
- Vue rack : patch panel + switch, câbles dessinés entre les deux, couleur modifiable au clic
- Fiche par port : nom, couleur et type de câble, port du panneau, catégorie d'équipement, notes
- Actions physiques : activer / désactiver un port, couper ou relancer son PoE
- Recherche et filtres par état ou couleur de câble
- Mode démo sans switch (`DEMO_MODE=true`), avec sa propre base
- Thème clair / sombre

## Installation (Docker)

```bash
git clone https://github.com/guim31/aruba-switch-control.git
cd aruba-switch-control
cp config.example.json config.json   # puis renseigner IP, compte et mot de passe du switch
touch switch_metadata.db             # sinon Docker crée un dossier à la place du fichier
docker compose up -d --build
```

L'interface est sur `http://<hôte>:8085`. La configuration peut aussi être modifiée depuis le bouton « Configuration » de l'interface.

Sans Docker : `pip install -r requirements.txt` puis `python run.py`.

### Côté switch

La lecture passe par l'API REST (`rest-interface`) ; les actions sur les ports et le PoE passent par telnet (port 23), qui doit donc être activé. Elles demandent le mot de passe du compte **manager**.

## Déploiement sur un NAS

`deploy.sh` synchronise le dossier par `rsync` vers un hôte distant puis propose de reconstruire le conteneur. La cible se règle dans `.deploy.env` (copier `.deploy.env.example`). `config.json` et la base ne sont jamais écrasés.

## Sécurité

- `config.json` contient le mot de passe du switch en clair : il est exclu du dépôt, ne le committez pas.
- **L'application n'a pas d'authentification** et peut couper l'alimentation PoE des ports. Ne l'exposez pas sur Internet ; gardez-la sur le réseau local ou derrière un reverse proxy authentifié.

## Licence

MIT
