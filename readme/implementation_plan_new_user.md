# Implement Centralized Users

Currently, user accounts in NexOS are saved to your browser's private `localStorage`. This means if you create a user on one PC and try to log in from another PC (or a private tab), the new PC won't know the user exists, resulting in an "invalid password" error.

To fix this and make the OS truly accessible across your network, we need to move User Accounts to the backend server, just like we did with cloud files!

## User Review Required

> [!WARNING]  
> After this change, the `admin / nexos` default account will be controlled by the server. Any new accounts created via the Settings app will be saved to a `users.json` file on your host PC, making them instantly valid on any other tablet or computer that connects to the OS! 

## Proposed Changes

### 1. Server Configuration
Update the Express backend to manage user credentials.

#### [MODIFY] [server.js](file:///d:/Web%20Os/server.js)
* Add a `users.json` file in your `cloud_data` folder to centrally store accounts and roles.
* Create API endpoints: `/api/users/login`, `/api/users/create`, `/api/users/list`, `/api/users/delete`, and `/api/users/password`.

### 2. Login Flow Modification
Update the frontend to authenticate against the new server.

#### [MODIFY] [index.html](file:///d:/Web%20Os/index.html)
* Replace the `localStorage` user check with a `fetch()` call to `/api/users/login`. 

#### [MODIFY] [settings.js](file:///d:/Web%20Os/js/apps/settings.js)
* Refactor `UserManager` to make `fetch()` calls to the server when you add, delete, or list users, instead of reading and writing to `localStorage`.

## Open Questions
* Are you okay with saving user credentials in a local `users.json` file on your host machine? (Note: since this is just a local network OS, I will store them plainly so you can easily edit them if you get locked out. Let me know if you want them hashed or encrypted instead).

## Verification Plan
1. Restart the server (`npm start`).
2. Log in with the default admin credentials.
3. Open the "Settings" app in the OS -> "Account", and add a new user.
4. Refresh the OS or connect from another device and try logging in with the new user credentials.
