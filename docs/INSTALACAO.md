# Instalação no GitHub Pages e Google Workspace

O frontend não exige instalação de pacotes nem compilação. A parte privada precisa de uma implantação no Google Apps Script. Isso permite guardar os arquivos na conta do organizador sem expor permissões de escrita ou segredos no GitHub Pages.

## 1. Obter o endereço do site

1. Crie um repositório, por exemplo `wpies`, e envie o conteúdo deste projeto para ele.
2. Em **Settings → Pages**, escolha **GitHub Actions** como origem. O workflow já está incluído. Se o branch principal tiver outro nome, ajuste `branches: [main]` no workflow.
3. Aguarde a publicação e anote o endereço completo, com a barra final, por exemplo:

```text
https://SEU-USUARIO.github.io/wpies/
```

A origem desse exemplo é `https://SEU-USUARIO.github.io`, sem o caminho `/wpies/`. A origem identifica o domínio para o login; o endereço completo identifica a página e seus links de revisão.

## 2. Criar o cliente OAuth

Use a conta Google Workspace `@unipampa.edu.br` que será responsável pelo evento.

1. Abra [Google Cloud Console](https://console.cloud.google.com/) e crie ou selecione um projeto.
2. Configure **Google Auth Platform → Branding / Audience**. Quando disponível no projeto institucional, selecione público **Internal**. Cadastre o nome `2º WPIES · PPGES`, o e-mail de suporte e o contato do desenvolvedor.
3. Em **Data Access**, utilize apenas os escopos de login `openid`, `email` e `profile`. O navegador e o estudante não precisam autorizar acesso ao Drive.
4. Em **Clients**, crie um cliente OAuth do tipo **Web application**.
5. Em **Authorized JavaScript origins**, adicione a origem do site, por exemplo `https://SEU-USUARIO.github.io`.
6. Para o fluxo de código em popup, cadastre também a origem exata, sem caminho, nos **Authorized redirect URIs**, por exemplo `https://SEU-USUARIO.github.io`. O código usa esta mesma origem na troca do código OAuth. Se adotar domínio próprio, cadastre a nova origem e ajuste `SITE_URL`.
7. Anote o **Client ID** e o **Client secret**. O segredo será usado apenas nas Propriedades do Apps Script. Não o coloque em `config.js`, no repositório ou em capturas de tela públicas.

Se o projeto estiver no modo de teste externo, cadastre as contas de teste antes de homologar. O modo interno depende de o projeto pertencer à organização Google Workspace e das permissões concedidas pela instituição. As políticas do administrador podem exigir autorização do aplicativo.

## 3. Instalar o Apps Script

1. Em [script.google.com](https://script.google.com/), crie um projeto **independente**, conectado à conta institucional organizadora. Essa conta será a proprietária da pasta e da planilha.
2. Copie `google-apps-script/Code.gs` para o arquivo `Code.gs`.
3. Crie um arquivo **HTML** chamado exatamente `Bridge` e copie `google-apps-script/Bridge.html` para ele.
4. Em **Project Settings**, habilite a exibição do arquivo de manifesto `appsscript.json`. Substitua o conteúdo pelo manifesto deste projeto.
5. Em **Project Settings → Script properties**, cadastre:

| Propriedade | Valor |
| --- | --- |
| `CLIENT_ID` | Client ID OAuth, terminado em `.apps.googleusercontent.com` |
| `CLIENT_SECRET` | Segredo do mesmo cliente OAuth |
| `SITE_URL` | Endereço completo do GitHub Pages, incluindo o caminho do repositório e a barra final |

Não defina manualmente `SPREADSHEET_ID` ou `DRIVE_FOLDER_ID`. A inicialização cria os recursos e salva esses valores.

6. No editor, selecione e execute **`initializeProject`**. Autorize as permissões solicitadas para a conta organizadora.
7. A função cria a pasta privada `WPIES 2026 · Submissões privadas`, a planilha de gestão e as abas `Submissions`, `Settings` e `Audit`. A planilha fica dentro da pasta. O proprietário é obtido da conta em execução.

A função é idempotente: executá-la novamente preserva as submissões existentes. Caso a criação seja interrompida antes de concluir, confira a pasta e a planilha criadas antes de executar novamente, para evitar recursos órfãos.

Os serviços Drive, Sheets e Mail utilizados são nativos do Apps Script; não é necessário ativar os serviços avançados do Drive ou da Sheets API.

## 4. Implantar o Web App

1. Clique em **Deploy → New deployment**.
2. Escolha **Web app**.
3. Em **Execute as**, escolha **Me**, a conta organizadora.
4. Em **Who has access**, escolha **Anyone**, incluindo acesso anônimo à ponte técnica. O manifesto identifica essa opção como `ANYONE_ANONYMOUS`.
5. Autorize e copie a URL terminada em `/exec`.

Essa opção não libera os dados das submissões. Ela permite carregar o iframe de conexão a partir do GitHub Pages. A API exige uma sessão produzida pelo login Google para qualquer operação privada e verifica os papéis no servidor. Somente configurações públicas, como datas e a lista de orientadores, ficam disponíveis sem login.

**Não selecione “User accessing the web app”**: os arquivos devem ser gravados na conta do organizador. Uma implantação restrita por uma tela de login Google anterior ao iframe também não atende a esta integração, pois ela depende da ponte acessível sem essa tela.

Se a instituição não permitir publicar como “Anyone”, solicite à equipe responsável a liberação desta implantação ou um backend institucional equivalente. Essa restrição não pode ser corrigida apenas com HTML no GitHub Pages. Não amplie o compartilhamento da planilha ou da pasta como tentativa de contornar o bloqueio.

## 5. Conectar a interface

Edite somente os dois campos públicos de `config.js`:

```js
window.WPIES_CONFIG = Object.freeze({
  googleClientId: "SEU-CLIENT-ID.apps.googleusercontent.com",
  appsScriptUrl: "https://script.google.com/macros/s/SEU-DEPLOYMENT-ID/exec",
  // Mantenha o objeto defaults existente.
  defaults: { /* conteúdo original */ }
});
```

O exemplo acima é ilustrativo; preencha os campos no arquivo existente sem apagar `defaults`. Faça commit e aguarde a atualização do GitHub Pages. O script usa a origem configurada no servidor para aceitar a conexão; não habilita `*` no `postMessage`.

## 6. Configurar o evento

1. No site real, sem `?demo=...`, abra **Área do participante** e entre com a mesma conta que executou a inicialização.
2. O perfil de organização será reconhecido automaticamente.
3. Em **Configurações**, cadastre nome e e-mail institucional de cada orientador. Sem orientadores, o formulário de envio permanece indisponível.
4. Defina o prazo de revisão, o prazo de ajustes, se aplicável, e a data/local do evento. O prazo inicial de submissão é **20/11/2026 às 23h59**, horário de Brasília.
5. Adicione os organizadores. Apenas a conta proprietária pode alterar essa lista. As outras contas organizadoras recebem leitura da pasta e acesso administrativo pela plataforma; elas não recebem o segredo OAuth nem permissões de edição do script.
6. Salve. Os prazos são conferidos no servidor e a versão das configurações impede sobrescrever uma alteração feita por outra sessão.

O link permanente de um trabalho é:

```text
https://SEU-USUARIO.github.io/wpies/#/review/ID-DO-TRABALHO
```

Ele não contém senha, token ou permissão de acesso. Somente o autor, os organizadores e o orientador atribuído conseguem consultar o registro; apenas esse orientador pode registrar a decisão. O botão **Enviar para revisão** concede leitura do PDF ao orientador e envia o convite pela conta organizadora.

## Atualizar e operar

- **Alterações no frontend:** faça commit; o Pages republica.
- **Alterações no Apps Script:** salve, vá a **Deploy → Manage deployments → Edit → New version** e atualize a implantação existente, preservando a URL `/exec`.
- **Troca do endereço do site:** atualize `SITE_URL`, as origens/URIs do cliente OAuth e os links já comunicados. Os links fixos dependem de manter o endereço do site e os IDs.
- **Atualização visual dos prazos:** uma aba já aberta pode manter a configuração anterior. Recarregue a página; a validação definitiva sempre ocorre no servidor.
- **Sessão:** é mantida apenas em memória, por no máximo uma hora. Recarregar a página exige novo login. Evicção do cache Google também pode exigir novo login.
- **Falha ou demora no envio:** atualize a lista antes de tentar novamente. Uploads usam chave de idempotência, e o envio de convites possui proteção contra repetição. Nunca há reenvio automático em background.
- **Fim do evento:** exporte os registros necessários e trate retenção, arquivos e permissões pela conta organizadora. Não há exclusão destrutiva em lote no painel.

## Fontes técnicas

- [Google Identity Services: Code Model](https://developers.google.com/identity/oauth2/web/guides/use-code-model).
- [OpenID Connect: troca do código e identidade recebida diretamente do Google](https://developers.google.com/identity/openid-connect/openid-connect#obtainuserinfo).
- [Apps Script Web Apps](https://developers.google.com/apps-script/guides/web).
- [Comunicação cliente-servidor do HtmlService](https://developers.google.com/apps-script/guides/html/communication).
- [XFrameOptionsMode](https://developers.google.com/apps-script/reference/html/x-frame-options-mode).
- [GitHub Pages: fluxo personalizado](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
