# KNO — Construtora e Incorporadora

Site institucional + catálogo de imóveis da KNO. Site estático (HTML, CSS e JavaScript
puro, sem build) com uma animação 3D em Three.js dirigida pelo scroll e um painel
administrativo apoiado no Supabase.

## O que tem aqui

| Página | Descrição |
|---|---|
| `index.html` | Home. Uma casa é construída em 3D conforme a página rola — terreno, fundação, estrutura, alvenaria, cobertura, esquadrias, acabamento e entrega. Mostra também os imóveis em destaque e o formulário de contato. |
| `imoveis.html` | Catálogo com filtros por busca, tipo, empreendimento, quartos, preço e situação. |
| `imovel.html?id=` | Ficha do imóvel: galeria de fotos, dados e botão "Tenho interesse". |
| `admin.html` | Painel restrito (login por e-mail e senha): cadastro de empreendimentos e unidades, upload de fotos e leitura dos contatos recebidos. |

## Rodando

Sem instalação: abra o `index.html` no navegador.

Com servidor local (Windows, sem dependências):

```bash
powershell -NoProfile -ExecutionPolicy Bypass -File "servidor-local.ps1"
```

Depois acesse `http://localhost:5173/`.

## Banco de dados

O catálogo, o painel e os formulários usam **Supabase**. O passo a passo completo de
configuração está em [`docs/CONFIGURAR-SUPABASE.md`](docs/CONFIGURAR-SUPABASE.md), e o
schema (tabelas, RLS e Storage) em [`sql/schema.sql`](sql/schema.sql).

Sem as credenciais preenchidas em `js/supabase-config.js`, o site continua funcionando:
a animação 3D e todo o conteúdo institucional aparecem normalmente, apenas o catálogo
fica vazio e os formulários avisam que não conseguiram enviar.

## Tecnologias

Nenhuma instalação, nenhum build. Tudo por CDN:

- [Three.js](https://threejs.org/) r157 — cena 3D procedural (nenhum modelo externo: a casa inteira é gerada por código)
- [@supabase/supabase-js](https://supabase.com/docs/reference/javascript) v2 — banco, autenticação e storage
- Fontes Sora e Inter (Google Fonts)

## Documentação

- [`LEIA-ME.md`](LEIA-ME.md) — manual completo: como a animação funciona, o que editar em cada arquivo, o que substituir antes de publicar e como publicar.
- [`docs/CONFIGURAR-SUPABASE.md`](docs/CONFIGURAR-SUPABASE.md) — criação do projeto no Supabase, passo a passo.

---

© KNO Construtora e Incorporadora. Todos os direitos reservados.
