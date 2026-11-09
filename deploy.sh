#!/bin/bash

# --- Configuration Aruba Switch Control ---
# Valeurs surchargées par .deploy.env (non versionné, voir .deploy.env.example)
[ -f "$(dirname "$0")/.deploy.env" ] && . "$(dirname "$0")/.deploy.env"
NAS_USER="${NAS_USER:-root}"
NAS_IP="${NAS_IP:-192.168.1.10}"
NAS_PATH="${NAS_PATH:-/mnt/user/appdata/aruba-switch-control/}"

# Couleurs pour le terminal
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Options SSH pour multiplexage (pour ne demander le mot de passe qu'une seule fois)
SSH_OPTS="-o ControlMaster=auto -o ControlPath=/tmp/ssh-%r@%h:%p -o ControlPersist=600"

echo -e "${BLUE}🚀 Préparation de la synchronisation de Aruba Switch Control vers le NAS...${NC}"

# S'assurer que le dossier distant existe
ssh $SSH_OPTS "$NAS_USER@$NAS_IP" "mkdir -p $NAS_PATH"

echo -e "${YELLOW}📦 Transfert des fichiers en cours vers ${NAS_IP}...${NC}"

# Commande rsync optimisée pour Unraid
# --chown=99:100 : force l'appartenance à nobody:users (standard Unraid)
rsync -avz --delete --chown=99:100 \
  --exclude '.git' \
  --exclude 'venv' \
  --exclude '.venv' \
  --exclude '.agents' \
  --exclude '__pycache__' \
  --exclude '.DS_Store' \
  --exclude 'config.json' \
  --exclude '.deploy.env' \
  --exclude 'switch_metadata.db' \
  -e "ssh $SSH_OPTS" ./ "$NAS_USER@$NAS_IP:$NAS_PATH"

if [ $? -eq 0 ]; then
    echo -e "${YELLOW}🔧 Correction des permissions sur le dossier de l'application sur le NAS...${NC}"
    # S'assurer que les fichiers et volumes sont accessibles avec les bons droits nobody:users (99:100)
    ssh $SSH_OPTS "$NAS_USER@$NAS_IP" "chown -R 99:100 $NAS_PATH && chmod -R 777 $NAS_PATH"
    
    echo -e "${GREEN}✅ Synchronisation terminée avec succès !${NC}"
    
    echo -e "${BLUE}🔄 Voulez-vous reconstruire et redémarrer le conteneur sur le NAS ?${NC}"
    read -p "(y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}🐳 Exécution de docker compose sur le NAS...${NC}"
        # Tente d'utiliser "docker compose" d'abord, sinon retombe sur "docker-compose"
        if ssh $SSH_OPTS "$NAS_USER@$NAS_IP" "cd $NAS_PATH && (docker compose up -d --build || docker-compose up -d --build)"; then
            echo -e "${GREEN}✨ Aruba Switch Control mis à jour et redémarré sur le NAS !${NC}"
            echo -e "${BLUE}🌐 Application accessible sur : http://$NAS_IP:8085${NC}"
        else
            echo -e "${RED}❌ Erreur lors du build ou du redémarrage sur le NAS. Vérifiez les logs ci-dessus.${NC}"
            exit 1
        fi
    else
        echo -e "${YELLOW}ℹ️  Mise à jour des fichiers terminée, mais le conteneur n'a pas été redémarré.${NC}"
        echo -e "${BLUE}🌐 L'application sera accessible sur : http://$NAS_IP:8085${NC}"
    fi
else
    echo -e "${RED}❌ Erreur lors de la synchronisation. Vérifiez votre connexion SSH.${NC}"
    exit 1
fi
