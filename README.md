# CELCAT Calendar

**Calendrier universitaire CELCAT optimisé.**

Une application web progressive (PWA) moderne conçue pour visualiser et gérer facilement votre emploi du temps universitaire issu des flux CELCAT.

## ✨ Fonctionnalités

- **Lecture ICS native** : Analyse et affichage optimisés des fichiers `.ics` CELCAT.
- **PWA Ready** : Installable sur mobile et bureau, fonctionne hors ligne.
- **Filtrage avancé** : Filtrez par matière, type de cours (CM, TD, TP), ou groupe.
- **Code couleur intelligent** : Attribution automatique de couleurs pour chaque matière.
- **Support Proxy CORS** : Mécanismes de secours intégrés pour contourner les restrictions CORS (via AllOrigins ou CorsProxy).

## 📋 Prérequis

Avant de commencer, assurez-vous d'avoir installé :
- **Node.js** (v18.0.0 ou supérieur)
- **npm** (v9.0.0 ou supérieur)

Vous pouvez vérifier vos versions avec :
```bash
node -v
npm -v
```

## 🚀 Installation

Clonez le projet et installez les dépendances :

```bash
# Aller dans le dossier du projet
cd celcat-calendar

# Installer les dépendances
npm install
```

## ⚙️ Configuration


### Proxy API
Si vous utilisez un chemin relatif comme `/api`, la configuration du proxy se trouve dans `vite.config.js` :
```javascript
server: {
    proxy: {
        '/api': {
            target: 'https://extra.u-picardie.fr',
            changeOrigin: true,
            // ...
        }
    }
}
```

## 💻 Commandes

### Développement
Pour lancer le serveur de développement local (avec hot-reload) :
```bash
npm run dev
```
L'application sera accessible sur `http://localhost:5173`.

### Production
Pour construire la version optimisée pour la production :
```bash
npm run build
```
Prévisualiser la version de production localement :
```bash
npm run preview
```

## 📂 Structure du Projet

```
web/
├── public/              # Fichiers statiques (icons, manifest, etc.)
├── src/                 # Code source de l'application
│   ├── App.jsx          # Composant principal
│   ├── calendarService.js # Logique de parsing et gestion des ICS
│   ├── main.jsx         # Point d'entrée React
│   └── index.css        # Styles globaux
├── index.html           # Template HTML principal
├── package.json         # Dépendances et scripts
└── vite.config.js       # Configuration Vite (PWA, Proxy)
```

## 🛠️ Technologies

- **[React](https://react.dev/)** : Bibliothèque UI.
- **[Vite](https://vitejs.dev/)** : Bundler rapide et outil de build.
- **[Vite PWA](https://vite-pwa-org.netlify.app/)** : Support Progressive Web App.
- **[node-ical](https://github.com/jens-maus/node-ical)** : Parsing des fichiers iCalendar.
- **[date-fns](https://date-fns.org/)** : Manipulation de dates.

## 🤝 Contribuer

Les contributions sont les bienvenues !
1. Forkez le projet
2. Créez votre branche de fonctionnalité (`git checkout -b feature/AmazingFeature`)
3. Committez vos changements (`git commit -m 'Add some AmazingFeature'`)
4. Pushez sur la branche (`git push origin feature/AmazingFeature`)
5. Ouvrez une Pull Request
