/**
 * 2º WPIES — API para GitHub Pages. Executada na conta do organizador.
 * Configure CLIENT_ID, CLIENT_SECRET e SITE_URL nas Propriedades do script.
 * Execute initializeProject no editor uma única vez e publique como Web App.
 * Todas as funções auxiliares terminam em _ e não podem ser chamadas via RPC.
 */
const WPIES_DOMAIN_ = 'unipampa.edu.br';
const WPIES_ZONE_ = 'America/Sao_Paulo';
const RECORD_HEADERS_ = ['id','authorSub','authorEmail','advisorEmail','status','revision','title','createdAt','updatedAt','data'];
const ALLOWED_STATUSES_ = ['received','in_review','changes_requested','accepted','not_accepted'];
const ALLOWED_KINDS_ = ['published','progress','preprint'];
const TRACKS_ = ['Engenharia de Software Aplicada','Metodologias e Tecnologias para Engenharia de Software','Inteligência Artificial'];
const MUTATIONS_ = ['submit','revise','sendReview','review','saveSettings'];
const MAX_PDF_BYTES_ = 10 * 1024 * 1024;

function initializeProject() {
  const props=PropertiesService.getScriptProperties();
  const effective=String(Session.getEffectiveUser().getEmail()).toLowerCase();
  const active=String(Session.getActiveUser().getEmail()).toLowerCase();
  // Impede inicialização por visitantes do Web App executado como proprietário.
  if(!active || active!==effective)throw new Error('Execute esta função no editor, conectado à conta proprietária.');
  if(!isInstitutional_(effective))throw new Error('A conta proprietária precisa ser @unipampa.edu.br.');
  const owner=props.getProperty('OWNER_EMAIL');
  if(owner && owner!==effective)throw new Error('O proprietário configurado é diferente da conta em execução.');
  requiredProperty_('CLIENT_ID');requiredProperty_('CLIENT_SECRET');siteUrl_();
  if(props.getProperty('SPREADSHEET_ID')){
    console.log('Projeto já inicializado. As configurações e submissões foram preservadas.');return;
  }
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try {
    if(props.getProperty('SPREADSHEET_ID'))return;
    const folder=DriveApp.createFolder('WPIES 2026 · Submissões privadas');
    const ss=SpreadsheetApp.create('WPIES 2026 · Gestão de submissões');
    ss.setSpreadsheetTimeZone(WPIES_ZONE_);
    const submissions=ss.getSheets()[0];submissions.setName('Submissions');submissions.appendRow(RECORD_HEADERS_);submissions.setFrozenRows(1);
    const settings=ss.insertSheet('Settings');settings.appendRow(['key','json']);
    const audit=ss.insertSheet('Audit');audit.appendRow(['timestamp','actorEmail','action','recordId','details']);audit.setFrozenRows(1);
    const config={version:1,eventName:'2º Workshop em Pesquisa e Inovação em Engenharia de Software',edition:'2026',submissionDeadline:'2026-11-20T23:59:59-03:00',reviewDeadline:'2026-11-25T23:59:59-03:00',correctionDeadline:'',eventDate:'',eventLocation:'',contactEmail:'ppges@unipampa.edu.br',templateUrl:'https://pt.overleaf.com/read/bybwwbcbhhwn#86f79a',submissionsOpen:true,advisors:[],organizers:[effective],ownerEmail:effective};
    settings.appendRow(['config',JSON.stringify(config)]);
    props.setProperties({OWNER_EMAIL:effective,DRIVE_FOLDER_ID:folder.getId(),SPREADSHEET_ID:ss.getId()});
    DriveApp.getFileById(ss.getId()).moveTo(folder);
    console.log('Projeto inicializado. Abra o painel para cadastrar orientadores e prazos.');
    console.log('Planilha: '+ss.getUrl());console.log('Pasta: '+folder.getUrl());
  } finally {lock.releaseLock();}
}

