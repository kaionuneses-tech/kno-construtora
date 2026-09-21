/* ============================================================
   KNO — listagem de imóveis com filtros (imoveis.html)

   Estratégia: o catálogo de uma construtora tem dezenas (não
   milhares) de unidades, então carregamos tudo uma vez e
   filtramos no navegador — filtro instantâneo, sem ida e volta
   ao servidor. Se um dia passar de ~500 unidades, vale migrar
   os filtros para a query do Supabase (.eq/.gte/.ilike).
   ============================================================ */
(function () {
  "use strict";

  var $ = function (s) { return document.querySelector(s); };
  var cat = window.KNOcat;

  var lista = $("#lista");
  var info = $("#resultadoInfo");
  var form = $("#filtros");

  var unidades = [];
  var empreendimentos = {};

  var F = {
    busca: $("#fBusca"), tipo: $("#fTipo"), emp: $("#fEmp"), quartos: $("#fQuartos"),
    preco: $("#fPreco"), status: $("#fStatus"), ordem: $("#fOrdem")
  };

  /* ---------- carregar ---------- */
  function carregar() {
    if (!window.KNOdb || !window.KNOdb.pronto()) {
      window.KNOdb && window.KNOdb.avisar(".page .wrap");
      lista.innerHTML = '<div class="vazio"><b>Catálogo indisponível</b>' +
        'Conecte o Supabase em <code>js/supabase-config.js</code> para listar os imóveis.</div>';
      info.textContent = "";
      return;
    }

    var db = window.KNOdb.client;
    Promise.all([
      db.from("empreendimentos").select("*").order("nome"),
      db.from("unidades").select("*").order("criado_em", { ascending: false })
    ]).then(function (res) {
      if (res[0].error) throw res[0].error;
      if (res[1].error) throw res[1].error;

      (res[0].data || []).forEach(function (e) { empreendimentos[e.id] = e; });
      unidades = res[1].data || [];

      // opções de empreendimento (só os que têm unidade)
      var usados = {};
      unidades.forEach(function (u) { if (u.empreendimento_id) usados[u.empreendimento_id] = true; });
      Object.keys(empreendimentos).forEach(function (id) {
        if (!usados[id]) return;
        var o = document.createElement("option");
        o.value = id;
        o.textContent = empreendimentos[id].nome;
        F.emp.appendChild(o);
      });

      lerURL();
      render();
    }).catch(function (e) {
      lista.innerHTML = '<div class="vazio"><b>Não foi possível carregar</b>' +
        cat.esc(e.message || String(e)) + '</div>';
      info.textContent = "";
    });
  }

  /* ---------- filtros ---------- */
  function aplicar() {
    var termo = (F.busca.value || "").trim().toLowerCase();
    var tipo = F.tipo.value;
    var emp = F.emp.value;
    var quartos = parseInt(F.quartos.value, 10) || 0;
    var precoMax = parseFloat(F.preco.value) || 0;
    var status = F.status.value;

    var out = unidades.filter(function (u) {
      var e = empreendimentos[u.empreendimento_id];

      if (status === "ativos") { if (u.status === "vendido") return false; }
      else if (status && u.status !== status) return false;

      if (tipo && u.tipo !== tipo) return false;
      if (emp && u.empreendimento_id !== emp) return false;
      if (quartos && (u.quartos || 0) < quartos) return false;
      if (precoMax && (!u.preco || Number(u.preco) > precoMax)) return false;

      if (termo) {
        var alvo = [u.titulo, u.descricao, e && e.nome, e && e.bairro, e && e.cidade]
          .filter(Boolean).join(" ").toLowerCase();
        if (alvo.indexOf(termo) === -1) return false;
      }
      return true;
    });

    var ordem = F.ordem.value;
    out.sort(function (a, b) {
      if (ordem === "preco_asc") return (Number(a.preco) || Infinity) - (Number(b.preco) || Infinity);
      if (ordem === "preco_desc") return (Number(b.preco) || 0) - (Number(a.preco) || 0);
      if (ordem === "area_desc") return (Number(b.area_m2) || 0) - (Number(a.area_m2) || 0);
      return new Date(b.criado_em || 0) - new Date(a.criado_em || 0);
    });

    return out;
  }

  function render() {
    var out = aplicar();

    if (!unidades.length) {
      lista.innerHTML = '<div class="vazio"><b>Nenhum imóvel cadastrado ainda</b>' +
        'Cadastre as unidades pelo painel <a href="admin.html" style="color:var(--gold-2)">admin.html</a>.</div>';
      info.textContent = "";
      return;
    }
    if (!out.length) {
      lista.innerHTML = '<div class="vazio"><b>Nenhum imóvel com esses filtros</b>' +
        'Tente ampliar a faixa de preço ou limpar os filtros.</div>';
      info.textContent = "0 de " + unidades.length + " imóveis";
      return;
    }

    lista.innerHTML = out.map(function (u) {
      return cat.cardUnidade(u, empreendimentos[u.empreendimento_id]);
    }).join("");
    info.textContent = out.length === unidades.length
      ? out.length + (out.length > 1 ? " imóveis disponíveis" : " imóvel disponível")
      : out.length + " de " + unidades.length + " imóveis";

    escreverURL();
  }

  /* ---------- filtros na URL (permite compartilhar o link filtrado) ---------- */
  function escreverURL() {
    var p = new URLSearchParams();
    Object.keys(F).forEach(function (k) {
      var v = F[k].value;
      if (v && !(k === "status" && v === "ativos") && !(k === "ordem" && v === "recentes")) p.set(k, v);
    });
    var qs = p.toString();
    history.replaceState(null, "", qs ? "?" + qs : location.pathname);
  }

  function lerURL() {
    var p = new URLSearchParams(location.search);
    Object.keys(F).forEach(function (k) {
      if (p.has(k)) F[k].value = p.get(k);
    });
  }

  /* ---------- eventos ---------- */
  var timer = 0;
  form.addEventListener("input", function (ev) {
    if (ev.target === F.busca) {
      clearTimeout(timer);
      timer = setTimeout(render, 200);
    } else render();
  });
  form.addEventListener("change", render);
  form.addEventListener("submit", function (e) { e.preventDefault(); });

  $("#fLimpar").addEventListener("click", function () {
    Object.keys(F).forEach(function (k) { F[k].value = ""; });
    F.status.value = "ativos";
    F.ordem.value = "recentes";
    render();
  });

  carregar();
})();
