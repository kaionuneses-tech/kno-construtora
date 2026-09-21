/* ============================================================
   KNO — Configuração do Supabase
   ------------------------------------------------------------
   PREENCHA AS DUAS LINHAS ABAIXO com os dados do seu projeto:
   Supabase → Project Settings → Data API (ou API) → "Project URL"
   e "anon public".

   A chave "anon" é pública de propósito: ela pode ficar aqui, no
   código do site. Quem protege os dados é o RLS (veja sql/schema.sql).
   NUNCA coloque aqui a chave "service_role".
   ============================================================ */

window.KNO_SUPABASE_URL = "https://SEU-PROJETO.supabase.co";
window.KNO_SUPABASE_ANON_KEY = "SUA-CHAVE-ANON-AQUI";

/* Bucket do Storage onde ficam as fotos (criado pelo sql/schema.sql) */
window.KNO_BUCKET = "imoveis";

/* ------------------------------------------------------------
   A partir daqui não precisa mexer.
   ------------------------------------------------------------ */
(function (global) {
  "use strict";

  var url = global.KNO_SUPABASE_URL || "";
  var key = global.KNO_SUPABASE_ANON_KEY || "";

  var preenchido =
    url.indexOf("SEU-PROJETO") === -1 &&
    key.indexOf("SUA-CHAVE") === -1 &&
    /^https:\/\/.+\.supabase\.(co|in)$/.test(url) &&
    key.length > 20;

  var client = null;
  var erro = null;

  if (!preenchido) {
    erro = "Supabase ainda não configurado: edite js/supabase-config.js com a URL e a chave anon do seu projeto.";
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