function doGet(e) {
  try {
    const origin=siteOrigin_();const p=(e&&e.parameter)||{};
    if(p.origin!==origin || !/^[a-f0-9]{48}$/.test(p.channel||''))return HtmlService.createHtmlOutput('Conexão WPIES. Acesse o endereço oficial do evento.');
    const t=HtmlService.createTemplateFromFile('Bridge');t.origin=origin;t.channel=p.channel;
    return t.evaluate().setTitle('Conexão WPIES').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch(err) {return HtmlService.createHtmlOutput('WPIES: configuração do serviço pendente.');}
}

/** Único ponto de entrada RPC. Ações e privilégios sempre validados no servidor. */
function api(request) {
  try {
    ensure_(request && typeof request==='object','BAD_REQUEST','Requisição inválida.');
    ensure_(request.origin===siteOrigin_(),'ORIGIN_DENIED','Origem não autorizada.');
    ensure_(/^[a-f0-9]{48}$/.test(request.channel||''),'BAD_REQUEST','Canal de conexão inválido.');
    const action=String(request.action||'');const p=request.payload||{};
    if(action==='publicConfig')return ok_(publicConfig_(readSettings_()));
    if(action==='beginAuth')return ok_(beginAuth_(request.channel));
    if(action==='login')return ok_(login_(p,request.channel));
    const user=authenticate_(request.session);
    if(action==='logout'){CacheService.getScriptCache().remove('session:'+digest_(request.session));return ok_({loggedOut:true});}
    if(action==='me')return ok_(user);
    const known=['list','get','settings','submit','revise','sendReview','review','saveSettings'];
    ensure_(known.indexOf(action)>=0,'UNKNOWN_ACTION','Operação não disponível.');
    let lock;
    if(MUTATIONS_.indexOf(action)>=0){lock=LockService.getScriptLock();ensure_(lock.tryLock(30000),'BUSY','O serviço está ocupado. Tente novamente em alguns segundos.');}
    try {
      const config=readSettings_();
      // Os papéis são recalculados a cada operação, incluindo sessões já abertas.
      user.roles=roles_(user,config);
      if(action==='list')return ok_(listFor_(user,p.scope,config));
      if(action==='get')return ok_(getFor_(user,p.id,config));
      if(action==='settings'){requireOrganizer_(user);return ok_(Object.assign({},config,{folderUrl:DriveApp.getFolderById(requiredProperty_('DRIVE_FOLDER_ID')).getUrl(),spreadsheetUrl:database_().getUrl()}));}
      if(action==='saveSettings')return ok_(saveSettings_(user,p,config));
      if(action==='submit')return ok_(submit_(user,p,config));
      if(action==='revise')return ok_(revise_(user,p,config));
      if(action==='sendReview')return ok_(sendReview_(user,p,config));
      if(action==='review')return ok_(review_(user,p,config));
    } finally {if(lock)lock.releaseLock();}
  } catch(err) {
    // Nunca registrar códigos OAuth, sessões, conteúdo de PDFs ou o request.
    if(!err.publicCode)console.error('WPIES operation failed: '+String(err.message||'Unknown error').slice(0,300));
    return {ok:false,error:{code:err.publicCode||'SERVICE_ERROR',message:err.publicCode?err.message:'O serviço não concluiu a operação. Consulte a organização e atualize a lista antes de tentar novamente.'}};
  }
}

function beginAuth_(channel) {
  const challenge=randomToken_();
  CacheService.getScriptCache().put('auth:'+digest_(challenge),JSON.stringify({channel:channel,expiresAt:Date.now()+300000}),300);
  return {challenge:challenge};
}

function login_(p,channel) {
  ensure_(typeof p.code==='string' && p.code.length>10 && p.code.length<4096,'LOGIN_FAILED','Código de autenticação inválido.');
  ensure_(typeof p.challenge==='string' && /^[a-f0-9]{96}$/.test(p.challenge),'LOGIN_FAILED','Reinicie o login para obter uma nova autorização.');
  const cache=CacheService.getScriptCache();const key='auth:'+digest_(p.challenge);
  // O desafio é consumido sob lock, impedindo a reutilização concorrente.
  const lock=LockService.getScriptLock();lock.waitLock(10000);let challenge;
  try{const raw=cache.get(key);cache.remove(key);challenge=raw?JSON.parse(raw):null;}finally{lock.releaseLock();}
  ensure_(challenge && challenge.channel===channel && challenge.expiresAt>Date.now(),'LOGIN_FAILED','A autorização expirou. Inicie o login novamente.');
  const response=UrlFetchApp.fetch('https://oauth2.googleapis.com/token',{
    method:'post',contentType:'application/x-www-form-urlencoded',followRedirects:false,muteHttpExceptions:true,
    payload:{code:p.code,client_id:requiredProperty_('CLIENT_ID'),client_secret:requiredProperty_('CLIENT_SECRET'),redirect_uri:siteOrigin_(),grant_type:'authorization_code'}
  });
  ensure_(response.getResponseCode()===200,'LOGIN_FAILED','O Google não confirmou este login. Confira o cliente OAuth e a origem autorizada.');
  const tokens=JSON.parse(response.getContentText());
  // O ID token é aceito SOMENTE desta resposta HTTPS do endpoint Google, autenticada
  // pelo client_secret. Nunca aceitamos ID tokens/claims fornecidos pelo navegador.
  // Base: developers.google.com/identity/openid-connect/openid-connect#obtainuserinfo
  const user=claimsFromTrustedResponse_(tokens,requiredProperty_('CLIENT_ID'),Date.now());
  const session=randomToken_();const expiresAt=Math.min(user.tokenExpiresAt,Date.now()+3600000);
  const identity={sub:user.sub,email:user.email,name:user.name,expiresAt:expiresAt};
  cache.put('session:'+digest_(session),JSON.stringify(identity),Math.max(1,Math.floor((expiresAt-Date.now())/1000)));
  const config=readSettings_();
  return {session:session,user:Object.assign({},identity,{roles:roles_(identity,config)})};
}

function claimsFromTrustedResponse_(tokens,clientId,now) {
  ensure_(tokens && typeof tokens.id_token==='string','LOGIN_FAILED','Resposta de autenticação incompleta.');
  const parts=tokens.id_token.split('.');ensure_(parts.length===3,'LOGIN_FAILED','Resposta de autenticação inválida.');
  let payload;
  try{payload=JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[1])).getDataAsString('UTF-8'));}catch(err){fail_('LOGIN_FAILED','Resposta de autenticação inválida.');}
  ensure_(payload.aud===clientId && (!payload.azp || payload.azp===clientId),'LOGIN_FAILED','Este login pertence a outro aplicativo.');
  ensure_(payload.iss==='https://accounts.google.com'||payload.iss==='accounts.google.com','LOGIN_FAILED','Emissor de autenticação inválido.');
  ensure_(Number.isFinite(payload.exp) && payload.exp*1000>now && Number.isFinite(payload.iat) && payload.iat*1000<=now+60000,'LOGIN_FAILED','A autorização expirou.');
  ensure_(payload.hd===WPIES_DOMAIN_ && payload.email_verified===true && isInstitutional_(payload.email),'DOMAIN_DENIED','Utilize exclusivamente sua conta Google @unipampa.edu.br.');
  ensure_(typeof payload.sub==='string' && payload.sub.length>0 && payload.sub.length<=255,'LOGIN_FAILED','Identificador Google inválido.');
  return {sub:payload.sub,email:payload.email.toLowerCase(),name:String(payload.name||payload.email.split('@')[0]).slice(0,120),tokenExpiresAt:payload.exp*1000};
}

