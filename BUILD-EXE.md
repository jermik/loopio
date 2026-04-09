
# Build MyLoopio

## Windows
Trial:
```powershell
npm install
npm audit fix --force
npm run pack:win:trial
```

Full:
```powershell
npm install
npm audit fix --force
npm run pack:win:full
```

## Linux
Trial:
```powershell
npm install
npm audit fix --force
npm run pack:linux:trial
```

Full:
```powershell
npm install
npm audit fix --force
npm run pack:linux:full
```

Output goes into `release/`.

Expected folders:
- `MyLoopio-Trial-win32-x64`
- `MyLoopio-Full-win32-x64`
- `MyLoopio-Trial-linux-x64`
- `MyLoopio-Full-linux-x64`
