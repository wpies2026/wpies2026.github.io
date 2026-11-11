(function (global) {
  'use strict';
  // Um iframe HtmlService faz a ponte com google.script.run. Nenhum token vai na URL.
  class GoogleBridge {
    constructor(url) {
      if (!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url)) throw new Error('Informe a URL /exec válida do Apps Script em config.js.');
      this.channel = Array.from(crypto.getRandomValues(new Uint8Array(24)), x=>x.toString(16).padStart(2,'0')).join('');
      this.pending = new Map(); this.session = ''; this.counter = 0;
      this.frame = document.createElement('iframe'); this.frame.hidden = true;
      this.frame.title = 'Conexão segura com o WPIES'; this.frame.tabIndex = -1;
      this.frame.referrerPolicy = 'strict-origin';
      this.ready = new Promise((resolve,reject)=>{this.resolveReady=resolve;this.rejectReady=reject;});
      this.timer=setTimeout(()=>this.rejectReady(new Error('Não foi possível conectar ao serviço. Verifique a implantação do Apps Script e as políticas do Google Workspace.')),35000);
      this.listener = event => this.onMessage(event);
      window.addEventListener('message',this.listener);
      this.frame.src = url+'?channel='+this.channel+'&origin='+encodeURIComponent(location.origin);
      document.body.appendChild(this.frame);
    }
    belongsToFrame(source) {
      try { for(let i=0;source && i<5;i++){if(source===this.frame.contentWindow)return true; if(source===source.parent)break; source=source.parent;} } catch {}
      return false;
    }
    onMessage(event) {
      const d=event.data;
      if(!d || d.channel!==this.channel || !/^https:\/\/[a-z0-9-]+\.googleusercontent\.com$/.test(event.origin))return;
      if(d.type==='wpies:ready' && !this.target && this.belongsToFrame(event.source)){
        this.target=event.source;this.origin=event.origin;clearTimeout(this.timer);this.resolveReady();return;
      }
      if(event.source!==this.target || event.origin!==this.origin || d.type!=='wpies:result')return;
      const pending=this.pending.get(d.id);if(!pending)return;
      clearTimeout(pending.timer);this.pending.delete(d.id);
      if(d.result?.ok)pending.resolve(d.result.data);
      else {const e=new Error(d.result?.error?.message||'Não foi possível concluir a operação.');e.code=d.result?.error?.code;pending.reject(e);}
    }
    async call(action,payload={}) {
      await this.ready;
      const id=this.channel+':'+(++this.counter);
      return new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>{this.pending.delete(id);const e=new Error('A operação demorou mais que o esperado. Atualize a lista antes de tentar novamente para conferir se ela foi concluída.');e.code='TIMEOUT';reject(e);},120000);
        this.pending.set(id,{resolve,reject,timer});
        this.target.postMessage({type:'wpies:request',channel:this.channel,id,request:{action,payload,session:this.session}},this.origin);
      });
    }
    async login(code,challenge) {
      const result=await this.call('login',{code,challenge,channel:this.channel});
      this.session=result.session;return result;
    }
    async logout(){try{await this.call('logout');}finally{this.session='';}}
  }
  let googlePromise;
  function loadGoogle() {
    if(global.google?.accounts?.oauth2)return Promise.resolve();
    if(googlePromise)return googlePromise;
    googlePromise=new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;
      script.onload=()=>global.google?.accounts?.oauth2?resolve():reject(new Error('O login Google não está disponível neste navegador.'));
      script.onerror=()=>{googlePromise=null;reject(new Error('Não foi possível carregar o login Google. Verifique sua conexão.'));};
      document.head.appendChild(script);
    });return googlePromise;
  }
  let pdfPromise;
  function loadPdf() {
    if(global.PDFLib)return Promise.resolve(global.PDFLib);
    if(pdfPromise)return pdfPromise;
    pdfPromise=new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src='assets/vendor/pdf-lib-1.17.1.min.js';
      script.onload=()=>resolve(global.PDFLib);script.onerror=()=>{pdfPromise=null;reject(new Error('Não foi possível carregar o leitor de PDF.'));};document.head.appendChild(script);
    });return pdfPromise;
  }
  async function inspectPdf(file) {
    if(!file || !/\.pdf$/i.test(file.name))throw new Error('Selecione um arquivo PDF.');
    if(file.size>10*1024*1024)throw new Error('O PDF deve ter no máximo 10 MB.');
    if(file.size<100)throw new Error('O arquivo está vazio ou não é um PDF válido.');
    const bytes=new Uint8Array(await file.arrayBuffer());
    if(new TextDecoder('ascii').decode(bytes.slice(0,5))!=='%PDF-')throw new Error('O conteúdo do arquivo não corresponde a um PDF.');
    const lib=await loadPdf();let doc;
    try{doc=await lib.PDFDocument.load(bytes,{updateMetadata:false});}catch{throw new Error('Não foi possível ler o PDF. Exporte uma versão válida, sem senha.');}
    const pageCount=doc.getPageCount();if(pageCount<4||pageCount>6)throw new Error(`O arquivo tem ${pageCount} página(s). São aceitos textos de 4 a 6 páginas.`);
    const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('Falha ao ler o arquivo.'));reader.readAsDataURL(file);});
    return {name:file.name,size:file.size,pageCount,base64};
  }
  global.WPIES_API={GoogleBridge,loadGoogle,inspectPdf};
})(window);
