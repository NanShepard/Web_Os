# NexOS Real Cloud Backend 🌐

Your local Web OS now features a genuine **local Node.js Express server**, allowing anyone on your network to instantly connect to and synchronize files using your host PC as the "Cloud"!

## What was built

1. **Express Backend**: 
   - A newly added `server.js` serves your Web OS on port `8080`.
   - Your PC is now acting as the central nexus for all connected instances.
   - We implemented full CRUD API endpoints (`/api/cloud/upload`, `/api/cloud/download`, `/api/cloud/files`, `/api/cloud/delete`).

2. **Genuine Cloud Sink**: 
   - Before, the "cloud" was just simulated within standard local browser storage (`IndexedDB` & `localStorage`).
   - Now, we overhauled `js/cloud.js` with Javascript `fetch()` requests! When you login to your OS and a local change happens, it natively fires a `fetch` request uploading that file silently to the real `cloud_data/` directory located physically on your hard drive! 

## How to use it

### Start the OS Node Server
The server is currently running in your background! You can close and start it again at any point in the terminal using:
```bash
npm start
``` 

### Connect from Another PC
1. Identify your host PC's Local Network IP Address (e.g., `192.168.1.100`).
2. Pick up your phone, an iPad, or another computer on the same network.
3. Open their browser and go to `http://YOUR_LOCAL_IP:8080`.
4. **Log in** to your environment!

> [!TIP]
> Any files created in NexOS that say "Synced" on your other devices will literally appear securely tucked into the `d:\Web Os\cloud_data` folder on your host PC! 
