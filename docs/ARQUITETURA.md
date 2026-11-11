# Arquitetura e regras

## Componentes

O GitHub Pages serve HTML, CSS, JavaScript, a fonte e a marca. O navegador carrega uma ponte HtmlService do Apps Script em um iframe. A ponte só recebe mensagens da origem configurada em `SITE_URL`, valida o canal por carregamento e chama o único ponto de entrada RPC `api`. O navegador valida a origem Google e que a janela de resposta pertence ao iframe carregado. As respostas retornam ao destino exato, sem usar `*`.

Esta abordagem evita depender de CORS e de respostas opacas de `fetch` nos redirecionamentos do Apps Script. Nenhum token de sessão, código OAuth ou PDF é colocado na URL do iframe. O parâmetro de canal é um identificador aleatório, não uma credencial.

O Apps Script executa como proprietário. Drive e Sheets são acessados pelo servidor, não por permissões Google concedidas pelos estudantes. A conta organizadora autoriza esses serviços ao instalar o script.

## Login

O frontend usa Google Identity Services no fluxo **authorization code**, em popup, com `openid email profile`. Um desafio de uso único, válido por cinco minutos e vinculado ao canal, prepara a troca do código. O servidor troca o código diretamente no endpoint HTTPS do Google, autenticando o cliente com `CLIENT_SECRET`, e confere os claims da resposta confiável: `aud`, `azp` quando presente, `iss`, `exp`, `iat`, `sub`, `email_verified`, o domínio `hd` e o sufixo exato de e-mail.

**O servidor não aceita um ID token ou claims enviados pelo navegador.** A extração de claims ocorre apenas sobre o token obtido pelo próprio servidor na resposta HTTPS do Google. Esta é a exceção explicitamente documentada pelo Google à necessidade de validar separadamente a assinatura de um token recebido de um cliente. Não é utilizado o endpoint de depuração `tokeninfo` como verificador de produção nem uma biblioteca criptográfica descontinuada.

O identificador principal do autor é `sub`, que é estável, e não apenas seu e-mail. A seleção de orientadores e organizadores utiliza os e-mails institucionais cadastrados pela organização.

A sessão da aplicação é um bearer opaco aleatório, armazenado apenas em memória no navegador. No servidor, seu hash referencia uma entrada no CacheService. Logout remove essa entrada; cache ausente ou expirado resulta em novo login. Não há cookies de sessão, tokens no localStorage, refresh tokens persistidos nem uso do token OAuth da conta organizadora no frontend. O armazenamento local da demonstração contém apenas dados fictícios.

## Permissões

| Operação | Estudante autor | Orientador atribuído | Organizador | Proprietário |
| --- | --- | --- | --- | --- |
| Enviar trabalho | Sim, no prazo | Como estudante | Como estudante | Como estudante |
| Consultar trabalho | Seus trabalhos | Após encaminhamento | Todos | Todos |
| Consultar PDF | Seus arquivos | Arquivos atribuídos | Pasta do evento | Pasta do evento |
| Enviar nova versão | Conforme estado e prazo | Não | Apenas se for o autor | Apenas se for o autor |
| Encaminhar convite | Não | Não | Sim | Sim |
| Registrar parecer/aceite | Não | Sim, no prazo | Apenas se também for o orientador atribuído | Apenas se também for o orientador atribuído |
| Alterar prazos/orientadores | Não | Não | Sim | Sim |
| Alterar organizadores | Não | Não | Não | Sim |

Autoavaliação é impedida no servidor. O aluno não escolhe e-mails livres de revisão; precisa selecionar um orientador cadastrado. Um ID de trabalho ou link não concede acesso. Os papéis são recalculados em cada operação, inclusive para sessões abertas antes de uma alteração administrativa.

Os organizadores recebem leitura da pasta de evento. Como a planilha está dentro dessa pasta, também podem consultar seus registros; a escrita ocorre pela API como proprietário. A retirada de um organizador remove sua permissão de leitura pela pasta. Permissões individuais que essa mesma pessoa tenha como autor ou orientador continuam pertinentes ao respectivo trabalho. A aplicação não utiliza compartilhamento “qualquer pessoa com o link”.

## Estados

