# Ultimate Markdown URL Import companion

This Chrome/Edge Manifest V3 extension retrieves public HTML and raster images
for the existing Ultimate Markdown browser app. No backend, account, cookies,
browser history, document uploads, or external conversion service is used.

## Install once

1. Download `ultimate-markdown-extension.zip` from the app's Import screen.
2. Extract it into a permanent folder. Keep this folder after installation.
3. Open `chrome://extensions` (Chrome) or `edge://extensions` (Edge).
4. Enable **Developer mode**, select **Load unpacked**, and choose the extracted
   folder containing `manifest.json`.
5. Save unsaved documents, then reload Ultimate Markdown.

This is an unpacked distribution, not a Chrome Web Store listing. Installation
requires the user's actions; the website cannot silently install an extension.
To update, extract the replacement package to the same folder and click Reload
on the extension card, then reload the app after saving.

## Each visit

Paste a URL or select **Enable URL imports**. An extension-owned window asks
**Allow for this visit**. First use also requests Chrome's optional HTTP/HTTPS
website access. That grants downloads for any public website during the visit.
Sites may still deny automated access, require login, or return no readable
HTML; this does not bypass site authentication or execute website scripts.

Refresh, navigate away, close the app tab, or use **End URL session** to reset
approval. Internal app navigation retains the visit. Each browser tab needs
separate approval. Returning through browser history requires approval again.
Browser-level host permissions remain installed until revoked in extension
settings; extension session approval is checked separately for every download.

Supported app origins:

- `https://ultimate-markdown.web.app`
- `https://ultimate-markdown.firebaseapp.com`
- Local development: `http://localhost` or `http://127.0.0.1` on ports 5173,
  4173, 5174 or 4174.

Other domains (including arbitrary Netlify deployments) cannot use this package
without explicitly updating both the content-script matches and app allowlist.

## Boundaries

- Only top-level app documents can connect. Approval happens in extension UI,
  never in a message from a webpage. Sessions are bound to Chrome document IDs.
- HTML is streamed in acknowledged chunks up to 200 MiB. Optional images are
  limited to 2 MiB each; the app retains its existing session image budget.
- Credentials are omitted, HTML is never executed, and local/IP-address URLs,
  credentials in URLs and nonstandard ports are rejected. DNS resolution and
  redirect transport are performed by Chrome, not a server-side DNS-pinning
  proxy. This is intended for public websites, not private network resources.
- Only visit approval metadata uses `chrome.storage.session`; downloaded data
  stays in memory. No approval or content is saved in persistent local storage.
- Local HTML/DOCX imports and the editor/exporters do not require the extension.

The repository's non-commercial LICENSE also applies to this extension.
