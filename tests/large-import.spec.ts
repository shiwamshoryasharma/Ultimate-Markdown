import { test, expect } from '@playwright/test'
import { createRequire } from 'node:module'
const require=createRequire(import.meta.url)
const {Document,Packer,Paragraph}=require('docx')
const JSZip=require('jszip')
import { writeFileSync, openSync, writeSync, closeSync, unlinkSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

const limit=200*1024*1024
const htmlPath=resolve('.tmp/boundary-200MiB.html'),docxPath=resolve('.tmp/boundary-200MiB.docx')
test.beforeAll(async()=>{
  const prefix='<main><h1>Large HTML document</h1><!--',suffix='--><p>Complete document tail.</p></main>'
  const fd=openSync(htmlPath,'w');writeSync(fd,prefix)
  let remaining=limit-Buffer.byteLength(prefix+suffix);const chunk=Buffer.alloc(1024*1024,32)
  while(remaining){const size=Math.min(remaining,chunk.length);writeSync(fd,chunk,0,size);remaining-=size}writeSync(fd,suffix);closeSync(fd)
  const buffer=await Packer.toBuffer(new Document({sections:[{children:[new Paragraph('Large Word document'),new Paragraph('Complete Word tail.')]}]}))
  const zip=await JSZip.loadAsync(buffer);zip.file('padding.bin',Buffer.alloc(0))
  const overhead=(await zip.generateAsync({type:'nodebuffer',compression:'STORE'})).length
  zip.file('padding.bin',Buffer.alloc(limit-overhead))
  writeFileSync(docxPath,await zip.generateAsync({type:'nodebuffer',compression:'STORE'}))
  expect(statSync(htmlPath).size).toBe(limit);expect(statSync(docxPath).size).toBe(limit)
})
test.afterAll(()=>{for(const path of [htmlPath,docxPath]){try{unlinkSync(path)}catch{/* failed fixture setup */}}})

test('accepts a 200 MiB HTML file, strips bulk comments in a worker, and downloads complete Markdown',async({page})=>{
  await page.goto('/import')
  await page.getByRole('button',{name:'HTML',exact:true}).click()
  await page.getByLabel('Or choose HTML',{exact:false}).setInputFiles(htmlPath)
  await page.getByRole('button',{name:'Parse & review',exact:true}).click()
  await expect(page.locator('.markdown-content')).toContainText('Complete document tail.',{timeout:60000})
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download .md',exact:true}).click()
  const {readFileSync}=await import('node:fs');const content=readFileSync((await (await download).path())!,'utf8')
  expect(content).toContain('# Large HTML document');expect(content).toContain('Complete document tail.')
  await expect(page.getByRole('button',{name:'Confirm review'})).toHaveCount(0)
})

test('accepts a valid 200 MiB DOCX archive and converts locally in a cancellable worker',async({page})=>{
  const uploads:string[]=[];page.on('request',r=>{if(r.method()==='POST')uploads.push(r.url())})
  await page.goto('/import')
  await page.getByRole('button',{name:'Word Document',exact:true}).click()
  await page.getByLabel('Choose DOCX',{exact:false}).setInputFiles(docxPath)
  await page.getByRole('button',{name:'Parse & review',exact:true}).click()
  await expect(page.locator('.markdown-content')).toContainText('Complete Word tail.',{timeout:60000})
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download .md',exact:true}).click()
  const {readFileSync}=await import('node:fs');expect(readFileSync((await (await download).path())!,'utf8')).toContain('Complete Word tail.')
  expect(uploads).toEqual([])
  const result=await page.evaluate(async()=>{
    const {prepareImport}=await import('/src/services/import/prepare.ts')
    const oversized=new File([new Uint8Array(200*1024*1024+1)],'too-large.html')
    try{await prepareImport({kind:'html',file:oversized});return 'accepted'}catch(e){return String(e)}
  })
  expect(result).toContain('200 MiB')
})

test('large HTML worker cancels without replacing the current review',async({page})=>{
  await page.goto('/import')
  const message=await page.evaluate(async()=>{
    const {prepareImport}=await import('/src/services/import/prepare.ts');const abort=new AbortController()
    const pending=prepareImport({kind:'html',file:new Blob([new Uint8Array(200*1024*1024)])},abort.signal)
    abort.abort();try{await pending;return 'completed'}catch(e){return String(e)}
  })
  expect(message).toContain('Import stopped')
  await expect(page.getByRole('region',{name:'Custom Preview'})).toHaveCount(0)
})