function authenticate_(session) {
  ensure_(typeof session==='string' && /^[a-f0-9]{96}$/.test(session),'SESSION_EXPIRED','Sua sessão expirou. Entre novamente com o Google.');
  const raw=CacheService.getScriptCache().get('session:'+digest_(session));
  ensure_(raw,'SESSION_EXPIRED','Sua sessão expirou. Entre novamente com o Google.');
  const user=JSON.parse(raw);ensure_(user.expiresAt>Date.now() && isInstitutional_(user.email),'SESSION_EXPIRED','Sua sessão expirou. Entre novamente com o Google.');
  user.roles=roles_(user,readSettings_());return user;
}

function roles_(user,config) {
  const roles=['student'];
  if(config.advisors.some(a=>a.email===user.email))roles.push('advisor');
  if(config.organizers.indexOf(user.email)>=0 || user.email===config.ownerEmail)roles.push('organizer');
  if(user.email===config.ownerEmail)roles.push('owner');return roles;
}
function requireOrganizer_(user){ensure_(user.roles.indexOf('organizer')>=0,'FORBIDDEN','Acesso restrito à organização.');}
function canRead_(user,r){return user.roles.indexOf('organizer')>=0 || r.authorSub===user.sub || (r.advisorEmail===user.email && !!r.invitedAt);}
function listFor_(user,scope,config) {
  const rows=allRecords_().filter(r=> scope==='admin' ? user.roles.indexOf('organizer')>=0 : scope==='review' ? r.advisorEmail===user.email && !!r.invitedAt : r.authorSub===user.sub);
  if(scope==='admin')requireOrganizer_(user);
  return rows.map(r=>presentRecord_(r)).sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt));
}
function getFor_(user,id,config){const item=findRecord_(id);ensure_(canRead_(user,item.record),'FORBIDDEN','Você não tem acesso a esta submissão.');return presentRecord_(item.record);}
function presentRecord_(record){const r=JSON.parse(JSON.stringify(record));delete r.requestId;delete r.lastInviteRequestId;return r;}

