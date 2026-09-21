/* ============================================================
   KNO — helpers do catálogo de imóveis
   Usado pela home (destaques), por imoveis.html e por imovel.html.
   ============================================================ */
(function (global) {
  "use strict";

  var STATUS_UNIDADE = {
    disponivel: { label: "Disponível", cls: "st-disponivel" },
    reservado:  { label: "Reservado",  cls: "st-reservado" },
    vendido:    { label: "Vendido",    cls: "st-vendido" }
  };

  var STATUS_EMPREENDIMENTO = {
    lancamento: "Lançamento",
    em_obras:   "Em obras",
    pronto:     "Pronto para morar"
  };

  var TIPO = { casa: "Casa", apartamento: "Apartamento" };

  function esc(v) {
    if (v === null || v === undefined) return "";
    return String(v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function moeda(v) {
    if (v === null || v === undefined || v === "") return "Sob consulta";
    var n = Number(v);
    if (!isFinite(n)) return "Sob consulta";
    return n.toLocaleString("pt-BR", {
      style: "currency", currency: "BRL",
      minimumFractionDigits: 0, maximumFractionDigits: 0
    });
  }

  function area(v) {
    if (v === null || v === undefined || v === "") return null;
    var n = Number(v);
    if (!isFinite(n)) return null;
    return n.toLocaleString("pt-BR", { maximumFractionDigits: 0 }) + " m²";
  }

  function data(v) {
    if (!v) return "";
    var d = new Date(v);
    return isNaN(d) ? "" : d.toLocaleDateString("pt-BR") + " " +
      d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  function param(nome) {
    return new URLSearchParams(global.location.search).get(nome);
  }

  function fotos(u) {
    return (u && Array.isArray(u.fotos)) ? u.fotos.filter(Boolean) : [];
  }

  /** Imagem de capa ou um desenho de fachada como espaço reservado. */
  function capaHTML(u, alt) {
    var f = fotos(u);
    if (f.length) {
      return '<img src="' + esc(f[0]) + '" alt="' + esc(alt || u.titulo) + '" loading="lazy" />';
    }
    return '<svg class="sem-foto" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
      '<path d="M60 300V150l140-80 140 80v150"/><rect x="170" y="215" width="60" height="85"/>' +
      '<rect x="100" y="175" width="52" height="46"/><rect x="248" y="175" width="52" height="46"/>' +
      '<path d="M20 152L200 50l180 102"/></svg>';
  }

  function specs(u) {
    var out = [];
    if (u.quartos)   out.push(u.quartos + (u.quartos > 1 ? " quartos" : " quarto"));
    if (u.suites)    out.push(u.suites + (u.suites > 1 ? " suítes" : " suíte"));
    if (u.banheiros) out.push(u.banheiros + (u.banheiros > 1 ? " banheiros" : " banheiro"));
    if (u.vagas)     out.push(u.vagas + (u.vagas > 1 ? " vagas" : " vaga"));
    var a = area(u.area_m2);
    if (a) out.push(a);
    return out;
  }

  /** Card de unidade usado nas listagens. `emp` é o registro do empreendimento (opcional). */
  function cardUnidade(u, emp) {
    var st = STATUS_UNIDADE[u.status] || STATUS_UNIDADE.disponivel;
    var local = [];
    if (emp && emp.nome) local.push(emp.nome);
    if (emp && emp.bairro) local.push(emp.bairro);
    if (emp && emp.cidade) local.push(emp.cidade);

    return '' +
      '<a class="uni-card" href="imovel.html?id=' + encodeURIComponent(u.id) + '">' +
        '<div class="uni-foto">' + capaHTML(u) +
          '<span class="uni-tipo">' + esc(TIPO[u.tipo] || u.tipo) + '</span>' +
          '<span class="uni-status ' + st.cls + '">' + st.label + '</span>' +
        '</div>' +
        '<div class="uni-body">' +
          (local.length ? '<p class="uni-local">' + esc(local.join(" · ")) + '</p>' : '') +
          '<h3>' + esc(u.titulo) + '</h3>' +
          '<p class="uni-preco">' + moeda(u.preco) + '</p>' +
          '<ul class="uni-specs">' +
            specs(u).map(function (s) { return '<li>' + esc(s) + '</li>'; }).join("") +
          '</ul>' +
        '</div>' +
      '</a>';
  }

  /** Busca as unidades em destaque (usado na home). */
  function carregarDestaques(alvo, limite) {
    var box = typeof alvo === "string" ? document.querySelector(alvo) : alvo;
    if (!box || !global.KNOdb || !global.KNOdb.pronto()) return Promise.resolve(0);

    return global.KNOdb.client
      .from("unidades")
      .select("*, empreendimentos(nome,bairro,cidade)")
      .eq("destaque", true)
      .neq("status", "vendido")
      .order("criado_em", { ascending: false })
      .limit(limite || 3)
      .then(function (r) {
        if (r.error) throw r.error;
        var lista = r.data || [];
        if (!lista.length) return 0;
        box.innerHTML = lista.map(function (u) {
          return cardUnidade(u, u.empreendimentos);
        }).join("");
        var sec = box.closest ? box.closest("section") : null;
        if (sec) sec.hidden = false;
        return lista.length;
      })
      .catch(function (e) {
        if (global.console) console.warn("[KNO] destaques:", e.message || e);
        return 0;
      });
  }

  global.KNOcat = {
    STATUS_UNIDADE: STATUS_UNIDADE,
    STATUS_EMPREENDIMENTO: STATUS_EMPREENDIMENTO,
    TIPO: TIPO,
    esc: esc, moeda: moeda, area: area, data: data, param: param,
    fotos: fotos, capaHTML: capaHTML, specs: specs,
    cardUnidade: cardUnidade, carregarDestaques: carregarDestaques
  };
})(window);
