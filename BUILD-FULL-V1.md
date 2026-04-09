# MyLoopio Full V1

## What this version does
- No trial timer
- Full app is locked behind a license key
- License is validated locally with a signed key
- No Supabase setup needed

## Build the Windows full version

```powershell
npm install
npm run pack:win:full
```

The packaged app will be in:

```text
release-full/MyLoopio-win32-x64/
```

## Generate a license key to send to a customer

```powershell
node scripts/generate-license.cjs "customer@email.com" "ORDER-1001"
```

This prints one full license key. Copy that key and send it to the buyer.

## Important
- Keep `private/license-private.pem` private.
- Do not upload the `private` folder anywhere public.
- The packaging scripts already ignore the `private` folder.
