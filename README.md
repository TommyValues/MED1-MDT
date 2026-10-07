# Ambulance MDT UK — Multiplayer CAD / MDT

A UK-style ambulance MDT training/roleplay application inspired by rugged in-vehicle MDT layouts. **This is not an operational NHS system and must not be used for real emergency dispatch.**

## What is included

- Ambulance MDT web app with ECA role/login
- Blackpool map and road-routing/sat-nav
- Shared incidents over Socket.IO
- Server-generated job every 60 seconds (one job globally, not one per browser)
- Browser alert tone + UK English speech announcement on new jobs
- Shared unit status and optional browser GPS location updates
- Shared MDT/Control messaging
- Control CAD dashboard at `/control`
- JSON state persistence in `data/state.json`
- Render deployment configuration

## Run locally

Requires Node.js 20+.

```bash
npm install
npm start
```

Open `http://localhost:3000` for the MDT and `http://localhost:3000/control` for Control.

Demo MDT credentials:

- Username: `ECA123`
- Password: `ambulance`
- Role: **Emergency Care Assistant**

## Deploy to Render

1. Push this repository to GitHub.
2. In Render, create a **Web Service** from the repository.
3. Render can use the included `render.yaml`, or use:
   - Build command: `npm install`
   - Start command: `npm start`
4. Open the Render URL.
5. `/` is the MDT and `/control` is the Control CAD.

The backend and frontend are intentionally served by the same Node service, so Socket.IO works without a separate frontend URL.

## GitHub Pages

GitHub Pages can host the static UI, but it cannot run the Node/Socket.IO backend. For the full multiplayer version, deploy the Node service to Render (or another Node host).

## Important

This project uses public mapping/routing services. Respect their usage policies and rate limits. Do not enter real patient-identifiable or operational emergency information.


### Alert and messaging updates
- New jobs use a repeating two-tone siren-style Web Audio alert and a red full-screen flash.
- The Messages screen includes a working composer and simulated Control assistant that replies contextually to the text entered.
- Message delivery is routed to the intended unit/control destination when connected to the multiplayer server.


## Crew sign-on
The MDT now has a full training login/profile form. A crew member can enter a staff ID, password/PIN, name, custom role, ambulance ID/callsign, partner(s), station, vehicle type, shift, radio channel, supervisor and training vehicle registration. The ambulance ID becomes the unit callsign used by the multiplayer CAD. Profiles can be remembered locally on the device.

**Important:** this is a roleplay/training application. Do not enter real NHS credentials, real patient information or other operationally sensitive data.
