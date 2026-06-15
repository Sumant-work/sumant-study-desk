# Sumant Study Desk

Zero-cost GitHub Pages study desk with encrypted study material.

## Build

Run from this folder:

```bash
MISSION2026_PASSWORD='your private password' node tools/build-encrypted-site.mjs
```

The password is not written into the website. If you forget it, rebuild the encrypted content with a new password.

## Preview

```bash
python3 -m http.server 4177 --bind 127.0.0.1
```

Open `http://127.0.0.1:4177`.

If password screen does not unlock, do not use `file://` URL.
Use one-click launcher:

`/Users/sumantraj/Documents/Sanitary Inspector Prep/mission2026-study-hub/START-LOCAL.command`

Then open `http://127.0.0.1:4177`.

## Publish On GitHub Pages

1. Create a public GitHub repository.
2. Push this folder after running the build.
3. Enable GitHub Pages from the repository settings.

The visible repository contains only the app, public catalog metadata, and encrypted content blobs. The study files are decrypted in the browser only after entering the password.
