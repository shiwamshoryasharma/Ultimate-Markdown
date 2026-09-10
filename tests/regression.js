import { collectDocuments, buildExportModel, parseDocument, serializeTree, plainText } from '/src/services/conversion/model'
import { standaloneHtml } from '/src/services/conversion/html'
import { exportDocx } from '/src/services/conversion/docx'
import { exportXlsx, extractTables } from '/src/services/conversion/xlsx'
import { DEFAULT_CONVERSION } from '/src/types/conversion'
import { resolveDocumentPath } from '/src/services/markdown/documentLinks'
import { scopeDocumentCss, safeDeclarations } from '/src/services/markdown/documentStyles'
import JSZip from 'jszip'

const results = document.getElementById('results')
let failed = 0
function check(name, condition) { const li = document.createElement('li'); li.textContent = (condition ? 'PASS ' : 'FAIL ') + name; li.style.color = condition ? 'green' : 'red'; results.append(li); if (!condition) failed++ }
try {
const entries = [
 ['intro.md', '# Introduction\n\nActual **important** content. [Website](https://example.com) [Email](mailto:test@example.com)\n\n[Next Page](./docs/install.markdown)\n\n| Product | Price |\n| --- | --- |\n| Widget | 0012 |\n| =SUM(A1) | 100 |'],
 ['docs/install.markdown', '# Installation\n\n[Previous](../intro.md)\n\n[Next Page](../usage.md)\n\n<div class="warning-box" onclick="alert(1)" style="color:red;position:fixed">Safe content</div>\n\n<style>.warning-box { padding: 16px; border-radius:12px; background-color:rgb(220,230,255) } body { color: rgb(30,40,50) } h1, body .target { color: rgb(20,40,90) } @import url(https://invalid.test/x); .bad { background:url(https://invalid.test/x);position:fixed;z-index:9999 }</style>\n\n<script>alert("unsafe")</script>\n\n[Bad](javascript:alert(1))'],
 ['usage.md', '# Usage\n\n[Next Page](intro.md)\n\n[Broken](missing.md)\n\n[Local](#usage)'],
]
const nodes = entries.map(([path, text]) => ({ kind:'file',id:path,path,name:path.split('/').pop(),extension:path.split('.').pop(),origin:'file',file:new File([text],path.split('/').pop()) }))
const workspace = { sourceKind:'files',folderAccess:true,rootName:'Regression',tree:nodes,filesById:new Map(nodes.map(n=>[n.id,n])),assetFiles:new Map() }
const open = new Map()
const chain = await collectDocuments(workspace, open, 'intro.md', 'linked-chain')
check('linked order follows Next; cycle terminates', chain.documents.map(d=>d.path).join(',') === 'intro.md,docs/install.markdown,usage.md')
const s = structuredClone(DEFAULT_CONVERSION)
const model = await buildExportModel(chain.documents,s,workspace,chain.warnings)
const html = standaloneHtml(model,s)
const body = new DOMParser().parseFromString(html,'text/html').body.textContent
check('content begins with actual heading, no filename title', body.trim().startsWith('Introduction') && !body.includes('intro.md'))
check('included navigation text removed', !body.includes('Next Page') && !body.includes('Previous'))
check('external website and mail links preserved', html.includes('https://example.com') && html.includes('mailto:test@example.com'))
check('broken link retained with warning', html.includes('missing.md') && model.warnings.some(w=>w.includes('missing.md')))
check('scripts, handlers and JS URLs removed', !html.includes('<script') && !html.includes('onclick') && !html.includes('javascript:'))
check('safe HTML classes and CSS retained', html.includes('warning-box') && html.includes('padding-top:16px') && !html.includes('position:fixed') && !html.includes('invalid.test'))
check('inline CSS restricted', safeDeclarations('color:red;position:fixed;background:url(https://x);--evil:red').includes('color:red') && !safeDeclarations('position:fixed').length)
check('local parent path normalized', resolveDocumentPath('docs/setup/intro.md','../usage.md') === 'docs/usage.md')
check('workspace traversal and bad encoding rejected', resolveDocumentPath('intro.md','../outside.md') === null && resolveDocumentPath('intro.md','%ZZ.md') === null)
const fenced = parseDocument('\x60\x60\x60html\n<style>body{color:red}</style>\n\x60\x60\x60','fenced')
check('style inside code fence stays code', fenced.css === '' && new DOMParser().parseFromString(serializeTree(fenced.tree),'text/html').querySelector('pre')?.textContent.includes('<style>'))
const navSource = [{id:'navigation.md',path:'navigation.md',content:'# Guide\n\nActual body.\n\n## Document Navigation\n\n> **Previous:** [Introduction](./intro.md) || **Next:** [Factory Brain](./03-factory-brain.md)\n\n[Ordinary reference](other-missing.md)\n\n[Website](https://example.com)'}]
const navModel = await buildExportModel([...navSource, chain.documents[0]],s,workspace)
const navText = plainText(navModel.documents[0].tree)
check('entire navigation heading/row removed even with missing next target',!navText.includes('Document Navigation') && !navText.includes('Previous') && !navText.includes('Factory Brain'))
check('ordinary missing reference retained; missing navigation warned',navText.includes('Ordinary reference') && navModel.warnings.some(w=>w.includes('03-factory-brain.md')))
const kept = await buildExportModel(chain.documents,{...s,internalMarkdownLinks:'keep'},workspace)
check('kept included links become anchors', serializeTree(kept.documents[0].tree).includes('href="#export-doc-1"'))
check('same-document heading anchor namespaced', serializeTree(model.documents[2].tree).includes('href="#export-doc-2-usage"'))
check('TXT contains real content and external URLs', plainText(model.documents[0].tree).includes('Actual important content') && plainText(model.documents[0].tree).includes('https://example.com') && !plainText(model.documents[0].tree).includes('Next Page'))
const selected = await collectDocuments(workspace,open,'intro.md','selected',['usage.md','intro.md'])
check('selected document order preserved',selected.documents[0].path === 'usage.md')
const node = nodes[0]
open.set(node.id,{id:node.id,node,content:'# Unsaved buffer',originalContent:'old',loadedAt:Date.now(),isNew:false})
check('unsaved editor buffer wins', (await collectDocuments(workspace,open,node.id,'current')).documents[0].content === '# Unsaved buffer')
check('XLSX table extraction',extractTables(model).length === 1)
const sheetZip = await JSZip.loadAsync(await (await exportXlsx(model)).arrayBuffer())
const sheetXml = await sheetZip.file('xl/worksheets/sheet1.xml').async('string')
check('XLSX preserves strings/leading zeros without formulas or filename rows', sheetXml.includes('0012') && sheetXml.includes('=SUM(A1)') && !sheetXml.includes('<f>') && !sheetXml.includes('intro.md'))
const docxZip = await JSZip.loadAsync(await (await exportDocx(model,s)).arrayBuffer())
const wordXml = await docxZip.file('word/document.xml').async('string')
check('DOCX real paragraphs and tables, no filename header',wordXml.includes('Introduction') && wordXml.includes('<w:tbl>') && !wordXml.includes('intro.md') && !Object.keys(docxZip.files).some(f=>/word\/header\d/.test(f)))
const paged = {...s,orientation:'landscape',linkedDocumentSeparation:'new-page',fontFamily:'Georgia',bodyFontSize:14,footer:{...s.footer,enabled:true,pageNumbers:true,pageNumberFormat:'page-total'}}
const pagedZip = await JSZip.loadAsync(await (await exportDocx(model,paged)).arrayBuffer())
const footerFile = Object.keys(pagedZip.files).find(f=>/word\/footer\d+\.xml$/.test(f))
const footer = await pagedZip.file(footerFile).async('string')
check('DOCX uses real PAGE and NUMPAGES footer fields',footer.includes('PAGE') && footer.includes('NUMPAGES'))
check('PDF uses margin boxes, page counters, no automatic header',standaloneHtml(model,paged).includes('@bottom-center{content:"Page " counter(page) " of " counter(pages)') && standaloneHtml(model,paged).includes('@top-center{content:none'))
const scope = document.createElement('div'); scope.id='css-test'; scope.innerHTML='<div class="warning-box">Styled content</div>'; document.body.append(scope)
const style = document.createElement('style'); style.textContent=scopeDocumentCss('.warning-box {color:rgb(10,20,30);padding:16px} body {background-color:rgb(1,2,3)} #shell {display:none} @media screen { .warning-box {border-radius:12px} }','#css-test'); scope.append(style)
check('document styles apply inside scope',getComputedStyle(scope.querySelector('.warning-box')).padding === '16px')
check('document CSS cannot change application shell',getComputedStyle(document.getElementById('shell')).display !== 'none' && getComputedStyle(document.body).backgroundColor !== 'rgb(1, 2, 3)')
check('CSS parser prevents style element breakout',!scopeDocumentCss('@media (test: "</style>") { p {color:red} }','#css-test').includes('</style>'))

const loose = await collectDocuments({...workspace, folderAccess:false},open,'intro.md','linked-chain')
check('loose-file sources never follow document links',loose.documents.length === 1)
const styledSettings = {...s, pageColor:'#fff8dc',textColor:'#493d2c',headingColor:'#765029',linkColor:'#806122',headingSizes:[14,13,12,11,10,9],columns:3,columnGap:7,bodyFontSize:11,codeFontSize:9}
const styledZip = await JSZip.loadAsync(await (await exportDocx(model,styledSettings)).arrayBuffer())
const styledXml = await styledZip.file('word/document.xml').async('string')
const stylesXml = await styledZip.file('word/styles.xml').async('string')
check('DOCX page colour and three columns are actual Word properties',styledXml.includes('fff8dc') && /w:num="3"/.test(styledXml) && /w:space="397"/.test(styledXml))
check('DOCX heading sizes and colours honor user overrides',styledXml.includes('765029') && styledXml.includes('w:val="28"') && stylesXml.includes('493d2c'))
const brokenChain = await collectDocuments(workspace,new Map(), 'usage.md','linked-chain')
const repaired = await collectDocuments(workspace,new Map(),'usage.md','linked-chain',[],{'usage.md::intro.md':'__stop__'})
check('end-chain mapping stops cycles without modifying source',repaired.documents.length === 1 && brokenChain.documents.length === 3)
const sameRowNodes = new Map([['a.md',{kind:'file',id:'a.md',path:'a.md',name:'a.md',origin:'file',extension:'md',file:new File(['# A\n\n**Previous:** [Intro](a.md) || **Next:** [Home](b.md)'],'a.md')}],['b.md',{kind:'file',id:'b.md',path:'b.md',name:'b.md',origin:'file',extension:'md',file:new File(['# B'],'b.md')}]])
const sameRow = await collectDocuments({...workspace,filesById:sameRowNodes},new Map(),'a.md','linked-chain')
check('Previous and Next on the same row follow only Next',sameRow.documents.map(d=>d.path).join(',')==='a.md,b.md')
document.getElementById('summary').textContent = failed ? failed+' FAILURES' : results.children.length+' CHECKS PASSED'
} catch(error) { document.getElementById('summary').textContent='ERROR: '+error.stack }