function submit_(user,p,config) {
  const requestId=text_(p.requestId,36,64,'Identificador da solicitação');ensure_(/^[a-zA-Z0-9-]+$/.test(requestId),'BAD_REQUEST','Identificador da solicitação inválido.');
  const duplicate=allRecords_().find(r=>r.authorSub===user.sub && r.requestId===requestId);if(duplicate)return presentRecord_(duplicate);
  ensure_(isSubmissionOpen_(config,Date.now()),'DEADLINE','As submissões estão encerradas.');
  ensure_(allRecords_().filter(r=>r.authorSub===user.sub).length<10,'LIMIT','O limite é de 10 submissões por participante.');
  const fields=validateSubmission_(p,config);ensure_(fields.advisorEmail!==user.email,'BAD_REQUEST','Selecione seu orientador; não é permitida a autoavaliação.');
  const id=Utilities.getUuid();const now=new Date().toISOString();
  const file=storePdf_(p.file,id,1,user.email);
  const row=Object.assign({},fields,{id:id,authorSub:user.sub,authorName:user.name,authorEmail:user.email,status:'received',revision:1,createdAt:now,updatedAt:now,fileId:file.id,fileName:file.name,fileUrl:file.url,pageCount:file.pageCount,pageCountSource:'browser',requestId:requestId,versions:[],reviews:[],invitedAt:'',lastInviteAt:'',notification:null});
  try{saveRecord_(row);audit_(user,'submission.created',id,'revision 1');}catch(err){fileTrash_(file.id);throw err;}
  return presentRecord_(row);
}

function validateSubmission_(p,config) {
  const advisor=config.advisors.find(a=>a.email===String(p.advisorEmail||'').toLowerCase());
  ensure_(advisor,'BAD_REQUEST','Selecione um orientador cadastrado pela organização.');
  ensure_(ALLOWED_KINDS_.indexOf(p.kind)>=0,'BAD_REQUEST','Selecione uma modalidade válida.');
  ensure_(TRACKS_.indexOf(p.track)>=0,'BAD_REQUEST','Selecione uma linha de pesquisa válida.');
  ensure_(p.declaration===true,'BAD_REQUEST','Confirme a declaração de natureza do trabalho.');
  return {title:text_(p.title,10,220,'Título'),summary:text_(p.summary,30,1800,'Resumo'),sources:text_(p.sources,15,2500,'Publicações e trabalhos de origem'),coauthors:text_(p.coauthors||'',0,500,'Coautores'),advisorEmail:advisor.email,advisorName:advisor.name,kind:p.kind,track:p.track,declaration:true,declarationVersion:'2026-11-08'};
}

function revise_(user,p,config) {
  const item=findRecord_(p.id);const r=item.record;
  ensure_(r.authorSub===user.sub,'FORBIDDEN','Apenas o autor pode enviar uma nova versão.');
  const rid=text_(p.requestId,36,64,'Identificador da solicitação');
  if(r.lastRevisionRequestId===rid)return presentRecord_(r);
  ensure_(r.revision===p.revision,'CONFLICT','Existe uma versão mais recente. Atualize a página.');
  ensure_(canRevise_(r,config,Date.now()),'DEADLINE','O envio de nova versão está indisponível para esta situação ou prazo.');
  ensure_(r.revision<10,'LIMIT','O limite é de 10 versões. Entre em contato com a organização.');
  ensure_(p.declaration===true,'BAD_REQUEST','Confirme novamente a natureza do texto.');
  const next=r.revision+1;const file=storePdf_(p.file,r.id,next,user.email);
  if(r.invitedAt){try{DriveApp.getFileById(file.id).addViewer(r.advisorEmail);}catch(err){fileTrash_(file.id);fail_('DRIVE_PERMISSION','Não foi possível liberar o PDF ao orientador. Consulte a organização.');}}
  r.versions.push({revision:r.revision,fileId:r.fileId,fileName:r.fileName,fileUrl:r.fileUrl,pageCount:r.pageCount,createdAt:r.updatedAt});
  Object.assign(r,{revision:next,fileId:file.id,fileName:file.name,fileUrl:file.url,pageCount:file.pageCount,status:'received',updatedAt:new Date().toISOString(),lastRevisionRequestId:rid,notification:null});
  try{saveRecord_(r,item.row);audit_(user,'submission.revised',r.id,'revision '+next);}catch(err){fileTrash_(file.id);throw err;}
  return presentRecord_(r);
}

