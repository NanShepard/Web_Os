# NexOS — Web OS Build Complete ✅

## Overview

**NexOS** is a fully-featured cloud-powered Web Operating System built entirely in HTML, CSS, and JavaScript — no frameworks, no build step.

## How to Run

1. Open `d:\Web Os\index.html` in your browser
2. Login: **admin** / **nexos**
3. The desktop loads instantly

Or go directly to `d:\Web Os\os.html` for the desktop (skips login).

---

## What Was Built

### 🖥️ Desktop Environment
- Animated **boot sequence** with progress log (kernel → filesystem → cloud)
- **Login screen** with credential validation (admin/nexos, user/password, cloud/cloud123)
- Full **desktop** with 8 icon shortcuts
- Right-click **context menu** on desktop (New Folder, New File, Terminal, Wallpaper, Settings)
- 5 selectable **wallpapers**

### 📋 Taskbar
- **Start Menu** with categorized app grid + search
- Live **system clock** (time + date)
- **Cloud sync status** indicator (Synced/Syncing/Pending/Error)
- WiFi, Volume, and profile tray items
- **Active window** highlights with bottom indicator bar
- Power/Restart buttons in Start Menu

### 🪟 Window Manager
- Drag windows by title bar
- **Resize** from all 8 handles (corners + edges)
- **Minimize** → taskbar (restores on click)
- **Maximize** toggle (double-click title bar or ⤢ button)
- **Focus** management (click to bring to front)
- Smooth **open/close animations**

### 📁 Virtual Filesystem (IndexedDB)
- Persistent storage that survives browser refresh
- Hierarchical folders: `/home`, `/documents`, `/pictures`, `/downloads`, `/cloud`
- Pre-populated with sample files (`readme.txt`, `notes.md`, `config.json`)
- Full CRUD: create, read, write, rename, delete

### ☁️ Cloud Computing Features
| Feature | Description |
|---------|-------------|
| **Sync Engine** | Auto-syncs files to "cloud" every 3 seconds |
| **5 Cloud Regions** | 🇺🇸 US, 🇮🇪 EU, 🇸🇬 Singapore, 🇯🇵 Tokyo, 🇧🇷 São Paulo |
| **4 Cloud VMs** | nexos-vm-01, nexos-vm-02, nexos-db-01, nexos-store |
| **Cloud Shell** | `cloud ls`, `cloud df`, `cloud sync`, `cloud servers`, `cloud ping`, `cloud logs` |
| **Conflict-free sync** | Queue-based sync with per-file status tracking |
| **Sync Logs** | Full timestamped log of all upload/download events |
| **Storage meter** | Visual 0–5 GB usage bar |
| **Region selector** | Simulated latency per region |

### 🧰 8 Built-in Applications

| App | Features |
|-----|---------|
| **📁 File Explorer** | Grid/list view, breadcrumbs, sidebar, CRUD, drag context menus |
| **💻 Terminal** | 25+ commands, cloud shell, history, tab-complete, neofetch, SSH sim |
| **📝 Text Editor** | Line numbers, undo/redo, keyboard shortcuts, save-as dialog, language badges |
| **🌐 Browser** | URL bar, quick links, back/forward, bookmarks, iframe loading |
| **🔢 Calculator** | Full keyboard support, expression display, backspace, sign, percent |
| **☁️ Cloud Drive** | My Drive/Shared/Recent/Backup tabs, sync status per file, upload, delete |
| **📊 Task Manager** | Processes list, performance graphs, cloud dashboard, network stats |
| **⚙️ Settings** | System, Personalization, Network, Cloud, Sound, Account, About pages |

---

## File Structure

```
d:\Web Os\
├── index.html         ← Boot + Login screen
├── os.html            ← Main desktop
├── css/
│   ├── reset.css      ← Design tokens & CSS variables
│   ├── animations.css ← 30+ keyframe animations
│   ├── boot.css       ← Boot/login styles
│   ├── desktop.css    ← Desktop, taskbar, start menu
│   ├── window.css     ← Window chrome styles
│   └── apps.css       ← All app content styles
└── js/
    ├── kernel.js         ← Event bus, app registry, notifications, dialogs
    ├── window-manager.js ← Drag, resize, min/max/close, z-index
    ├── filesystem.js     ← IndexedDB virtual filesystem
    ├── cloud.js          ← Cloud sync engine, regions, VMs, shell
    ├── taskbar.js        ← Taskbar, start menu, clock, tray
    ├── desktop.js        ← Icons, wallpapers, context menus
    └── apps/
        ├── file-explorer.js
        ├── terminal.js
        ├── text-editor.js
        ├── browser.js
        ├── calculator.js
        ├── settings.js
        ├── cloud-drive.js
        └── task-manager.js
```

## Terminal Commands

```bash
ls, cd, pwd, mkdir, touch, cat, echo, rm, cp, mv
nano / vim / edit   → opens Text Editor
top / htop          → opens Task Manager
df                  → disk + cloud usage
ping <host>         → simulated ping
ssh <host>          → simulated SSH to cloud VM
uname, whoami, date, uptime, ps
neofetch            → ASCII art system info
clear               → clear terminal
cloud help          → all cloud subcommands
```

---

## Recordings

![NexOS Boot & Login](file:///C:/Users/ACER/.gemini/antigravity/brain/887a1fdb-e0a4-44a6-ada9-69a9f26ebd4b/nexos_boot_test_1776128909910.webp)
![NexOS Desktop & Apps](file:///C:/Users/ACER/.gemini/antigravity/brain/887a1fdb-e0a4-44a6-ada9-69a9f26ebd4b/nexos_screenshot_verify_1776129309652.webp)
