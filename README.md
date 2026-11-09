# Reencontro

MVP acadêmico do desafio CitizenTech da FIAP. A base inclui 100 casos fictícios e 200 retratos sintéticos. O fluxo de revisão só aceita categorias de teste.

## Abrir no VS Code

1. Extraia o ZIP mantendo a estrutura das pastas.
2. No VS Code, use **Arquivo → Abrir Pasta** e selecione `Reencontro`.
3. Abra o terminal do VS Code na pasta do projeto e rode o servidor local. Use o servidor para testar a busca por foto e a persistência da fila.

```powershell
py -m http.server 8000
```

Se o comando `py` não estiver disponível, use `python -m http.server 8000` com o Python instalado. Acesse `http://localhost:8000` no navegador e use `Ctrl+C` no terminal para parar o servidor. O projeto usa HTML, CSS e JavaScript e dispensa instalação de pacotes. A câmera depende de permissão do navegador e de HTTPS ou localhost. Em um celular separado, use a URL HTTPS de uma hospedagem. Em um totem, conecte uma câmera ao computador e abra a mesma tela.

## Demonstrar em 90 segundos

1. Em **Consulta**, teste `Santana 2 anos` na busca por características. Depois abra **Buscar por foto**.
2. Escolha **Foto de um caso fictício** e clique em **Buscar imagens semelhantes**. A amostra deve sugerir o SIM-001. Abra a ficha e mostre o retrato fictício aos 2 anos em 2000 e a simulação aos 28 em 2026.
3. Volte à busca por foto, escolha **Imagem de teste sem par** e faça a busca. Solicite um cadastro preenchendo dados inventados.
4. Em **Fila de revisão**, confirme que a solicitação entrou como **Aguardando revisão**. Clique em **Simular revisão** e veja o indicador de pendências mudar.

## Arquivos do projeto

| Caminho | Conteúdo |
|---|---|
| `index.html` | Estrutura das telas e da ficha |
| `styles.css` | Layout responsivo e estilos |
| `app.js` | Filtros, ficha, fila simulada e indicadores |
| `foto.js` e `foto-ui.js` | Comparação visual local, captura e respostas da busca por foto |
| `data/casos.json` | Base em formato JSON para integração |
| `data/casos.js` | Mesma base em um script para abrir o site diretamente no navegador |
| `assets/retratos/` | Dois retratos sintéticos por caso |

Ao atualizar a base, mantenha `casos.json` e `casos.js` sincronizados. Cada caso tem um `id` no formato `SIM-001`. A fila guarda protocolos com `id`, `caseId`, `category` e `status` ou solicitações com `kind: cadastro`, `name`, `age`, `zone` e `status`. O navegador mantém a fila localmente, por origem, na chave `reencontro-protocolos-v1`. A foto escolhida ou capturada fica em memória durante a consulta e é liberada ao removê-la. O cadastro de teste não incorpora a foto nem publica um novo caso.

A busca visual compara padrões de luminosidade da imagem inteira e retorna até três candidatas. Use uma foto sintética da base ou uma cópia bem enquadrada para a demonstração. Não há reconhecimento facial, validação de identidade ou evidência de acurácia em fotos reais. Iluminação, reflexos, ângulo e recorte podem mudar o resultado. A classificação de visão computacional exigida pela disciplina continua sendo uma etapa própria do projeto.

## Publicação para a banca

Use o conteúdo desta pasta como raiz de hospedagem estática. Na URL pública, teste a abertura da ficha e o percurso completo em janela anônima antes de gravar. Os dados e retratos da demonstração são sintéticos. Os componentes externos das outras disciplinas constam no documento do projeto como etapas de integração.