| Situação atual | Ação | Próxima situação |
| --- | --- | --- |
| Sem registro | Autor envia PDF no prazo | Recebido |
| Recebido | Organização encaminha | Em revisão |
| Em revisão | Orientador aceita | Aceito |
| Em revisão | Orientador solicita ajustes, havendo prazo | Ajustes solicitados |
| Em revisão | Orientador não aceita | Não aceito |
| Recebido | Autor substitui PDF no prazo de submissão | Recebido, nova versão |
| Ajustes solicitados | Autor envia correção no prazo próprio | Recebido, nova versão |

Cada nova versão exige novo encaminhamento. Trabalhos em revisão aguardam decisão antes de substituição. Aceites e não aceites são finais para aquele registro. A organização pode estender os prazos; o painel não oferece sobreposição da decisão do orientador.

O prazo de revisão precisa ser igual ou posterior ao de submissão. Se houver prazo de correção, ele deve estar entre os dois. A solicitação de ajustes só pode ser feita enquanto ainda for possível ao estudante responder. Sem prazo de ajustes explícito, vale o prazo de submissão. A configuração “receber submissões” interrompe novos envios; correções solicitadas seguem o prazo próprio, mesmo se a chamada geral estiver fechada.

## PDFs e versões

O pdf-lib, incluído localmente, abre o PDF e conta as páginas no navegador. Arquivos de menos de 4 ou mais de 6 páginas, criptografados ou inválidos são bloqueados na interface. No servidor, o tamanho, a codificação Base64, a assinatura `%PDF-` e o intervalo declarado são novamente conferidos. O servidor **não tem um parser estrutural independente de PDF**; uma requisição adulterada pode mentir sobre a contagem. Por isso o aceite exige que o orientador confirme a leitura, as 4 a 6 páginas, o template e a natureza do texto. Não se tenta contar páginas com uma expressão regular, que falha em PDFs comprimidos.

O template e o conteúdo acadêmico são verificados pelo orientador. A declaração do estudante é obrigatória e sua versão fica registrada. A plataforma não publica os textos, não atribui DOI e não faz qualquer submissão a conferência ou periódico.

O arquivo enviado recebe nome gerado pelo servidor. O autor recebe leitura; no encaminhamento, o orientador recebe leitura. Os arquivos anteriores ficam no histórico, e o orientador que já havia sido convidado recebe também leitura de uma versão corrigida. A propriedade dos arquivos continua com a conta organizadora.

## Concorrência e rastreabilidade

- Operações de gravação usam `LockService` para impedir interleaving da mesma planilha.
- A revisão exige o número atual da versão; uma decisão sobre PDF substituído é rejeitada.
- Configurações usam uma versão otimista, evitando salvar sobre mudanças de outra sessão.
- Uploads têm identificadores de requisição para evitar duplicação em tentativas repetidas.
- Convites registram estado pendente, enviado ou falha, e usam intervalo mínimo de cinco minutos entre reenvios bem-sucedidos.
- O e-mail contém o endereço permanente do registro, sem token de acesso. E-mail e escrita em Sheets não são uma transação única: uma falha excepcional depois da entrega da mensagem e antes da confirmação pode exigir conferência manual. Não se promete entrega “exatamente uma vez”.
- A aba Audit registra autor, operação, trabalho e instante. Não recebe códigos OAuth, sessões ou PDFs.
- Dados de texto são escapados na interface. Células e exportações CSV neutralizam prefixos de fórmula.

## Limites e operação

Esta solução foi dimensionada para um evento interno. O Google Apps Script tem cotas de execução, e-mail, Drive e Sheets da conta proprietária. Existem limites do aplicativo de 10 MB por PDF, 10 trabalhos por conta e 10 versões por trabalho. O envio em Base64 aumenta o volume transferido em cerca de um terço. PDFs próximos ao limite podem demorar mais em redes móveis.

A demonstração testa a experiência, não as políticas reais do Workspace. O acesso anônimo à ponte técnica precisa ser permitido pelo administrador, assim como o cliente OAuth e o compartilhamento individual no Drive. Sem essa implantação, é possível navegar na landing page e no modo de demonstração, mas não autenticar nem enviar arquivos reais.

Planilha, pasta e projeto Apps Script devem permanecer sob controle da organização. Uma transferência de propriedade ou troca da conta que publica exige nova homologação de permissões e de envio de e-mails. Não edite diretamente o JSON da coluna `data` sem backup; as colunas anteriores são índices e a coluna JSON é o registro principal. Restrinja editores do script, pois eles podem acessar as Propriedades, incluindo o segredo OAuth.
