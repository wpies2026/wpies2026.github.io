(function(global){
  'use strict';
  const KEY='wpies:demo:v1';
  const clone=v=>JSON.parse(JSON.stringify(v));
  const advisors=[{name:'Orientadora de exemplo',email:'orientadora.demo@unipampa.edu.br'},{name:'Orientador de exemplo',email:'orientador.demo@unipampa.edu.br'}];
  function seed(){
    const titles=['IA generativa no apoio à revisão de requisitos','Avaliação de acessibilidade em sistemas acadêmicos','Observabilidade de aplicações distribuídas','Qualidade de software em equipes de pequeno porte','Detecção de vulnerabilidades no ciclo de desenvolvimento','Um estudo sobre colaboração em equipes de software','Testes automatizados em aplicações com aprendizado de máquina','Experiência do desenvolvedor em projetos de código aberto','Estratégias de evolução de sistemas legados','Rastreabilidade entre requisitos e testes','Engenharia de prompts para documentação técnica','Métricas de manutenibilidade em microsserviços'];
    const statuses=['received','in_review','accepted','changes_requested','received','accepted','in_review','received','not_accepted','accepted','received','in_review'];
    return {config:{...clone(global.WPIES_CONFIG.defaults),reviewDeadline:'2026-11-27T23:59:59-03:00',correctionDeadline:'2026-11-25T23:59:59-03:00',advisors,organizers:['organizacao.demo@unipampa.edu.br'],ownerEmail:'organizacao.demo@unipampa.edu.br',version:1},rows:titles.map((title,i)=>({id:'DEMO-'+String(i+1).padStart(3,'0'),title,authorName:i===0?'Estudante de exemplo':`Estudante fictício ${i+1}`,authorEmail:i===0?'aluno.demo@unipampa.edu.br':`estudante${i+1}.demo@unipampa.edu.br`,authorSub:i===0?'demo-student':`demo-${i}`,coauthors:'',advisorName:advisors[i%2].name,advisorEmail:advisors[i%2].email,kind:['progress','published','preprint'][i%3],track:global.WPIES.TRACKS[i%3],summary:'Este é um registro fictício para demonstrar a plataforma. O relatório reúne resultados da pesquisa e apresenta os próximos passos do trabalho desenvolvido no programa.',sources:'Exemplo demonstrativo: indicar aqui as referências das publicações e a situação dos trabalhos em andamento.',pageCount:4+(i%3),status:statuses[i],revision:1,createdAt:`2026-11-${String(5+i%4).padStart(2,'0')}T${String(10+i).padStart(2,'0')}:30:00-03:00`,updatedAt:'2026-11-08T13:00:00-03:00',fileName:'relatorio-demonstracao.pdf',fileUrl:'',versions:[],reviews:[],invitedAt:statuses[i]==='in_review'?'2026-11-08T13:00:00-03:00':'',lastInviteAt:'',requestId:'seed-'+i})),audit:[]};
  }
  class DemoApi {
    constructor(role){this.role=role;try{this.db=JSON.parse(localStorage.getItem(KEY))||seed();}catch{this.db=seed();}this.persist();this.session='demo';this.setRole(role);}
    setRole(role){this.role=['student','advisor','organizer'].includes(role)?role:'organizer';this.user=this.role==='organizer'?{sub:'demo-organizer',name:'Organização de exemplo',email:'organizacao.demo@unipampa.edu.br',roles:['student','organizer','owner']} : this.role==='advisor'?{sub:'demo-advisor',name:advisors[0].name,email:advisors[0].email,roles:['student','advisor']}:{sub:'demo-student',name:'Estudante de exemplo',email:'aluno.demo@unipampa.edu.br',roles:['student']};}
    persist(){try{localStorage.setItem(KEY,JSON.stringify(this.db));}catch{}}
    reset(){this.db=seed();this.persist();}
    login(){return Promise.resolve({user:this.user,session:'demo'});}
    logout(){return Promise.resolve();}
    async call(action,p={}){
      const c=this.db.config;const org=this.user.roles.includes('organizer');let row;
      if(action==='publicConfig')return clone(c);
      if(action==='me')return clone(this.user);
      if(action==='list')return clone(this.db.rows.filter(r=>p.scope==='admin'?org:(p.scope==='review'?r.advisorEmail===this.user.email&&!!r.invitedAt:r.authorSub===this.user.sub)));
      if(action==='settings'){if(!org)throw new Error('Acesso restrito à organização.');return clone(c);}
      if(action==='saveSettings'){if(!org)throw new Error('Acesso restrito.');if(p.version!==c.version)throw new Error('As configurações mudaram. Recarregue a página.');if(p.reviewDeadline&&Date.parse(p.reviewDeadline)<Date.parse(p.submissionDeadline))throw new Error('O prazo de revisão deve ser posterior ao prazo de submissão.');Object.assign(c,p,{version:c.version+1});this.persist();return clone(c);}
      if(action==='submit'){
        if(!global.WPIES.isOpen(c))throw new Error('As submissões estão encerradas.');
        row=this.db.rows.find(r=>r.requestId===p.requestId&&r.authorSub===this.user.sub);if(row)return clone(row);
        if(!p.declaration)throw new Error('Confirme a declaração de natureza do trabalho.');
        const a=c.advisors.find(a=>a.email===p.advisorEmail);if(!a)throw new Error('Selecione um orientador cadastrado.');
        const {file,...fields}=p;row={...fields,id:'DEMO-'+global.WPIES.uuid().slice(0,8),authorSub:this.user.sub,authorEmail:this.user.email,authorName:this.user.name,advisorName:a.name,status:'received',revision:1,pageCount:file.pageCount,fileName:file.name,fileUrl:'',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),reviews:[],versions:[],invitedAt:'',lastInviteAt:''};this.db.rows.unshift(row);this.persist();return clone(row);
      }
      row=this.db.rows.find(r=>r.id===p.id);if(!row)throw new Error('Submissão não encontrada.');
      const own=row.authorSub===this.user.sub;const assigned=row.advisorEmail===this.user.email&&row.status!=='received';
      if(!org&&!own&&!assigned)throw new Error('Você não tem acesso a esta submissão.');
      if(action==='get')return clone(row);
      if(action==='sendReview'){
        if(!org)throw new Error('Acesso restrito.');if(!c.reviewDeadline||Date.now()>Date.parse(c.reviewDeadline))throw new Error('Configure um prazo de revisão futuro.');
        if(!['received','in_review'].includes(row.status))throw new Error('Este trabalho já recebeu uma decisão.');
        row.status='in_review';row.invitedAt||=new Date().toISOString();row.lastInviteAt=new Date().toISOString();this.persist();return {record:clone(row),message:'Convite simulado. Nenhum e-mail foi enviado.'};
      }
      if(action==='review'){
        if(row.advisorEmail!==this.user.email)throw new Error('Apenas o orientador responsável pode registrar a decisão.');
        if(row.status!=='in_review'||row.revision!==p.revision)throw new Error('Este trabalho mudou. Atualize a página.');
        if(!c.reviewDeadline||Date.now()>Date.parse(c.reviewDeadline))throw new Error('O prazo de revisão foi encerrado.');
        if(!['accepted','changes_requested','not_accepted'].includes(p.decision)||!p.comment.trim())throw new Error('Informe a decisão e o parecer.');
        row.status=p.decision;row.reviews.push({decision:p.decision,comment:p.comment,reviewerName:this.user.name,reviewerEmail:this.user.email,revision:row.revision,createdAt:new Date().toISOString()});this.persist();return clone(row);
      }
      if(action==='revise'){
        if(!own||!global.WPIES.canEdit(row,c))throw new Error('O envio de nova versão está indisponível.');if(row.revision!==p.revision)throw new Error('Uma nova versão já foi registrada.');
        row.versions.push({revision:row.revision,fileName:row.fileName,fileUrl:'',pageCount:row.pageCount,createdAt:row.updatedAt});row.revision++;row.pageCount=p.file.pageCount;row.fileName=p.file.name;row.updatedAt=new Date().toISOString();row.status='received';this.persist();return clone(row);
      }
      throw new Error('Operação não disponível.');
    }
  }
  global.WPIES_DEMO={DemoApi};
})(window);
