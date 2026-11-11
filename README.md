# 2º WPIES · PPGES / UNIPAMPA

Landing page e plataforma de apresentações para o 2º Workshop em Pesquisa e Inovação em Engenharia de Software. Frontend em HTML, CSS e JavaScript, pronto para GitHub Pages, sem build e sem banco de dados externo contratado. Os registros ficam no Google Sheets e os PDFs no Drive da conta organizadora; o Google Apps Script executa as operações privadas.

## Começar

1. Abra `index.html` para conhecer a landing page.
2. Para explorar o sistema, abra `index.html?demo=organizer#/admin` em um servidor estático ou clique em **Explorar demonstração** no rodapé. Use a barra superior para alternar entre organização, orientador e estudante. Os dados são fictícios; não há uploads nem e-mails reais nesse modo.
3. Para ativar o sistema real, siga [o guia de instalação](docs/INSTALACAO.md). São necessários um cliente OAuth do Google e uma implantação do Apps Script, criados na conta institucional responsável.

**O projeto é entregue sem credenciais e sem uma implantação vinculada à sua conta.** O login, o Drive, o Sheets e o envio real de convites serão ativados depois dessa configuração. Não há simulação de sucesso no modo real quando a configuração está ausente.

## O que está implementado

- Landing responsiva com a logomarca oficial, azul `#05429D`, laranja `#FE7B16` e fonte Inter local.
- Chamada no topo, prazo inicial em **20/11/2026 às 23h59, horário de Brasília**, template oficial e explicação das modalidades.
- Login Google restrito, no servidor, a `@unipampa.edu.br`, com domínio Workspace e e-mail verificado.
- Formulário com orientador obrigatório, referências de origem, declaração de natureza do texto e PDF de 4 a 6 páginas, até 10 MB.
- Acompanhamento do autor e envio de novas versões nos estados e prazos permitidos.
- Dashboard, pesquisa, filtros, distribuição por situação e exportação CSV da lista filtrada.
- Configurações de submissão, revisão, ajustes, data/local do evento, orientadores, contato e organizadores.
- Convite por e-mail com link fixo por trabalho. Apenas o orientador atribuído registra o parecer e o aceite.
- Histórico de pareceres e versões; checagem de concorrência por versão; bloqueio de decisões fora do prazo.
- PDFs privados no Drive do proprietário. Organizadores têm acesso pela pasta; estudante e orientador recebem acesso individual aos arquivos pertinentes.
- Auditoria administrativa e proteção contra repetição acidental de uploads e convites.

## Arquivos

| Caminho | Finalidade |
| --- | --- |
| `index.html`, `css/`, `js/`, `assets/` | Site estático, com dependências visuais locais |
| `config.js` | Somente o ID OAuth público e a URL pública do Apps Script |
| `google-apps-script/Code.gs` | Autenticação, regras, Drive, Sheets e e-mails |
| `google-apps-script/Bridge.html` | Ponte segura entre GitHub Pages e Apps Script |
| `google-apps-script/appsscript.json` | Manifesto e permissões da conta organizadora |
| `.github/workflows/pages.yml` | Publicação estática pelo GitHub Actions |
| `docs/INSTALACAO.md` | Instalação com os valores e as telas necessários |
| `docs/ARQUITETURA.md` | Regras de acesso, estados, decisões e limitações |
| `docs/VALIDACAO.md` | Verificações executadas e teste da integração real |
| `tests/` | Testes automatizados com serviços Google simulados |

## Decisões de conteúdo

O evento é interno ao PPGES. São aceitos relatos de pesquisas já publicadas, relatórios ou compilados de trabalhos em andamento e amostras de conteúdo de pré-print submetido. Em todos os casos, o material deve identificar sua natureza e as fontes de origem. O envio ao WPIES não constitui submissão original que substitua a submissão para conferências ou periódicos.

Data e local do encontro, prazo de revisão e prazo de ajustes ficam sem valores reais até a organização defini-los. A lista de orientadores de produção começa vazia para evitar encaminhamentos a contas presumidas. Não foram utilizados nomes ou e-mails reais de professores como dados de exemplo.

## Publicar

Em **Settings → Pages**, escolha **GitHub Actions**. O workflow publica somente os arquivos públicos da interface. Também é possível publicar a raiz do branch `main` com `.nojekyll`. Os links usam fragmentos (`#/review/ID`), portanto funcionam em repositórios de projeto do GitHub Pages sem regras de reescrita.

O site estático pode ser público; acesso a submissões e arquivos continua sujeito à autenticação e às regras do backend. Não coloque segredos, PDFs reais, exportações de submissões ou dados da planilha no repositório.

## Verificar

Com Node.js instalado, execute na raiz:

```sh
node --test tests/*.test.cjs
```

Os testes locais usam doubles dos serviços Google e não enviam mensagens. O roteiro de homologação com contas institucionais está em [VALIDACAO.md](docs/VALIDACAO.md).

## Créditos

Identidade e logomarca: [PPGES / UNIPAMPA](https://cursos.unipampa.edu.br/cursos/ppges/identidade-visual/), consultada em 08/11/2026. A marca foi preservada como arquivo oficial. Inter: Rasmus Andersson, SIL Open Font License. PDF parser: pdf-lib 1.17.1, licença MIT incluída em `assets/vendor/`. O template é aberto pelo [link oficial fornecido](https://pt.overleaf.com/read/bybwwbcbhhwn#86f79a); seu conteúdo não foi incorporado nem alterado.
