const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');const path=require('node:path');
const PDFLib=require('../assets/vendor/pdf-lib-1.17.1.min.js');
class Reader {readAsDataURL(file){file.arrayBuffer().then(bytes=>{this.result='data:application/pdf;base64,'+Buffer.from(bytes).toString('base64');this.onload();}).catch(()=>this.onerror());}}
const context=vm.createContext({window:{PDFLib},Uint8Array,TextDecoder,FileReader:Reader});vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/api.js'),'utf8'),context);
const inspect=context.window.WPIES_API.inspectPdf;
async function file(pages){const doc=await PDFLib.PDFDocument.create();for(let i=0;i<pages;i++)doc.addPage();const bytes=await doc.save({useObjectStreams:true});return {name:'fixture.pdf',size:bytes.length,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};}
test('PDF real com object streams: 4 e 6 páginas são reconhecidas',async()=>{for(const n of [4,6]){const f=await file(n);const r=await inspect(f);assert.equal(r.pageCount,n);assert.ok(r.base64.length>100);}});
test('contagem estrutural rejeita 3 e 7 páginas',async()=>{for(const n of [3,7]){const f=await file(n);await assert.rejects(inspect(f),/São aceitos textos de 4 a 6 páginas/);}});
test('arquivo disfarçado de PDF é rejeitado',async()=>{await assert.rejects(inspect({name:'fake.pdf',size:200,arrayBuffer:async()=>new TextEncoder().encode('x'.repeat(200)).buffer}),/não corresponde a um PDF/);});
test('limite de 10 MB é aplicado antes da leitura',async()=>{let read=false;await assert.rejects(inspect({name:'large.pdf',size:10*1024*1024+1,arrayBuffer:async()=>{read=true;return new ArrayBuffer(0);}}),/10 MB/);assert.equal(read,false);});
