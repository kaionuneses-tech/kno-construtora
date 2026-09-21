# Criando o projeto no Supabase — passo a passo

Guia completo, do zero até o primeiro imóvel cadastrado. Leva uns 15 minutos.

Você não precisa saber SQL: é copiar um arquivo e clicar em *Run*.

> **Um aviso antes de começar:** os nomes dos menus do Supabase mudam de tempos em
> tempos. Se algum botão estiver com nome levemente diferente do que está escrito aqui,
> procure pelo item mais parecido na mesma seção — a lógica continua a mesma.

---

## Passo 1 — Criar a conta e o projeto

1. Acesse **<https://supabase.com>** e clique em **Start your project**.
2. Entre com sua conta do **GitHub** (mais rápido) ou com e-mail e senha.
3. Na primeira vez, o Supabase pede para criar uma **organização**:
   - **Name:** `KNO` (ou o nome da empresa)
   - **Type:** `Company`
   - **Plan:** `Free`

   > **Já tem uma organização?** Pode usar a que você já tem, sem problema — organização
   > é só um agrupamento de cobrança e de membros, e os projetos dentro dela não
   > compartilham banco, URL nem chaves. Só confira duas coisas: (a) no plano Free, o
   > limite é de **2 projetos ativos por organização** — se já houver dois, crie uma
   > organização nova (é grátis); (b) **todo membro da organização enxerga todos os
   > projetos dela**, inclusive a tabela `leads` com os contatos recebidos pelo site —
   > se houver sócios ou terceiros nessa org, prefira uma organização separada.
4. Agora crie o projeto, clicando em **New project**:

   | Campo | O que preencher |
   |---|---|
   | **Name** | `kno-site` |
   | **Database Password** | Clique em *Generate a password* e **guarde essa senha** no gerenciador de senhas. Ela não é o login do painel do site, mas é a senha do banco — você pode precisar dela um dia e o Supabase não mostra de novo. |
   | **Region** | `South America (São Paulo)` — é a mais próxima, o site fica mais rápido |
   | **Pricing Plan** | `Free` |

5. Na seção **Security**, dessa mesma tela:

   | Opção | O que fazer |
   |---|---|
   | **Enable Data API** | ✅ **marcada** — é por essa API que o site conversa com o banco. Sem ela nada funciona. |
   | **Automatically expose new tables** | Tanto faz. O `sql/schema.sql` concede os privilégios explicitamente, então funciona das duas formas. Se quiser seguir a recomendação do Supabase, **desmarque**. |
   | **Enable automatic RLS** | ✅ **marcada** — faz toda tabela nova nascer protegida. |

6. Clique em **Create new project** e aguarde. O provisionamento leva de 1 a 3 minutos
   (aparece uma barra de progresso). Pode deixar a aba aberta.

---

## Passo 2 — Criar as tabelas (rodar o SQL)

1. No menu lateral esquerdo, clique em **SQL Editor** (ícone de uma folha com `>_`).
2. Clique em **New query** (ou no `+`).
3. Abra o arquivo **`sql/schema.sql`** desta pasta no Bloco de Notas, selecione tudo
   (`Ctrl+A`), copie (`Ctrl+C`) e cole na caixa do SQL Editor (`Ctrl+V`).
4. Clique em **Run** (ou pressione `Ctrl+Enter`).
5. Deve aparecer **Success. No rows returned** em verde, embaixo. É isso mesmo: o script
   cria estruturas, não devolve linhas.

O que acabou de ser criado:

- as tabelas **`empreendimentos`**, **`unidades`** e **`leads`**;
- as regras de segurança (**RLS**) que deixam o catálogo público para leitura, mas só
  permitem alterações a quem estiver logado;
- o **bucket `imoveis`** no Storage, onde as fotos ficam guardadas.

> Esse script pode ser rodado de novo quantas vezes quiser, sem duplicar nada nem
> apagar o que já existe.

**Confira:** clique em **Table Editor** no menu lateral. As três tabelas devem estar
lá, vazias.

---

## Passo 3 — Copiar as credenciais para o site

1. No menu lateral, vá em **Project Settings** (a engrenagem, no rodapé do menu).
2. Em **Data API**, copie o **Project URL** — algo como `https://abcdefghijkl.supabase.co`.
3. Vá em **API Keys**. A tela tem duas abas:

   | Aba | O que tem |
   |---|---|
   | **Publishable and secret API keys** | o sistema atual. É esta que você usa. |
   | **Legacy anon, service_role API keys** | o sistema antigo, que o Supabase vai aposentar no fim de 2026. Ignore. |

4. Na primeira aba, seção **Publishable key**, copie a chave chamada `default` —
   ela começa com **`sb_publishable_`**. É o botão de copiar ao lado dela.

   ⚠️ Logo abaixo tem a seção **Secret keys** (`sb_secret_...`). **Não é essa.**
   Aquela chave ignora todas as regras de segurança e daria acesso total ao seu banco
   para qualquer pessoa que visse o código do site.

5. Abra o arquivo **`js/supabase-config.js`** no Bloco de Notas. As duas primeiras
   linhas de código são estas:

   ```js
   window.KNO_SUPABASE_URL = "https://SEU-PROJETO.supabase.co";
   window.KNO_SUPABASE_KEY = "SUA-CHAVE-PUBLISHABLE-AQUI";
   ```

6. Substitua os dois valores pelos do seu projeto, **mantendo as aspas e o ponto e
   vírgula**. Deve ficar parecido com:

   ```js
   window.KNO_SUPABASE_URL = "https://abcdefghijkl.supabase.co";
   window.KNO_SUPABASE_KEY = "sb_publishable_TbMkoytCbIEWatMl0r6_Og_1FTx9...";
   ```

7. Salve o arquivo.

### Sobre a chave ser "pública"