function sendReview_(user,p,config) {
  requireOrganizer_(user);
  const item=findRecord_(p.id);const r=item.record;
  const requestId=text_(p.requestId,36,64,'Identificador da solicitação');
  if(r.lastInviteRequestId===requestId && r.notification && r.notification.state==='sent')return {record:presentRecord_(r),message:'Este convite já foi enviado.'};
  ensure_(r.authorSub!==user.sub || r.advisorEmail!==user.email,'FORBIDDEN','Autoavaliação não permitida.');
  ensure_(r.status==='received'||r.status==='in_review','CONFLICT','O trabalho já recebeu uma decisão.');
  ensure_(config.advisors.some(a=>a.email===r.advisorEmail),'BAD_REQUEST','O orientador não está mais cadastrado. Cadastre-o novamente antes do encaminhamento.');
  ensure_(isFuture_(config.reviewDeadline),'DEADLINE','Configure um prazo de revisão futuro antes de encaminhar trabalhos.');
  ensure_(!r.lastInviteAt||Date.now()-Date.parse(r.lastInviteAt)>=300000,'RATE_LIMIT','Aguarde cinco minutos para reenviar um convite já enviado.');
  ensure_(MailApp.getRemainingDailyQuota()>=1,'MAIL_QUOTA','A cota diária de e-mails do Google foi atingida. Tente novamente amanhã.');
  try{DriveApp.getFileById(r.fileId).addViewer(r.advisorEmail);}catch(err){fail_('DRIVE_PERMISSION','Não foi possível liberar o PDF ao orientador. Verifique as políticas de compartilhamento do Workspace.');}
  const link=siteUrl_()+'#/review/'+encodeURIComponent(r.id);
  const deadline=Utilities.formatDate(new Date(config.reviewDeadline),WPIES_ZONE_,'dd/MM/yyyy HH:mm');
  r.status='in_review';r.invitedAt=r.invitedAt||new Date().toISOString();r.updatedAt=new Date().toISOString();r.notification={state:'pending',attemptAt:r.updatedAt};r.lastInviteRequestId=requestId;
  saveRecord_(r,item.row);
  const body='Olá, '+r.advisorName+'.\n\nO trabalho "'+r.title+'", de '+r.authorName+', foi encaminhado para sua revisão no 2º WPIES.\n\nAcesse o link permanente com sua conta '+r.advisorEmail+':\n'+link+'\n\nPrazo para registrar o parecer e a decisão: '+deadline+' (horário de Brasília).\n\nVocê é responsável pela revisão e pelo aceite. Verifique o PDF de 4 a 6 páginas, o template e a identificação como relatório, compilado ou amostra de pré-print. Este evento interno não substitui submissão original para conferências ou periódicos.\n\nOrganização do 2º WPIES · PPGES/UNIPAMPA';
  try {
    MailApp.sendEmail({to:r.advisorEmail,subject:'[2º WPIES] Revisão de apresentação · '+r.id.slice(0,8),body:body,name:'2º WPIES · PPGES',replyTo:config.contactEmail});
  } catch(err) {
    r.notification={state:'failed',attemptAt:new Date().toISOString()};saveRecord_(r,item.row);audit_(user,'review.invitation_failed',r.id,'retry available');
    fail_('MAIL_FAILED','O trabalho está em revisão, mas o e-mail não foi enviado. O link continua disponível; tente enviar o convite novamente.');
  }
  r.lastInviteAt=new Date().toISOString();r.notification={state:'sent',attemptAt:r.lastInviteAt};saveRecord_(r,item.row);audit_(user,'review.invitation_sent',r.id,'revision '+r.revision);
  return {record:presentRecord_(r),message:'Convite enviado ao orientador.'};
}

