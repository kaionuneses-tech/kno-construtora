# KNO — Construtora e Incorporadora

Site institucional com uma animação 3D dirigida pelo scroll (conforme a página desce,
uma casa é construída do terreno até a entrega das chaves, no estilo das páginas de
produto da Apple) **+ um catálogo de imóveis com painel administrativo**, usando
Supabase como banco de dados.

Tudo é **estático** — não precisa de Node, build ou instalação. O Supabase entra pela
CDN, direto no navegador.

| Página | O que é |
|---|---|
| `index.html` | Home com a animação da obra, destaques do catálogo e formulário de contato |
| `imoveis.html` | Lista de imóveis com filtros (busca, tipo, empreendimento, quartos, preço, situação) |
| `imovel.html?id=` | Ficha do imóvel: galeria de fotos, dados e botão "Tenho interesse" |
| `admin.html` | Painel restrito: cadastro de empreendimentos, unidades, fotos e leitura dos leads |

---

## Como abrir

**Jeito mais simples:** dê dois cliques em `index.html`. Abre no navegador padrão e funciona.

**Com servidor local** (recomendado se quiser testar em celular na mesma rede, ou se o
navegador bloquear algo): clique com o botão direito em `servidor-local.ps1` →
"Executar com PowerShell", ou rode no terminal:

```bash
powershell -NoProfile -ExecutionPolicy Bypass -File "servidor-local.ps1"
```

Depois acesse `http://localhost:5173/`. Para parar, feche a janela do PowerShell.

---

## Estrutura

```
index.html              home (animação 3D + destaques + contato)
imoveis.html            catálogo com filtros
imovel.html             ficha de um imóvel (?id=...)
admin.html              painel administrativo

css/style.css           identidade visual inteira (navy + dourado da logo)

js/scene.js             cena 3D: a casa, o canteiro e a linha do tempo da obra
js/main.js              scroll → progresso da animação, legendas, contadores, contato
js/ui.js                menu, animações de entrada, ano do rodapé, avisos flutuantes
js/supabase-config.js   >>> SUAS CREDENCIAIS DO SUPABASE VÃO AQUI <<<
js/catalogo.js          formatações e o card de imóvel usados nas listagens
js/imoveis.js           filtros e listagem
js/imovel.js            galeria + formulário de interesse
js/admin.js             login, CRUD, upload de fotos e leads

sql/schema.sql          tabelas, índices, RLS e bucket do Storage
assets/logo.jpg         logo da KNO (cópia de "logo,png.jpeg")
servidor-local.ps1      servidor estático opcional
```

Dependências externas (todas por CDN, nenhuma instalação): **Three.js r157**,
**@supabase/supabase-js v2** e as fontes Sora/Inter do Google Fonts. O site precisa de
internet. Para deixá-lo independente da CDN, baixe os dois `.js` para `js/` e troque as
tags `<script>` no fim de cada página.

---

## Banco de dados (Supabase) — 5 passos

> **Versão detalhada, com cada clique:** [`docs/CONFIGURAR-SUPABASE.md`](docs/CONFIGURAR-SUPABASE.md).
> O resumo abaixo serve para consulta rápida depois que já estiver configurado.

Enquanto isso não for feito, o site funciona normalmente, mas o catálogo aparece vazio
e o formulário avisa que não conseguiu enviar.

1. **Crie o projeto** em [supabase.com](https://supabase.com) (o plano gratuito atende
   um catálogo desse porte). Anote a senha do banco.

2. **Rode o SQL**: no painel do Supabase, `SQL Editor` → `New query` → cole o conteúdo
   de `sql/schema.sql` → **Run**. Isso cria as três tabelas, os índices, as regras de
   acesso (RLS) e o bucket `imoveis` do Storage. Pode rodar de novo sem medo.

3. **Copie as credenciais**: `Project Settings` → `Data API`. Cole a *Project URL* e a
   chave *anon public* nas duas primeiras linhas de `js/supabase-config.js`.
   A chave anon é pública de propósito — quem protege os dados é o RLS. **Nunca** use
   aqui a chave `service_role`.

4. **Crie o usuário do painel**: `Authentication` → `Users` → `Add user` → informe
   e-mail e senha e marque *Auto Confirm User*. Esse é o login do `admin.html`.
   Recomendo também desligar `Authentication` → `Providers` → `Email` → *Enable signup*,
   para que ninguém crie conta sozinho.

5. **Teste**: abra `admin.html`, entre, cadastre um empreendimento e uma unidade com
   fotos. Ela aparece na hora em `imoveis.html` — e na home se você marcar "destaque".

### Como as permissões ficam

| Tabela | Visitante anônimo | Equipe logada |
|---|---|---|
| `empreendimentos` | só leitura | leitura e escrita |
| `unidades` | só leitura | leitura e escrita |
| `leads` | só inserir (não consegue ler) | só leitura |
| Storage `imoveis` | só leitura das fotos | upload, troca e exclusão |