A chave **publishable** aparece no código do site e qualquer pessoa consegue vê-la —
isso é esperado, não é falha. Nas palavras da própria documentação do Supabase:
*"Anyone can read it, so it only reaches what Row Level Security allows"*. Ou seja, ela
só faz o que as regras do `schema.sql` liberam: ler o catálogo e enviar um contato.
Não dá para alterar imóveis nem ler os leads com ela.

Por garantia, o `js/supabase-config.js` **se recusa a funcionar** se detectar que você
colou por engano uma chave secreta (`sb_secret_...` ou a legada `service_role`) — em vez
de conectar, ele mostra um aviso vermelho no site. Se isso acontecer com uma chave que
já foi publicada em algum lugar, gere uma nova no painel do Supabase.

### Não clique em "Disable JWT-based API keys"

Esse botão, na aba das chaves legadas, desliga o sistema antigo. Não mexa nele agora —
deixe para depois que o site estiver funcionando, se é que você vai querer mexer.
Nada no site depende das chaves legadas.

---

## Passo 4 — Criar o usuário do painel

Esse é o login que você vai usar no `admin.html`.

1. No menu lateral, clique em **Authentication**.
2. Vá em **Users** e clique em **Add user** → **Create new user**.
3. Preencha:
   - **Email:** o e-mail de quem vai administrar (ex.: `contato@knoconstrutora.com.br`)
   - **Password:** uma senha forte — guarde no gerenciador de senhas
   - **Auto Confirm User:** ✅ **marque esta caixa** (sem ela, o usuário fica pendente de
     confirmação por e-mail e não consegue entrar)
4. Clique em **Create user**.

### Feche a porta para cadastros de fora

Por padrão, o Supabase permite que qualquer pessoa crie uma conta. Como só a equipe da
KNO deve ter acesso, desligue isso:

1. Ainda em **Authentication**, vá em **Sign In / Providers** (ou **Providers**).
2. Abra **Email**.
3. Desmarque **Enable sign up** (ou **Allow new users to sign up**).
4. **Save**.

A partir daí, novos usuários só podem ser criados por você, aqui dentro do painel do
Supabase — repetindo o Passo 4.

---

## Passo 5 — Testar

1. Suba o site local:

   ```bash
   powershell -NoProfile -ExecutionPolicy Bypass -File "servidor-local.ps1"
   ```

2. Abra **<http://localhost:5173/admin.html>**.
3. Entre com o e-mail e a senha do Passo 4.
4. Na aba **Empreendimentos**, cadastre um: nome, bairro, cidade, status e uma capa.
5. Volte para a aba **Unidades** e cadastre uma unidade:
   - preencha o título, escolha o empreendimento, preço, quartos, área...
   - arraste 3 ou 4 fotos para a área pontilhada (elas são reduzidas e comprimidas
     automaticamente antes de subir);
   - marque **"Mostrar em destaque na página inicial"**;
   - clique em **Salvar unidade**.
6. Abra **<http://localhost:5173/imoveis.html>** — a unidade tem que aparecer.
7. Abra a ficha dela e clique em **Tenho interesse**, preencha e envie.
8. Volte ao `admin.html`, aba **Leads**: o contato que você acabou de enviar está lá.

Se os 8 itens funcionaram, está tudo certo.

---

## Problemas comuns

| O que aconteceu | Por quê / como resolver |
|---|---|
| O site diz "Supabase ainda não configurado" | A URL ou a chave em `js/supabase-config.js` continuam com o texto de exemplo, ou faltou salvar o arquivo. Atualize a página com `Ctrl+F5`. |
| "E-mail ou senha incorretos" mesmo com a senha certa | O usuário foi criado sem marcar *Auto Confirm User*. Apague o usuário e refaça o Passo 4. |
| Salvar dá erro "new row violates row-level security policy" | Sua sessão expirou. Saia e entre de novo no painel. |
| As fotos sobem mas aparecem quebradas no site | O bucket `imoveis` não ficou público. Vá em **Storage** → `imoveis` → ícone de engrenagem/`...` → **Make public**, ou rode o `sql/schema.sql` de novo. |
| O catálogo aparece vazio, mas há unidades cadastradas | Confira os filtros da página (a situação padrão esconde os vendidos). |
| Tudo parou de funcionar depois de algumas semanas | Veja abaixo — projeto pausado. |

---

## Duas coisas para saber sobre o plano gratuito

**1. O projeto pausa sozinho.** No plano Free, um projeto que fica **7 dias sem nenhum
acesso ao banco** é pausado automaticamente, e o site começa a dar erro. Reativar é
fácil (um botão *Restore project* no painel), mas o site fica fora do ar até alguém
perceber. Como um site de construtora recebe visitas o tempo todo, na prática isso
raramente acontece — mas se o site ainda não estiver divulgado, entre no painel do
Supabase de vez em quando. **Para o site em produção, vale o plano Pro** (US$ 25/mês),
que não pausa e ainda faz backup diário.

**2. Os limites do Free são folgados para este site:** 500 MB de banco (cabem dezenas
de milhares de imóveis — o banco guarda texto, não as fotos) e 1 GB de Storage (com a
compressão do painel, cada foto fica em torno de 200 KB, então dá para mais ou menos
5.000 fotos).

---

## Depois que estiver tudo funcionando

- Se você publicar o site (Netlify, Vercel, GitHub Pages...), lembre-se de subir o
  `js/supabase-config.js` **já preenchido** — é ele que conecta o site ao banco.
- Faça backup antes de mexer no SQL: **Database** → **Backups** no painel do Supabase.
- Para receber um e-mail a cada novo lead, dá para criar um *Database Webhook* na tabela
  `leads` apontando para um serviço de e-mail (Resend, SendGrid). Não está configurado.
