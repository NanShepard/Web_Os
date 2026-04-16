# Implement Node.js Server and Real Backend Sync

This plan details how we will transform your "simulated" Cloud Web OS into a real, accessible Web Application with genuine cloud syncing.

## User Review Required

> [!IMPORTANT]  
> After this plan is executed, your host PC will act as the "Cloud Server". Anyone on your local network (e.g., via `http://YOUR_LOCAL_IP:8080`) will be able to access the OS. Their instances will connect to *your* PC to store and sync their "Cloud" files. Please review and let me know if this meets your expectations!

## Proposed Changes

### 1. Server Configuration
I will set up a local Node.js Express server that serves the Web OS files so anyone on your network can connect.

#### [NEW] [package.json](file:///d:/Web%Os/package.json)
Initialize a Node.js project containing dependencies for `express` and `cors`.

#### [NEW] [server.js](file:///d:/Web%Os/server.js)
Create the main backend server script. It will:
* Serve the static frontend (HTML/CSS/JS).
* Provide API routes (`/api/cloud/upload`, `/api/cloud/download`, etc.).
* Save the synced cloud files physically to a new `cloud_data/` folder on your hard drive, completely replacing the simulated `localStorage` cloud limits.

### 2. Frontend Adaptation
I will inject network calls into the existing OS, wiring it up to talk to our new server.

#### [MODIFY] [cloud.js](file:///d:/Web%Os/js/cloud.js)
* **Remove**: The simulated `localStorage` cloud.
* **Add**: `uploadFile()`, `downloadFile()`, `deleteCloudFile()`, and `listCloudFiles()` will now use `fetch()` to communicate directly with your Node server's `/api/cloud` endpoints, creating *real* background sync. 
* **Effect**: When you or another PC modifies a file in the Web OS and it "syncs", it actually uploads that file back to the host server.

## Open Questions
* Does port `8080` work for you, or do you have another port in mind?
* The backend will save files collectively in a `cloud_data` folder on your PC. Any connected user will share this "cloud server". Do you need user-based isolation yet, or is a shared global cloud storage fine for this stage?

## Verification Plan
1. Start the server using `npm run start`.
2. Open `http://localhost:8080` in the browser.
3. Test terminal cloud commands (like `cloud ls`) which should now query the real backend server.
4. Verify we are able to sync a locally made file directly to the `cloud_data` directory.