function review_(user,p,config) {
  const item=findRecord_(p.id);const r=item.record;
  ensure_(r.advisorEmail===user.email && !!r.invitedAt,'FORBIDDEN','Somente o orientador indicado pode revisar este trabalho.');
  ensure_(r.authorSub!==user.sub,'FORBIDDEN','Autoavaliação não permitida.');
  ensure_(r.status==='in_review' && r.revision===p.revision,'CONFLICT','A submissão mudou ou já recebeu uma decisão. Atualize a página.');
  ensure_(isFuture_(config.reviewDeadline),'DEADLINE','O prazo de revisão foi encerrado.');
  ensure_(['accepted','changes_requested','not_accepted'].indexOf(p.decision)>=0,'BAD_REQUEST','Selecione uma decisão válida.');
  const comment=text_(p.comment,10,2000,'Parecer');
  ensure_(p.decision!=='accepted'||p.formatConfirmed===true,'BAD_REQUEST','Para aceitar, confirme a conferência do formato, das páginas e da natureza do texto.');
  if(p.decision==='changes_requested')ensure_(isFuture_(config.correctionDeadline||config.submissionDeadline),'DEADLINE','O prazo de ajustes está encerrado. Solicite à organização um novo prazo.');
  const now=new Date().toISOString();r.status=p.decision;r.updatedAt=now;
  r.reviews.push({decision:p.decision,comment:comment,reviewerName:user.name,reviewerEmail:user.email,revision:r.revision,createdAt:now,formatConfirmed:p.formatConfirmed===true});
  saveRecord_(r,item.row);audit_(user,'review.decision',r.id,p.decision+' revision '+r.revision);return presentRecord_(r);
}

function saveSettings_(user,p,current) {
  requireOrganizer_(user);ensure_(p.version===current.version,'CONFLICT','As configurações foram alteradas em outra sessão. Atualize a página antes de salvar.');
  const config=validateSettings_(p,current,user);
  // Um organizador vê todos os arquivos pela pasta. Professores recebem só o PDF atribuído.
  const folder=DriveApp.getFolderById(requiredProperty_('DRIVE_FOLDER_ID'));
  const added=config.organizers.filter(e=>current.organizers.indexOf(e)<0&&e!==current.ownerEmail);
  const removed=current.organizers.filter(e=>config.organizers.indexOf(e)<0&&e!==current.ownerEmail);
  const granted=[];const revoked=[];
  try {
    added.forEach(email=>{folder.addViewer(email);granted.push(email);});
    removed.forEach(email=>{folder.removeViewer(email);revoked.push(email);});
    const sheet=database_().getSheetByName('Settings');sheet.getRange(2,2).setValue(JSON.stringify(config));SpreadsheetApp.flush();
  }catch(err){
    granted.forEach(email=>{try{folder.removeViewer(email);}catch(ignored){}});
    revoked.forEach(email=>{try{folder.addViewer(email);}catch(ignored){}});
    fail_('SETTINGS_SAVE_FAILED','Não foi possível salvar as configurações e as permissões do Drive. Verifique as contas e as políticas do Workspace.');
  }
  audit_(user,'settings.updated','','version '+config.version);return config;
}

