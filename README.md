# 📅 Steph Calendar

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/ProGen18/calendar)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Netlify Status](https://api.netlify.com/api/v1/badges/deploy-status)](https://app.netlify.com/)

> Une Progressive Web App moderne et élégante pour consulter votre emploi du temps universitaire français (CELCAT, Hyperplanning, ADE Campus).

![Calendar Preview](https://via.placeholder.com/800x400/6366f1/ffffff?text=Steph+Calendar)

---

## 📋 Table des matières

- [✨ Fonctionnalités](#-fonctionnalités)
- [🚀 Démarrage rapide](#-démarrage-rapide)
- [📦 Installation](#-installation)
- [⚙️ Configuration](#️-configuration)
- [🏃 Lancement](#-lancement)
- [📁 Structure du projet](#-structure-du-projet)
- [🛠️ Technologies](#️-technologies)
- [📝 Utilisation](#-utilisation)
- [🤝 Contribution](#-contribution)
- [📄 Licence](#-licence)
- [👥 Auteurs](#-auteurs)

---

## ✨ Fonctionnalités

### 🎯 Fonctionnalités principales

- **📱 PWA** - Installable sur mobile et desktop, fonctionne hors-ligne
- **🔄 Multi-format ICS** - Compatible CELCAT, Hyperplanning, ADE Campus
- **🎨 Interface moderne** - Design glassmorphism avec animations fluides
- **📅 Vues multiples** - Jour, Agenda, Mois
- **🔍 Recherche** - Trouvez rapidement vos cours
- **⏱️ Countdown** - Compte à rebours vers le prochain cours
- **📊 Statistiques** - Visualisez votre charge de travail

### 🇫🇷 Compatibilité Calendriers Français

| Système | Labels | Groupes | Multi-profs |
|---------|--------|---------|-------------|
| CELCAT | ✅ | ✅ | ✅ |
| Hyperplanning | ✅ | ✅ | ✅ |
| ADE Campus | ✅ | ✅ | ✅ |

### 📲 Fonctionnalités additionnelles

- **🌙 Mode sombre** automatique
- **👆 Gestes tactiles** - Swipe pour naviguer
- **🔔 Filtres** - Masquer matières/types de cours
- **📡 Calendrier secondaire** - Fusionner deux EDT
- **💾 Cache hors-ligne** - Accès sans internet

---

## 🚀 Démarrage rapide

```bash
# Cloner et lancer en une commande
git clone https://github.com/ProGen18/calendar.git && cd calendar && npm install && npm run dev
```

---

## 📦 Installation

### Prérequis

- **Node.js** ≥ 18.0.0
- **npm** ≥ 9.0.0

### Étapes

```bash
# 1. Cloner le repository
git clone https://github.com/ProGen18/calendar.git

# 2. Accéder au dossier
cd calendar

# 3. Installer les dépendances
npm install
```

---

## ⚙️ Configuration

### Variables d'environnement

Aucune variable d'environnement requise ! L'application stocke tout localement.

### Configuration utilisateur

Au premier lancement, l'application demande votre **URL de calendrier ICS** :

1. Connectez-vous à votre ENT universitaire
2. Accédez à CELCAT/Hyperplanning
3. Exportez votre calendrier au format ICS
4. Collez le lien dans l'application

---

## 🏃 Lancement

### Développement

```bash
npm run dev
# Accessible sur http://localhost:5173
```

### Production

```bash
# Build
npm run build

# Preview du build
npm run preview
```

### Déploiement Netlify

Le fichier `netlify.toml` est configuré pour un déploiement automatique :

```bash
# Push sur main pour déployer
git push origin main
```

---

## 📁 Structure du projet

```
calendar/
├── 📄 index.html          # Point d'entrée HTML
├── 📄 package.json        # Dépendances npm
├── 📄 vite.config.js      # Configuration Vite + PWA
├── 📄 netlify.toml        # Configuration Netlify
├── 📁 public/
│   └── 📄 favicon.svg     # Icône de l'app
└── 📁 src/
    ├── 📄 main.jsx        # Point d'entrée React
    ├── 📄 App.jsx         # Composant principal + UI
    ├── 📄 calendarService.js  # Parser ICS multi-format
    └── 📄 index.css       # Styles (glassmorphism)
```

---

## 🛠️ Technologies

### Stack principal

| Technologie | Version | Usage |
|-------------|---------|-------|
| **React** | 18.3 | UI Components |
| **Vite** | 5.4 | Build tool |
| **vite-plugin-pwa** | 0.20 | Service Worker |

### Dépendances

- **date-fns** - Manipulation des dates
- **date-fns-tz** - Gestion des fuseaux horaires
- **node-ical** - Parsing ICS (référence)

### Design

- **CSS Variables** - Theming dynamique
- **Glassmorphism** - Effets de verre modernes
- **Inter** - Police Google Fonts

---

## 📝 Utilisation

### Formats ICS supportés

```
# CELCAT
webcal://celcat.univ-xyz.fr/...

# Hyperplanning
https://planning.xyz.fr/hp2025/Telechargements/ical/...

# ADE Campus
https://ade.univ-xyz.fr/jsp/custom/modules/plannings/...
```

### Paramètres disponibles

| Option | Description |
|--------|-------------|
| URL ICS | Lien vers votre calendrier |
| URL Secondaire | Combiner deux emplois du temps |
| Filtres regex | Masquer cours par motif |
| Masquer dimanches | Cacher les dimanches de la navigation |

---

## 🤝 Contribution

Les contributions sont les bienvenues !

1. **Fork** le projet
2. Créez votre branche (`git checkout -b feature/nouvelle-fonctionnalite`)
3. Committez (`git commit -m 'Ajout nouvelle fonctionnalité'`)
4. Push (`git push origin feature/nouvelle-fonctionnalite`)
5. Ouvrez une **Pull Request**

---

## 📄 Licence

Distribué sous licence **MIT**. Voir [LICENSE](LICENSE) pour plus d'informations.

---

## 👥 Auteurs

**Stéphane Talab** - *Créateur* - [stephane-talab.fr](https://stephane-talab.fr)

---

## 🐛 Problèmes connus

| Problème | Solution |
|----------|----------|
| CORS bloqué | L'app utilise des proxies automatiques |
| Cache obsolète | Rafraîchir via le menu "..." |
| Dates décalées | Vérifiez le fuseau horaire de l'ICS |

---

<p align="center">
  Fait avec ❤️ pour les étudiants et les professeurs français
</p>