Ou seja: mesmo que alguém leia o código do site e pegue a chave anon, não consegue
alterar o catálogo nem ler os contatos recebidos.

### Sobre as fotos

O painel **comprime cada imagem antes de enviar**: reduz para no máximo 1600px de
largura e converte para JPEG com qualidade 80% (uma foto de celular de 4 MB costuma
chegar ao servidor com ~200 KB). A primeira foto da lista é a capa — use o ★ para
promover outra. Fotos enviadas e depois removidas antes de salvar ficam órfãs no
Storage; se incomodar, dá para limpar pelo painel do Supabase.

---

## Como a animação funciona

O bloco `#journey` (hero + seção `.build`) tem cerca de **10 telas de altura**. O
`main.js` converte a posição do scroll dentro desse bloco em um progresso `p` de 0 a 1 e
entrega para a cena. A cena não anima com o tempo: ela é uma **função pura de `p`** —
por isso rolar para cima desconstrói a casa, e parar no meio congela a obra naquele ponto.

As 8 etapas (terreno → fundação → estrutura → alvenaria → cobertura → esquadrias →
acabamento → entrega) estão definidas em dois lugares que precisam continuar batendo:

- `js/scene.js` → objeto `T` (faixas de `p` de cada peça: sapatas, pilares, vigas...)
- `js/main.js` → array `STEPS` (em que `p` cada legenda troca)

A câmera é uma lista de keyframes no array `CAM` do `scene.js` (posição + ponto de
mira por `p`), interpolados e suavizados — é o que dá a sensação de travelling contínuo.

### Quero mexer em alguma coisa

| Objetivo | Onde |
|---|---|
| Texto das etapas | `index.html`, blocos `<article class="caption">` |
| Ritmo da obra (o que aparece quando) | `js/scene.js`, objeto `T` no topo |
| Ângulos de câmera | `js/scene.js`, array `CAM` |
| Tamanho/proporção da casa | `js/scene.js`, constantes `W`, `D`, `H1`, `H2`... |
| Janelas e portas | `js/scene.js`, as chamadas `buildWall(...)` com a lista `op(...)` |
| Cores da marca | `css/style.css`, variáveis em `:root` |
| Deixar o scroll mais curto/longo | `index.html`, quantidade de `<div class="build-spacer">` |
| Filtros do catálogo | `imoveis.html` (os `<select>`) e `js/imoveis.js` (função `aplicar`) |
| Aparência dos cards de imóvel | `js/catalogo.js`, função `cardUnidade` |
| Tamanho/qualidade das fotos enviadas | `js/admin.js`, constantes `MAX_LARGURA` e `QUALIDADE` |

---

## O que você precisa substituir antes de publicar

1. **Telefone, e-mail, endereço, CNPJ e CREA** — estão como `00000` em `index.html`
   (seção `#contato` e rodapé). São 5 ocorrências.
2. **Fotos dos projetos** — a seção "Projetos" usa desenhos em SVG como espaço
   reservado. Troque cada `<div class="proj-art art-N">…</div>` por
   `<img src="assets/obra-1.jpg" alt="..." />` e os dados de cada obra.
3. **Números da empresa** — `18+ anos`, `240 mil m²`, `63 obras`, `100% no prazo`
   estão nos atributos `data-to` da seção de estatísticas.
4. **Credenciais do Supabase** — sem elas o catálogo e o formulário não funcionam
   (veja a seção acima).

> O formulário de contato da home e o botão "Tenho interesse" da ficha gravam direto
> na tabela `leads`. Os contatos aparecem na aba **Leads** do `admin.html` — nenhum
> e-mail é disparado. Se quiser ser avisado por e-mail a cada novo contato, dá para
> criar um *Database Webhook* no Supabase apontando para o Resend/SendGrid; me chame
> que eu configuro.

---

## Publicação

Por ser estático, sobe em qualquer lugar: Netlify, Vercel, GitHub Pages, Cloudflare
Pages (é só arrastar a pasta) ou qualquer hospedagem com FTP. O back-end é o Supabase,
que já está na nuvem.

O `admin.html` vai junto com o site e é protegido por login — a página tem
`noindex` para não aparecer no Google. Se preferir, renomeie o arquivo para algo menos
óbvio; a segurança real continua sendo o login + RLS, não o nome do arquivo.

## Acessibilidade e desempenho

- Se o navegador não tiver WebGL, a cena some e o site continua inteiro (há um aviso
  com a logo no lugar do 3D).
- Em telas estreitas o `pixelRatio`, o antialiasing e o mapa de sombras são reduzidos,
  e o campo de visão abre para a casa caber.
- Quando o palco 3D sai de cena (ou a aba fica em segundo plano), o loop de render é
  pausado para não gastar bateria.