function validateSettings_(p,current,user) {
  const submission=requiredDate_(p.submissionDeadline,'Prazo de submissão');
  const review=optionalDate_(p.reviewDeadline,'Prazo de revisão');
  const correction=optionalDate_(p.correctionDeadline,'Prazo de ajustes');
  ensure_(!review || Date.parse(review)>=Date.parse(submission),'BAD_REQUEST','O prazo de revisão deve ser igual ou posterior ao prazo de submissão.');
  ensure_(!correction || Date.parse(correction)>=Date.parse(submission),'BAD_REQUEST','O prazo de ajustes deve ser igual ou posterior ao prazo de submissão.');
  ensure_(!correction || !review || Date.parse(correction)<=Date.parse(review),'BAD_REQUEST','O prazo de ajustes não pode ser posterior ao prazo de revisão.');
  const advisors=validateRoster_(p.advisors);
  ensure_(Array.isArray(p.organizers)&&p.organizers.length<=30,'BAD_REQUEST','Informe até 30 organizadores.');
  const organizers=Array.from(new Set(p.organizers.map(e=>String(e).trim().toLowerCase())));
  ensure_(organizers.every(isInstitutional_),'BAD_REQUEST','Todos os organizadores devem ter e-mail @unipampa.edu.br.');
  ensure_(organizers.indexOf(current.ownerEmail)>=0,'BAD_REQUEST','A conta proprietária não pode ser removida.');
  if(user.roles.indexOf('owner')<0)ensure_(JSON.stringify(organizers.slice().sort())===JSON.stringify(current.organizers.slice().sort()),'FORBIDDEN','Somente a conta proprietária pode alterar os organizadores.');
  const contact=String(p.contactEmail||'').trim().toLowerCase();ensure_(isInstitutional_(contact),'BAD_REQUEST','O contato deve ser @unipampa.edu.br.');
  return Object.assign({},current,{version:current.version+1,submissionDeadline:submission,reviewDeadline:review,correctionDeadline:correction,eventDate:optionalDate_(p.eventDate,'Data do evento'),eventLocation:text_(p.eventLocation||'',0,180,'Local ou formato do evento'),submissionsOpen:p.submissionsOpen===true,contactEmail:contact,advisors:advisors,organizers:organizers});
}
function validateRoster_(rows) {
  ensure_(Array.isArray(rows)&&rows.length<=100,'BAD_REQUEST','Cadastre até 100 orientadores.');
  const used={};return rows.map(a=>{const name=text_(a.name,3,120,'Nome do orientador');const email=String(a.email||'').trim().toLowerCase();ensure_(isInstitutional_(email),'BAD_REQUEST','Orientadores devem ter e-mail @unipampa.edu.br.');ensure_(!used[email],'BAD_REQUEST','Há um orientador duplicado.');used[email]=true;return {name:name,email:email};});
}

function storePdf_(input,id,revision,authorEmail) {
  const file=validatePdf_(input);const name='WPIES_'+id+'_v'+revision+'.pdf';
  let saved;
  try {
    const blob=Utilities.newBlob(file.bytes,'application/pdf',name);
    saved=DriveApp.getFolderById(requiredProperty_('DRIVE_FOLDER_ID')).createFile(blob);saved.addViewer(authorEmail);
    return {id:saved.getId(),url:saved.getUrl(),name:name,pageCount:file.pageCount};
  } catch(err) {if(saved)fileTrash_(saved.getId());fail_('DRIVE_UPLOAD_FAILED','Não foi possível guardar o arquivo no Drive. Verifique o espaço e as permissões da conta organizadora.');}
}
function validatePdf_(file) {
  ensure_(file && typeof file.base64==='string' && file.base64.length>0 && file.base64.length<=Math.ceil(MAX_PDF_BYTES_/3)*4,'BAD_PDF','O PDF deve ter até 10 MB.');
  ensure_(/^[A-Za-z0-9+/]+={0,2}$/.test(file.base64) && file.base64.length%4===0,'BAD_PDF','Codificação do arquivo inválida.');
  ensure_(Number.isInteger(file.pageCount)&&file.pageCount>=4&&file.pageCount<=6,'BAD_PAGES','São aceitos textos de 4 a 6 páginas.');
  const bytes=Utilities.base64Decode(file.base64);
  ensure_(bytes.length>=100 && bytes.length<=MAX_PDF_BYTES_,'BAD_PDF','O PDF está vazio ou excede o tamanho máximo.');
  ensure_([37,80,68,70,45].every((v,i)=>bytes[i]===v),'BAD_PDF','O conteúdo do arquivo não é um PDF.');
  // A contagem estrutural é feita com pdf-lib no navegador. O servidor confere o
  // intervalo declarado, tamanho e assinatura do arquivo; o orientador confirma
  // as páginas e o conteúdo antes do aceite. Não usar regex como parser de PDF.
  return {bytes:bytes,pageCount:file.pageCount};
}

