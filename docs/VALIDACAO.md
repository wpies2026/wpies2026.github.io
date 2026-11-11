# Verificação da entrega

Data: 08/11/2026.

## Automatizado

Comando: `node --test tests/*.test.cjs`.

**37 testes passaram.** A suíte cobre a autenticação e o domínio institucional, a separação de papéis, o escopo das listas, a escolha obrigatória do orientador, a declaração do estudante, prazos, revisões e versões, validação de configurações, falhas de e-mail, revogação de sessão, prevenção de duplicatas, exportação CSV e escape de conteúdo.

O leitor de PDF foi exercitado com documentos reais gerados pelo pdf-lib, inclusive com object streams: arquivos de 4 e 6 páginas foram aceitos, e arquivos de 3 e 7 páginas foram rejeitados. Também foram verificados o limite de tamanho e arquivos disfarçados de PDF.

Os testes do backend utilizam serviços Google simulados. Eles não comprovam o funcionamento das permissões de uma conta Google real, a entrega de mensagens ou as políticas do Workspace.

## Verificação no navegador

- Landing page, tipografia local, marca oficial e chamada no topo.
- Dashboard com pesquisa de trabalhos e exibição de estados.
- Detalhe de submissão, confirmação e encaminhamento simulado ao orientador.
- Troca de perfil, acesso ao formulário de parecer e aceite com confirmação de formato.
- Exibição do parecer registrado no histórico e atualização dos totais.
- Formulário de configurações e salvamento dos prazos.
- Layout de largura móvel de 390 px em frames de verificação, com ajuste dos títulos e contenção da tabela em rolagem própria.

O modo de demonstração foi usado nessas operações; nenhum convite real foi enviado. A entrega não inclui uma implantação já autenticada no Google ou publicada na conta GitHub do usuário.

## Homologação após instalar na conta institucional

1. Entre como proprietário no site real e cadastre ao menos um orientador de teste com conta institucional.
2. Confirme que o prazo de submissão está aberto, que o de revisão é futuro e que o de ajustes permite respostas.
3. Entre como estudante institucional. Confira o nome e o e-mail obtidos do Google.
4. Envie um PDF de 4 a 6 páginas e confira o registro na planilha e o arquivo na pasta privada do organizador.
5. Como outro estudante, tente abrir o link do registro. A API deve negar acesso.
6. Como organização, abra o registro e clique em **Enviar para revisão**. Confira a entrega do convite na conta do orientador correto.
7. Como orientador, abra o link recebido, confira o PDF privado e registre um pedido de ajustes.
8. Como estudante, consulte o parecer e envie nova versão. Confira que o PDF anterior permanece no histórico e que a nova versão fica recebida, aguardando encaminhamento.
9. Encaminhe novamente e, como orientador, registre o aceite. O proprietário não deve conseguir decidir como se fosse o orientador.
10. Teste uma conta externa: ela deve ser recusada por domínio e e-mail verificado, mesmo conhecendo a URL do Apps Script.
11. Feche temporariamente os envios ou defina um prazo passado. Confira a recusa do backend, inclusive em abas já abertas.
12. Confira que a pasta e a planilha não estão compartilhadas com o público e que os PDFs só têm as permissões esperadas.

Estes passos dependem das credenciais, da implantação e das contas de homologação da instituição. Não foram marcados como executados nesta entrega.
