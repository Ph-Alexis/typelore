# Typelore

Typelore is a desktop web prototype for a 1v1 realtime typing PvP game. The
repository contains the M01 foundation and M02 lobby: a React client, a Node and
Express Socket.IO server, and a shared TypeScript protocol and room package.

## Requirements

- Windows with PowerShell
- Node.js 22.12 or newer (verified with 22.14.0)
- npm 10 or newer (verified with 10.9.2)

PowerShell may resolve `npm` to a blocked `npm.ps1` script. Use `npm.cmd` for
the commands below.

## Workspace layout

```text
client/  React, Vite, TypeScript, CSS Modules, Socket.IO client
server/  Node.js, Express, TypeScript, Socket.IO server
shared/  Protocol schemas and typed Socket.IO contracts
```

## Install and run

```powershell
npm.cmd install
npm.cmd run dev
```

The development launcher starts with port `3001` for the server and `5173` for
the client. If either port is busy, it automatically selects the next available
port and prints the final Local and Network URLs in the terminal. Open the
printed Local URL on the development machine or the printed Network URL from
another device on the same network.

Vite proxies `/socket.io` to the local server, so LAN clients use the same
origin as the page and do not require permissive Socket.IO CORS. To find a
Windows LAN address, run:

```powershell
Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.IPAddress -notlike '127.*' } |
  Select-Object IPAddress, InterfaceAlias
```

Windows Firewall may ask for permission the first time Node listens on the
network. Only allow the network profiles you trust.

Do not assume the ports stayed at `3001` and `5173`; use the URLs printed by
`npm.cmd run dev`.

## Environment variables

| Variable | Package | Default | Purpose |
|---|---|---|---|
| `PORT` | server | `3001` | HTTP and Socket.IO port. Use `0` in tests for an ephemeral port. |
| `CLIENT_ORIGIN` | server | `http://localhost:5173` | Allowed local browser origin. |
| `VITE_SERVER_URL` | client | Same origin via Vite proxy | Optional direct Socket.IO server URL override. |

`PORT` and `DEV_CLIENT_PORT` are set automatically by the root development
launcher. They can still be supplied when running an individual workspace for
diagnostics, but normal development should start from the repository root.

Copy a shareable environment template rather than committing `.env` files.

## Quality checks

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test
npm.cmd run build
npm.cmd run check
```

## Try the M02 lobby

1. Open the printed client URL in two tabs, browsers, or devices on the same LAN.
2. In the first tab, choose **Tạo phòng mới**. Share its six-character code.
3. In the second tab, enter the code and choose **Vào phòng**. Both tabs show
   Host and Guest slots. Lowercase input and surrounding whitespace are normalized.
4. Both players choose **Sẵn sàng**. The server synchronizes Ready and announces
   that the match is ready. Battlefield and gameplay begin in M03 and later.
5. Choose **Rời phòng** or close a tab. The survivor returns to waiting, with
   Ready cleared. If the Host leaves, the Guest becomes Host. The room disappears
   after its last player leaves. A third player receives a room-full error.

Codes use `23456789ABCDEFGHJKLMNPQRSTUVWXYZ` (six characters, no hyphens).
Invalid, nonexistent and full-room errors appear inline. Ready requires two
players. It can be cancelled before both are ready. After the start announcement,
leaving or disconnecting cancels that lobby start; a replacement may join and both
players can Ready again. No game loop is running yet.

Rooms are in memory and tied to the current socket connection. Reconnecting
does not reclaim membership; create or join again. Server restart removes all
rooms. Network loss is detected after Socket.IO's transport timeout, not always
immediately. An unconfirmed request times out after five seconds and reconnects
instead of automatically repeating a mutation.

**Sao chép** uses the browser Clipboard API. On LAN HTTP or denied clipboard
permission, select the displayed room code and copy it manually.

The development server is single-process and has no account authentication,
persistent storage or production abuse controls. Room codes are invitations,
not security credentials. Tests cover strict validation, collision handling,
concurrent last-slot joining, Ready/start, leave/disconnect and M01 regression.