function allRecords_() {
  const sheet=database_().getSheetByName('Submissions');const n=sheet.getLastRow();if(n<2)return [];
  return sheet.getRange(2,10,n-1,1).getValues().filter(r=>r[0]).map(r=>JSON.parse(r[0]));
}
function findRecord_(id) {
  ensure_(typeof id==='string' && /^[a-f0-9-]{36}$/.test(id),'NOT_FOUND','Submissão não encontrada.');
  const sheet=database_().getSheetByName('Submissions');
  const cell=sheet.getRange('A:A').createTextFinder(id).matchEntireCell(true).findNext();
  ensure_(cell && cell.getRow()>1,'NOT_FOUND','Submissão não encontrada.');
  return {row:cell.getRow(),record:JSON.parse(sheet.getRange(cell.getRow(),10).getValue())};
}
function saveRecord_(r,row) {
  const json=JSON.stringify(r);ensure_(json.length<45000,'LIMIT','O histórico atingiu o limite. Consulte a organização.');
  const values=[r.id,r.authorSub,r.authorEmail,r.advisorEmail,r.status,r.revision,safeCell_(r.title),r.createdAt,r.updatedAt,json];
  const sheet=database_().getSheetByName('Submissions');
  const target=row||sheet.getLastRow()+1;sheet.getRange(target,1,1,values.length).setValues([values]);SpreadsheetApp.flush();
}
function readSettings_(){const value=database_().getSheetByName('Settings').getRange(2,2).getValue();ensure_(value,'NOT_CONFIGURED','O serviço ainda não foi inicializado.');return JSON.parse(value);}
function publicConfig_(config){return {eventName:config.eventName,edition:config.edition,submissionDeadline:config.submissionDeadline,reviewDeadline:config.reviewDeadline,correctionDeadline:config.correctionDeadline,eventDate:config.eventDate,eventLocation:config.eventLocation,contactEmail:config.contactEmail,templateUrl:config.templateUrl,submissionsOpen:config.submissionsOpen,advisors:config.advisors};}
function database_(){return SpreadsheetApp.openById(requiredProperty_('SPREADSHEET_ID'));}
function audit_(user,action,id,details){try{database_().getSheetByName('Audit').appendRow([new Date().toISOString(),safeCell_(user.email),action,id,safeCell_(details)]);}catch(err){console.error('WPIES audit write failed');}}
function fileTrash_(id){try{DriveApp.getFileById(id).setTrashed(true);}catch(err){console.error('WPIES orphan cleanup failed');}}
function isSubmissionOpen_(c,now){return c.submissionsOpen===true&&Number.isFinite(Date.parse(c.submissionDeadline))&&now<=Date.parse(c.submissionDeadline);}
function canRevise_(r,c,now){return r.status==='received'?isSubmissionOpen_(c,now):r.status==='changes_requested'&&now<=Date.parse(c.correctionDeadline||c.submissionDeadline);}
function isFuture_(value){return !!value&&Number.isFinite(Date.parse(value))&&Date.now()<=Date.parse(value);}
function requiredDate_(value,label){ensure_(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(value)&&/(Z|[+-]\d{2}:\d{2})$/.test(value)&&Number.isFinite(Date.parse(value)),'BAD_REQUEST',label+' inválido.');return new Date(value).toISOString();}
function optionalDate_(value,label){return value?requiredDate_(value,label):'';}
function isInstitutional_(email){return typeof email==='string'&&/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@unipampa\.edu\.br$/i.test(email)&&email.length<=254;}
function text_(value,min,max,label){ensure_(typeof value==='string','BAD_REQUEST',label+' inválido.');const s=value.trim();ensure_(s.length>=min&&s.length<=max,'BAD_REQUEST',label+' deve ter entre '+min+' e '+max+' caracteres.');return s;}
function safeCell_(value){const s=String(value||'');return /^[\s]*[=+@\-]/.test(s)?"'"+s:s;}
function requiredProperty_(key){const value=PropertiesService.getScriptProperties().getProperty(key);ensure_(value,'NOT_CONFIGURED','Configuração pendente no serviço: '+key+'.');return value;}
function siteUrl_(){const value=requiredProperty_('SITE_URL');ensure_(/^https:\/\/[a-zA-Z0-9.-]+(?::\d+)?\/[a-zA-Z0-9_./%-]*$/.test(value)&&value.endsWith('/')&&!value.includes('..'),'NOT_CONFIGURED','SITE_URL deve ser uma URL HTTPS com a pasta do projeto e barra final.');return value;}
function siteOrigin_(){return siteUrl_().match(/^https:\/\/[^/]+/)[0];}
function randomToken_(){return (Utilities.getUuid()+Utilities.getUuid()+Utilities.getUuid()).replace(/-/g,'');}
function digest_(value){return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(value))).replace(/=+$/,'');}
function ok_(data){return {ok:true,data:data};}
function ensure_(condition,code,message){if(!condition)fail_(code,message);}
function fail_(code,message){const err=new Error(message);err.publicCode=code;throw err;}
