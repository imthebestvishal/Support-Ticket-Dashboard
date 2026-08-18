# Start and Stop Guide

This project has two servers:

- Frontend: React/Vite app on `http://localhost:5173`
- Backend: Gmail/AI API on `http://localhost:5000`

Run each server in a separate PowerShell terminal.

## Start Backend

```powershell
cd C:\Users\vkv56\Desktop\Support-Ticket-Dashboard\gmail-backend
npm run start
```

Check that it is working:

```powershell
Invoke-RestMethod http://localhost:5000/
```

Expected result:

```text
status: ok
message: Gmail API backend is running.
```

## Start Frontend

Open a second PowerShell terminal:

```powershell
cd C:\Users\vkv56\Desktop\Support-Ticket-Dashboard
npm run dev
```

Open the app:

```text
http://localhost:5173
```

## Stop Backend

If the backend terminal is still open, press:

```text
Ctrl + C
```

If you need to stop it from another PowerShell terminal:

```powershell
netstat -ano | findstr :5000
```

Find the line with `LISTENING`. The last number is the process ID.

Example:

```text
TCP    0.0.0.0:5000    0.0.0.0:0    LISTENING    27404
```

Stop it:

```powershell
Stop-Process -Id 27404
```

## Stop Frontend

If the frontend terminal is still open, press:

```text
Ctrl + C
```

If you need to stop it from another PowerShell terminal:

```powershell
netstat -ano | findstr :5173
```

Find the `LISTENING` process ID, then stop it:

```powershell
Stop-Process -Id PROCESS_ID
```

Example:

```powershell
Stop-Process -Id 55644
```

## Restart Everything

Stop both servers first, then start them again:

```powershell
cd C:\Users\vkv56\Desktop\Support-Ticket-Dashboard\gmail-backend
npm run start
```

In a second terminal:

```powershell
cd C:\Users\vkv56\Desktop\Support-Ticket-Dashboard
npm run dev
```

## Notes

- If the backend restarts while MongoDB is not running, Gmail login and analyzed emails stored in memory will reset.
- If `Backend` shows offline in the app, restart the backend.
- If `Gmail` shows not connected, click `Connect Gmail` again.
- If Gmail fetching feels stuck, check `GMAIL_FETCH_LIMIT` in `gmail-backend\.env`.
