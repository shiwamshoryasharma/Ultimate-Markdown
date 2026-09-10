# Ultimate Markdown

A local Markdown workspace for reading, editing, and exporting documents. Built with React, TypeScript, and Vite. Documents are processed in your browser; there is no application backend or account requirement.

## Run locally

Requires Node.js compatible with Vite 8 (Node 22.12+ recommended).

```sh
npm install
npm run dev
```

Open the local URL printed by Vite.

## Using the app

- **Home:** open Markdown, open a folder, start writing, or choose a Word/PDF/HTML/Excel/Text conversion card. The editable example is separate from your files until you choose to open or export it.
- **Workspace:** edit with CodeMirror and see a live preview. Ctrl+F opens a compact find panel at the top-right; Ctrl+H expands Replace. Enter/Shift+Enter navigate matches and Escape closes the panel.
- **Images:** opening one file does not grant browser access to its neighbouring files. Use **Connect image folder** to grant the containing folder, or **Locate image** to map an individual image. Your text stays open and source files are not modified. Folder opening resolves relative images directly.
- **Converter:** choose the source and output, then use **Design**, **Layout**, and **Options**. Includes six colour themes, 20 locally installed font choices, page/body/heading/link colours, individual heading sizes, paragraph and code sizing, 1–3 columns, margins, orientation, and A4/A3/Letter/Legal paper.
- **Linked manuals:** folder sources follow explicit Next/Continue links in order and stop cycles. New-page separation is the default. Loose files never automatically include other Markdown documents. Broken targets have a replacement selector and an option to end the chain.
- **PDF:** the paginator renders actual pages and counts them before printing. Print uses that same layout. Select Save as PDF, keep scale at 100%, disable browser headers/footers, and enable background graphics to print page colours.
- **DOCX:** editable paragraphs, headings, lists, tables, supported images, hyperlinks, colours, columns, page settings, and Word page-number fields. The browser shows an estimated layout; Word recalculates final pagination. Custom document CSS decoration is not translated to Word.
- **XLSX:** one worksheet per Markdown table. Cell values are text, preserving leading zeros and preventing spreadsheet formulas from executing. No tables means no XLSX export.

Fonts use installed system fonts with a local fallback; the app does not download font families. Linked remote images may be requested by the browser when a document references them. Source filenames are never inserted as visible export headings.

## Supplied documentation

The sibling `documentation/` folder is read-only test content and is not included in this repository. Its owner-approved app-only mapping follows:

```text
01-introduction.md → 02-system-overview.md → 03-factory-home.md → 04-getting-started.md
```

The original files reference missing `03/04/05-factory-brain.md` targets. The mapping activates only when the complete four-file set is present and those targets are absent. It is visible and editable in the converter. Source files stay unchanged.

## Verification

```sh
npm run build
npm run lint
npm test
```

Browser tests use installed Google Chrome through Playwright. The real-document tests look for a sibling `documentation/` folder; set `UM_TEST_CORPUS` to use another location. These two tests skip when the corpus is unavailable. Other tests exercise navigation, find/replace, export XML, sanitization, and a six-page PDF with selectable text.

The browser-only export harness is also available at `/tests/regression.html` on the development server.

## Architecture

Zustand stores manage workspace, documents, and preferences. A shared sanitized HTML AST supplies HTML/TXT/DOCX/XLSX exports. Scoped document CSS stays inside previews. Paged.js runs in a disposable iframe for page layout and PDF printing; DOCX uses the `docx` library, and XLSX uses a small write-only OOXML exporter with JSZip.

Workspace-wide content search, document imports, the command palette, and PWA support remain future work.
