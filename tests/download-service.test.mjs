import test from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { EventEmitter } from 'node:events'
import { createServer } from 'node:http'
import { gzipSync } from 'node:zlib'
import { downloadUrl, isPublicAddress, openPublicResponse, validateTarget } from '../scripts/import/download.mjs'
import { createImportHandler } from '../scripts/import/http.mjs'

const publicLookup=async()=>[{address:'93.184.216.34',family:4}]
function fixtureRequest(response,inspect=()=>{}){
  return (url,options,callback)=>{
    inspect(url,options)
    const request=new EventEmitter()
    request.end=()=>queueMicrotask(()=>callback(Object.assign(Readable.from([Buffer.from(response.body||'')]),{statusCode:response.status||200,headers:response.headers||{'content-type':'text/html'}})))
    return request
  }
}
test('URL and resolved-address checks block local, reserved and credential-bearing targets',()=>{
  for(const url of ['http://127.0.0.1/','http://2130706433/','http://0x7f000001/','http://[::1]/','http://localhost/','http://x.local/','http://example.com:444/','https://user:secret@example.com/','file:///etc/passwd'])assert.throws(()=>validateTarget(url))
  for(const address of ['10.0.0.1','127.0.0.1','169.254.169.254','172.16.0.1','192.168.0.1','100.64.0.1','198.18.0.1','203.0.113.1','::1','::ffff:127.0.0.1','fc00::1','2001:db8::1','2002:7f00:1::'])assert.equal(isPublicAddress(address),false,address)
  assert.equal(validateTarget('https://example.com/docs#title').href,'https://example.com/docs')
  assert.equal(isPublicAddress('93.184.216.34'),true)
  assert.equal(isPublicAddress('2606:4700:4700::1111'),true)
})
test('connection uses the validated IP with original TLS hostname, and rejects mixed DNS answers',async()=>{
  let connected=false
  const response=await openPublicResponse(new URL('https://example.com/'),AbortSignal.timeout(1000),{lookup:publicLookup,request:fixtureRequest({body:'ok'},(url,options)=>{
    connected=true;assert.equal(url.hostname,'example.com');assert.equal(options.servername,'example.com');assert.equal(options.agent,false)
    options.lookup(url.hostname,{all:true},(error,addresses)=>{assert.equal(error,null);assert.deepEqual(addresses,[{address:'93.184.216.34',family:4}])})
    assert.equal(options.headers.Cookie,undefined);assert.equal(options.headers.Authorization,undefined)
  })})
  response.destroy();assert.equal(connected,true)
  await assert.rejects(openPublicResponse(new URL('https://example.com/'),AbortSignal.timeout(1000),{lookup:async()=>[{address:'93.184.216.34',family:4},{address:'127.0.0.1',family:4}],request:()=>assert.fail('Must not connect')}),/private/)
})
test('redirect destinations are checked before connecting and response types/status/decoded sizes are bounded',async()=>{
  await assert.rejects(downloadUrl('https://example.com/','page',{lookup:publicLookup,request:fixtureRequest({status:302,headers:{location:'http://127.0.0.1/private'}})}),/Local, private/)
  await assert.rejects(downloadUrl('https://example.com/','page',{lookup:publicLookup,request:fixtureRequest({status:302,headers:{location:'https://example.com/'}})}),/loop/)
  await assert.rejects(downloadUrl('https://example.com/','page',{lookup:publicLookup,request:fixtureRequest({status:403})}),/HTTP 403/)
  await assert.rejects(downloadUrl('https://example.com/','page',{lookup:publicLookup,request:fixtureRequest({headers:{'content-type':'application/pdf'}})}),/HTML/)
  await assert.rejects(downloadUrl('https://example.com/','page',{lookup:publicLookup,request:fixtureRequest({headers:{'content-type':'text/html','content-encoding':'gzip'},body:gzipSync('x'.repeat(200*1024*1024+1))})}),/size limit/)
  await assert.rejects(downloadUrl('https://example.com/','image',{lookup:publicLookup,request:fixtureRequest({headers:{'content-type':'image/png'},body:'not a png'})}),/declared format/)
  assert.deepEqual(await downloadUrl('https://example.com/','page',{lookup:publicLookup,request:fixtureRequest({body:'<h1>Public page</h1>'})}),{url:'https://example.com/',html:'<h1>Public page</h1>'})
})
async function withService(options,run){
  const handler=createImportHandler({allowedOrigins:['http://app.example'],...options})
  const server=createServer((req,res)=>void handler(req,res))
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
  const endpoint=`http://127.0.0.1:${server.address().port}/api/import`
  const call=(body={url:'https://example.com/',kind:'page'},headers={})=>fetch(endpoint,{method:'POST',headers:{Origin:'http://app.example','Content-Type':'application/json',...headers},body:typeof body==='string'?body:JSON.stringify(body)})
  try{await run(call)}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}
}
test('key-free endpoint restricts origins/schema, caches in memory, expires and limits requests',async()=>{
  let calls=0,clock=0
  await withService({now:()=>clock,download:async url=>{calls++;return {url,html:'<main>Content</main>'}}},async call=>{
    assert.equal((await call(undefined,{Origin:'http://unrelated.example'})).status,403)
    assert.equal((await call({url:'http://127.0.0.1',kind:'page'})).status,403)
    assert.equal((await call({url:'https://example.com',kind:'command'})).status,400)
    assert.equal((await call()).status,200)
    const cached=await call();assert.equal(cached.headers.get('cache-control'),'no-store');assert.equal((await cached.json()).html,'<main>Content</main>');assert.equal(calls,1)
    clock+=61000;assert.equal((await call()).status,200);assert.equal(calls,2)
    for(let i=0;i<89;i++)assert.equal((await call()).status,200)
    assert.equal((await call()).status,429)
  })
})
test('simultaneous requests reuse a single download, and oversized requests are rejected',async()=>{
  let calls=0
  await withService({download:async url=>{calls++;await new Promise(resolve=>setTimeout(resolve,20));return {url,html:'<p>One copy</p>'}}},async call=>{
    const responses=await Promise.all([call(),call(),call()]);assert.ok(responses.every(r=>r.status===200));assert.equal(calls,1)
    assert.equal((await call('x'.repeat(5000))).status,413)
  })
})


test('downloads exactly 200 MiB of decoded HTML and rejects larger advertised bodies',async()=>{
  const length=200*1024*1024
  const html='<main>'+ ' '.repeat(length-26) + '<p>tail</p></main>'
  // Derive the filler from real UTF-8 sizes, rather than assuming tag lengths.
  const exact=html+' '.repeat(length-Buffer.byteLength(html))
  const value=await downloadUrl('https://example.com/','page',{lookup:publicLookup,request:fixtureRequest({body:exact})})
  assert.equal(Buffer.byteLength(value.html),length);assert.ok(value.html.includes('<p>tail</p>'))
  await assert.rejects(downloadUrl('https://example.com/','page',{lookup:publicLookup,request:fixtureRequest({headers:{'content-type':'text/html','content-length':String(length+1)}})}),/size limit/)
})

test('HTML transport avoids JSON encoding and retains the resolved page URL',async()=>{
  await withService({download:async()=>({url:'https://example.com/final',html:'<h1>Ready</h1>'})},async call=>{
    const response=await call(undefined,{Accept:'text/html'})
    assert.equal(response.headers.get('content-type'),'text/html; charset=utf-8')
    assert.equal(response.headers.get('x-import-final-url'),'https://example.com/final')
    assert.equal(await response.text(),'<h1>Ready</h1>')
  })
})
