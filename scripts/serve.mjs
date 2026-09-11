import { createServer } from 'node:http'
import { readFile,realpath,stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createImportHandler } from './import/http.mjs'

const port=Number(process.env.PORT||4173),host=process.env.HOST||'127.0.0.1'
const root=await realpath(fileURLToPath(new URL('../web/',import.meta.url)))
const allowedOrigins=(process.env.IMPORT_ALLOWED_ORIGINS||`http://localhost:${port},http://127.0.0.1:${port}`).split(',').map(value=>value.trim()).filter(Boolean)
const importRequest=createImportHandler({allowedOrigins})
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.xml':'application/xml','.txt':'text/plain'}
const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url||'/', 'http://localhost')
    if(url.pathname==='/api/import'){await importRequest(req,res);return}
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return}
    const pathname=decodeURIComponent(url.pathname),target=await realpath(path.resolve(root,'.'+pathname,pathname.endsWith('/')?'index.html':''))
    if(!target.startsWith(root+path.sep)||!(await stat(target)).isFile())throw new Error('Not found')
    const type=mime[path.extname(target)]||'application/octet-stream'
    res.writeHead(200,{'Content-Type':type,'X-Content-Type-Options':'nosniff','Cache-Control':target.includes(path.sep+'assets'+path.sep)?'public,max-age=31536000,immutable':'no-cache'})
    res.end(req.method==='HEAD'?undefined:await readFile(target))
  }catch{if(!res.headersSent)res.writeHead(404,{'Content-Type':'text/plain'});res.end('Not found')}
})
server.headersTimeout=15000;server.requestTimeout=30000
server.listen(port,host,()=>console.log(`Ultimate Markdown + imports: http://${host}:${port}`))
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)))
