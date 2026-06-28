# 🌿 WellNest

A calm, **local-first** health & routine tracker for daily healing — built as an
installable phone app (PWA) that runs entirely on your own Windows PC.

- **Private by design.** All data lives in a single file on your computer. No
  accounts, no cloud, no analytics, no third‑party calls — ever.
- **Fast, tap‑based logging.** A whole day takes under a minute. No typing needed.
- **Turns logging into insight.** Streaks, a calendar heatmap, symptom trends,
  and gentle “what seems to help?” correlations.
- **Works on the phone, even offline.** Entries made away from home are saved on
  the phone and sync back to the PC automatically when you’re home again.

> WellNest is a personal tracking tool, not a medical device. Any patterns it
> shows are **observational, not medical advice.**

---

## Table of contents

1. [What you need](#1-what-you-need)
2. [Install Node.js](#2-install-nodejs)
3. [Start WellNest (one double‑click)](#3-start-wellnest-one-double-click)
4. [Open & install it on the phone](#4-open--install-it-on-the-phone)
5. [Finding your PC’s Wi‑Fi address](#5-finding-your-pcs-wi-fi-address)
6. [How offline sync works](#6-how-offline-sync-works)
7. [How reminders work (and their limits)](#7-how-reminders-work-and-their-limits)
8. [Backing up & restoring your data](#8-backing-up--restoring-your-data)
9. [Development mode](#9-development-mode)
10. [Troubleshooting](#10-troubleshooting)
11. [What’s inside / tech notes](#11-whats-inside--tech-notes)

---

## 1. What you need

- A **Windows PC** that stays on while the phone is being used at home.
- The **phone and PC on the same Wi‑Fi** network.
- About 10 minutes for the one‑time setup below.

## 2. Install Node.js

WellNest runs on Node.js (free).

1. Go to **https://nodejs.org/** and download the **LTS** version for Windows.
2. Run the installer and click through with the default options.
3. That’s it — you won’t need to touch Node directly.

## 3. Start WellNest (one double‑click)

1. Put the `wellnest` folder somewhere easy, e.g. `C:\wellnest`.
2. Double‑click **`start.bat`**.
   - The **first** run installs everything and builds the app — this can take a
     couple of minutes. Later runs start in a few seconds.
   - A black window opens and stays open — that’s the WellNest server. **Leave it
     open** while using the app. Closing it stops WellNest.
3. A browser opens at **http://localhost:3001** — WellNest is running on the PC. 🎉
4. If Windows asks **“Allow Node.js to communicate on networks?”**, tick
   **Private networks** and click **Allow**. (This lets the phone reach it.)

To rebuild after any code changes, double‑click **`build.bat`**, then `start.bat`.

## 4. Open & install it on the phone

With `start.bat` running on the PC and both devices on the same Wi‑Fi:

1. Find your PC’s Wi‑Fi address — see [section 5](#5-finding-your-pcs-wi-fi-address).
   It looks like `192.168.1.42`.
2. On the phone, open the browser and go to **`http://YOUR-PC-IP:3001`**
   (e.g. `http://192.168.1.42:3001`). WellNest appears.
3. Add it to the home screen so it opens like a real app, full‑screen:
   - **iPhone/iPad (Safari):** tap the **Share** button → **Add to Home Screen**.
   - **Android (Chrome):** tap the **⋮** menu → **Install app** / **Add to Home
     screen** (WellNest also shows a little “Install” banner you can tap).
4. Open WellNest from the new home‑screen icon. Done — it now works like an app.

> Tip: bookmark `http://YOUR-PC-IP:3001`. Home Wi‑Fi addresses can change after a
> router restart; if the app can’t connect later, re‑check the IP (section 5).
> To keep it stable, you can set a *reserved/static IP* for the PC in your
> router settings (optional).

## 5. Finding your PC’s Wi‑Fi address

1. Press **Windows key**, type **cmd**, open **Command Prompt**.
2. Type **`ipconfig`** and press Enter.
3. Under your Wi‑Fi adapter, find **IPv4 Address** — e.g. `192.168.1.42`.

The WellNest server window also prints the phone address(es) when it starts —
look for the lines under **“On the phone (same Wi‑Fi)”**.

## 6. How offline sync works

WellNest is **offline‑first**, so logging never fails — even with no signal.

- Every tap is saved on the phone **instantly** (in the browser’s local storage)
  and shown right away. There is no “Save” button.
- If the PC is reachable, changes sync to it within a second.
- If you’re **away from home** (PC unreachable), changes are queued on the phone.
  A small status pill shows **“Offline · N to sync”**.
- When you get home (PC reachable again), the queue **syncs automatically** and
  the pill returns to **“Saved.”** You can also tap the pill to sync now.
- The app shell is cached, so WellNest still **opens and works offline**.

Because everything lives on the PC, the phone is just a convenient window into it.
Two phones can be used; whoever syncs writes to the same PC database.

## 7. How reminders work (and their limits)

You can set an optional reminder time on any activity:
**Settings → Manage routine → (edit an activity) → Reminder**, then enable
notifications in **Settings → Reminders**.

**Please read this about reliability:** web‑app notifications are **best‑effort**.
They are most dependable when WellNest has been **opened recently** and is running
in the background. Phones (especially iPhones, and Androids with aggressive battery
saving) may delay or skip background notifications. Treat reminders as a *gentle
nudge*, not a guarantee. For critical reminders, also use your phone’s built‑in
Clock/Reminders app.

## 8. Backing up & restoring your data

Your data is one file on the PC:
`backend\data\wellnest.db`

**Recommended: back up about once a week.**

- **Backup (download):** Settings → **Backup & export** → **Full backup (JSON)**.
  Save the file somewhere safe (USB stick, another folder, etc.). You can also
  export **CSV** files (daily summary, routine log, symptom log) for spreadsheets.
- **Restore:** Settings → **Backup & export** → **Import a JSON backup**, choose a
  previously saved file. *Importing replaces all current data* with the backup.
- **Doctor report:** Settings → **Backup & export** → **Doctor report** opens a
  clean, printable summary for a date range — use your browser’s Print → “Save as
  PDF” for appointments.
- **Copy the file directly:** you can also just copy `wellnest.db` to back it up,
  and copy it back to restore (do this while WellNest is stopped).

## 9. Development mode

For editing the code with hot reload:

- Double‑click **`dev.bat`** (or run `npm run dev` in the project root).
- Frontend (Vite): **http://localhost:5173** · Backend API: **http://localhost:3001**
- On the phone in dev mode use **`http://YOUR-PC-IP:5173`**.

For daily use, prefer **`start.bat`** — it serves the optimized, installable PWA
on a single address (`:3001`).

Useful scripts (run from the project root):

```
npm run install:all   # install root + backend + frontend deps
npm run dev           # backend + Vite dev servers together
npm run build         # build the optimized PWA (frontend/dist)
npm start             # run the production server (serves the built app + API)
npm run seed          # (re)seed the starter routine if the DB is empty
```

## 10. Troubleshooting

**The phone can’t reach WellNest.**
- Confirm `start.bat` is running on the PC (black window open).
- Confirm both devices are on the **same Wi‑Fi**.
- Re‑check the PC’s IP (section 5) — it may have changed.
- Windows Firewall: allow Node.js on **Private networks** (re‑run `start.bat`, or
  Windows Security → Firewall → Allow an app → enable Node.js for Private).

**`start.bat` shows an error about `better-sqlite3` / build tools.**
- It normally installs a prebuilt binary with no tools needed. If it fails on your
  setup, install the Microsoft “**Build Tools for Visual Studio**” (C++ workload),
  then run `build.bat` again. Reinstalling Node LTS usually also fixes this.

**“Port 3001 is already in use.”**
- Another copy is already running. Close the other WellNest window, or set a
  different port by creating an environment variable `PORT` before launching.

**Insights/History say they need the home server.**
- Those views read from the PC. Open WellNest while on the same Wi‑Fi as the PC.
  (Today still works fully offline.)

**Nothing is lost on restart/reboot** — data is written to `wellnest.db` on disk.

## 11. What’s inside / tech notes

- **Frontend:** React + Vite, Tailwind CSS, Recharts, installable PWA
  (service worker + manifest), IndexedDB offline queue. No web fonts or external
  requests.
- **Backend:** Node.js + Express, **SQLite via better‑sqlite3** persisted to
  `backend/data/wellnest.db` (WAL mode). Listens on `0.0.0.0` so the phone can
  reach it; serves the built app and the API on one port in production.
- **Privacy:** there are **no** outbound network calls, analytics, or telemetry.
  Everything stays on your machine.

```
wellnest/
├─ start.bat / build.bat / dev.bat   # Windows launchers
├─ backend/        # Express + SQLite (data model, API, seed)
│  └─ data/        # wellnest.db lives here (created on first run, gitignored)
└─ frontend/       # React PWA (Today, History, Insights, Settings, Report)
```

The starter routine (activities, symptoms, weekly therapies) is seeded
automatically the first time the server runs. Everything is editable in
**Settings**, so the app adapts as the routine changes.

---

Made with care. Be as kind to yourself as you would be to a dear friend. 💚
