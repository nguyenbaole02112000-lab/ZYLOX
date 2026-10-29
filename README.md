# Fantasy Game

## Local testing

Install Node.js 22.13 or newer. In the game folder, run:

```sh
node account-server.js
```

Open `http://[::1]:8080/` in a browser. Keep the server running while playing. Opening the HTML file directly or using static GitHub hosting cannot provide accounts or cross-browser progress. GitHub Pages supports a separate offline guest whose progress is saved only in the current browser; it is not the IPv6 guest or a server account.

On the current Windows computer, if Node.js is not on your PATH, you can run the bundled runtime from PowerShell:

```powershell
& 'C:\Users\ACER\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' 'D:\webcode\my game\account-server.js'
```

Accounts and progress are stored in the `.fantasy-game` directory in your user home, outside the website. Passwords are hashed; changing a password requires the current password. Back up this directory to preserve your accounts.

Guest names use a SHA-256 hash of the IPv6 address seen by the server. On this local test server that address is normally `::1`, so local guest browsers share the same guest account. An IPv6 address can change or be shared, and is not a secure credential. IPv4 and proxy connections cannot identify guests reliably with this method.

The local server is a test implementation, not a hosted service or independently audited production authentication system. To play from different devices over the internet, deploy an appropriate secure backend and use HTTPS. Candy and scores are currently reported by the client and are not cheat-proof.
