/* ============================================================
   KNO — Configuração do Supabase
   ------------------------------------------------------------
   PREENCHA AS DUAS LINHAS ABAIXO com os dados do seu projeto:

   Supabase → Project Settings → API Keys

   • URL  ......: Project Settings → Data API → "Project URL"
   • CHAVE .....: aba "Publishable and secret API keys"
                  → seção "Publishable key" → a chave "default"
                  (começa com sb_publishable_)

   A chave publishable é pública de propósito: ela pode ficar aqui,
   no código do site, e até num repositório aberto do GitHub. Quem
   protege os dados é o RLS (veja sql/schema.sql).

   >>> NUNCA use aqui a chave da seção "Secret keys" (sb_secret_...)
   >>> nem a legada "service_role": elas ignoram todas as regras de
   >>> segurança e dariam acesso total ao banco para qualquer um.
   >>> O código abaixo se recusa a funcionar se detectar uma delas.

   Projeto antigo? A chave legada "anon" (um JWT começando com eyJ...)
   continua funcionando aqui até o Supabase aposentá-la, no fim de 2026.
   ============================================================ */

window.KNO_SUPABASE_URL = "https://SEU-PROJETO.supabase.co";
window.KNO_SUPABASE_KEY = "SUA-CHAVE-PUBLISHABLE-AQUI";

/* Bucket do Storage onde ficam as fotos (criado pelo sql/schema.sql) */
window.KNO_BUCKET = "imoveis";

/* ------------------------------------------------------------
   A partir daqui não precisa mexer.
   ------------------------------------------------------------ */
(function (global) {
  "use strict";

  // Aceita tanto a "Project URL" quanto a "API URL" que aparece em Data API
  // (esta vem com /rest/v1/ no fim). A supabase-js monta esses caminhos sozinha.
  var url = String(global.KNO_SUPABASE_URL || "").trim()
    .replace(/\/(rest|auth|storage|realtime)\/v\d+\/?$/i, "")
    .replace(/\/+$/, "");

  var key = String(global.KNO_SUPABASE_KEY || global.KNO_SUPABASE_ANON_KEY || "").trim();

  var client = null;
  var erro = null;

  /** A chave é uma das que nunca podem aparecer no navegador? */
  function chavePerigosa(k) {
    if (/^sb_secret_/i.test(k)) return true;
    // JWT legado: o papel vem no payload (segunda parte, base64url)
    var partes = k.split(".");
    if (partes.length === 3) {
      try {
        var payload = atob(partes[1].replace(/-/g, "+").replace(/_/g, "/"));
        if (/"role"\s*:\s*"service_role"/.test(payload)) return true;
      } catch (e) { /* não é JWT legível: segue o baile */ }
    }
    return false;
  }

  var preenchido =
    url.indexOf("SEU-PROJETO") === -1 &&
    key.indexOf("SUA-CHAVE") === -1 &&
    /^https:\/\/.+\.supabase\.(co|in)$/.test(url) &&
    key.length > 20;

  if (chavePerigosa(key)) {
    erro = "CHAVE ERRADA: isso é uma chave secreta (secret / service_role) e ela ignora " +
           "todas as regras de segurança do banco. Nunca coloque essa chave no site — " +
           "troque pela chave da seção \"Publishable key\" (sb_publishable_...). " +
           "Se essa chave já foi publicada em algum lugar, gere uma nova no painel do Supabase.";
  } else if (!preenchido) {
    erro = "Supabase ainda não configurado: edite js/supabase-config.js com a URL e a chave publishable do seu projeto.";
  } else if (!global.supabase || typeof global.supabase.createClient !== "function") {
    erro = "A biblioteca do Supabase não carregou. Verifique a conexão com a internet ou a tag <script> do jsDelivr.";
  } else {
    try {
      client = global.supabase.createClient(url, key, {
        auth: { persistSession: true, autoRefreshToken: true }
      });
    } catch (e) {
      erro = "Falha ao iniciar o Supabase: " + e.message;
    }
  }

  global.KNOdb = {
    client: client,
    bucket: global.KNO_BUCKET || "imoveis",
    pronto: function () { return !!client; },
    erro: erro,

    /** Mostra um aviso no topo da página quando o banco não está configurado. */
    avisar: function (alvo) {
      if (client || !erro) return false;
      var box = document.createElement("div");
      box.className = "db-aviso";
      box.innerHTML = "<b>Banco de dados não conectado.</b> " + erro;
      var host = (typeof alvo === "string" ? document.querySelector(alvo) : alvo) || document.body;
      if (host.firstChild) host.insertBefore(box, host.firstChild);
      else host.appendChild(box);
      return true;
    }
  };

  if (erro && global.console) console.warn("[KNO]", erro);
})(window);
