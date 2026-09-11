import type { Plugin } from 'vite'
import { createImportHandler } from './import/http.mjs'

export function importDevPlugin():Plugin {
  return {name:'document-download',apply:'serve',configureServer(server){
    let handle:ReturnType<typeof createImportHandler>|undefined
    server.middlewares.use((req,res,next)=>{
      if(new URL(req.url||'/', 'http://localhost').pathname!=='/api/import'){next();return}
      const address=server.httpServer?.address(),port=typeof address==='object'&&address?address.port:server.config.server.port||5173
      handle??=createImportHandler({allowedOrigins:[`http://localhost:${port}`,`http://127.0.0.1:${port}`,`http://[::1]:${port}`]})
      void handle(req,res)
    })
  }}
}
