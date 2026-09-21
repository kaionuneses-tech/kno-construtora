/* ============================================================
   KNO — ficha do imóvel (imovel.html?id=...)
   Galeria + dados da unidade + formulário que grava em `leads`.
   ============================================================ */
(function () {
  "use strict";

  var cat = window.KNOcat;
  var box = document.getElementById("conteudo");
  var id = cat.param("id");

  var unidade = null, empreendimento = null;
  var fotos = [], atual = 0;

  function erro(titulo, texto) {
    box.innerHTML = '<div class="vazio"><b>' + cat.esc(titulo) + '</b>' + cat.esc(texto) +
      '<div style="margin-top:22px"><a href="imoveis.html" class="btn btn-ghost">Ver todos os imóveis</a></div></div>';
  }

  if (!id) { erro("Imóvel não informado", "O link precisa terminar com ?id= seguido do código do imóvel."); return; }

  if (!window.KNOdb || !window.KNOdb.pronto()) {
    window.KNOdb && window.KNOdb.avisar(".page .wrap");
    erro("Catálogo indisponível", "Conecte o Supabase em js/supabase-config.js para abrir a ficha.");
    return;
  }

  var db = window.KNOdb.client;

  db.from("unidades").select("*, empreendimentos(*)").eq("id", id).maybeSingle()
    .then(function (r) {
      if (r.error) throw r.error;
      if (!r.data) { erro("Imóvel não encontrado", "Ele pode ter sido vendido e retirado do site."); return; }
      unidade = r.data;
      empreendimento = r.data.empreendimentos || null;
      fotos = cat.fotos(unidade);
      document.title = unidade.titulo + " — KNO Construtora e Incorporadora";
      render();
      carregarRelacionados();
    })
    .catch(function (e) { erro("Não foi possível carregar", e.message || String(e)); });

  /* ---------------- render ---------------- */
  function render() {
    var u = unidade, e = empreendimento;
    var st = cat.STATUS_UNIDADE[u.status] || cat.STATUS_UNIDADE.disponivel;

    var local = [];
    if (e) {
      if (e.nome) local.push(e.nome);
      if (e.bairro) local.push(e.bairro);
      if (e.cidade) local.push(e.cidade);
    }

    var specs = [
      { v: u.quartos, l: u.quartos > 1 ? "Quartos" : "Quarto" },
      { v: u.suites, l: u.suites > 1 ? "Suítes" : "Suíte" },
      { v: u.banheiros, l: u.banheiros > 1 ? "Banheiros" : "Banheiro" },
      { v: u.vagas, l: u.vagas > 1 ? "Vagas" : "Vaga" }
    ].filter(function (s) { return s.v; });
    var a = cat.area(u.area_m2);
    if (a) specs.push({ v: a, l: "Área privativa" });
    specs.push({ v: cat.TIPO[u.tipo] || u.tipo, l: "Tipo" });

    box.innerHTML = '' +
    '<div class="ficha">' +
      '<div>' +
        '<div class="galeria-main" id="galMain">' + galeriaMainHTML() + '</div>' +
        (fotos.length > 1 ? '<div class="galeria-thumbs" id="galThumbs">' +
          fotos.map(function (f, i) {
            return '<button type="button" class="' + (i === 0 ? "on" : "") + '" data-i="' + i +
              '" aria-label="Foto ' + (i + 1) + '"><img src="' + cat.esc(f) + '" alt="" loading="lazy" /></button>';
          }).join("") + '</div>' : '') +

        '<div class="ficha-sec">' +
          '<h1>' + cat.esc(u.titulo) + '</h1>' +
          (local.length ? '<p class="uni-local">' + cat.esc(local.join(" · ")) + '</p>' : '') +
          (u.descricao ? '<p class="ficha-desc">' + cat.esc(u.descricao) + '</p>' : '') +
        '</div>' +

        (e && e.descricao ? '<div class="ficha-sec">' +
            '<h2>Sobre o ' + cat.esc(e.nome) + '</h2>' +
            '<p class="ficha-desc" style="margin-top:0">' + cat.esc(e.descricao) + '</p>' +
            '<p class="uni-local" style="margin-top:14px">' +
              cat.esc(cat.STATUS_EMPREENDIMENTO[e.status] || e.status) + '</p>' +
          '</div>' : '') +

        '<div class="ficha-sec" id="relacionados" hidden>' +
          '<h2>Outras unidades deste empreendimento</h2>' +
          '<div class="uni-grid" id="relacionadosGrid"></div>' +
        '</div>' +
      '</div>' +

      '<aside class="ficha-side">' +
        '<div class="preco-box">' +
          '<span class="uni-status ' + st.cls + '" style="position:static;display:inline-block;margin-bottom:14px">' +
            st.label + '</span>' +
          '<p class="uni-preco">' + cat.moeda(u.preco) + '</p>' +
          '<div class="spec-grid">' +
            specs.map(function (s) {
              return '<div><b>' + cat.esc(s.v) + '</b><span>' + cat.esc(s.l) + '</span></div>';
            }).join("") +
          '</div>' +
          (u.status === "vendido"
            ? '<p class="form-note">Esta unidade já foi vendida. Fale com a gente para conhecer as disponíveis.</p>' +
              '<a href="imoveis.html" class="btn btn-ghost btn-block" style="margin-top:12px">Ver imóveis disponíveis</a>'
            : '<button type="button" class="btn btn-gold btn-block" id="btnInteresse">Tenho interesse</button>') +
        '</div>' +

        '<form class="contact-form" id="formInteresse" hidden>' +
          '<div class="field"><label for="iNome">Nome</label>' +
            '<input id="iNome" type="text" required placeholder="Como podemos te chamar?" /></div>' +
          '<div class="field"><label for="iEmail">E-mail</label>' +
            '<input id="iEmail" type="email" required placeholder="voce@email.com" /></div>' +
          '<div class="field"><label for="iFone">WhatsApp</label>' +
            '<input id="iFone" type="tel" placeholder="(00) 00000-0000" /></div>' +
          '<div class="field"><label for="iMsg">Mensagem</label>' +
            '<textarea id="iMsg" rows="3"></textarea></div>' +
          '<button type="submit" class="btn btn-gold btn-block">Enviar interesse</button>' +
          '<p class="form-note" id="iNota">Retornamos em até 1 dia útil.</p>' +
        '</form>' +
      '</aside>' +
    '</div>';

    ligarGaleria();
    ligarFormulario();
  }

  /* ---------------- galeria ---------------- */
  function galeriaMainHTML() {
    if (!fotos.length) return cat.capaHTML(unidade);
    return '<img id="galImg" src="' + cat.esc(fotos[0]) + '" alt="' + cat.esc(unidade.titulo) + '" />' +
      (fotos.length > 1
        ? '<button class="gal-nav gal-prev" type="button" aria-label="Foto anterior">‹</button>' +
          '<button class="gal-nav gal-next" type="button" aria-label="Próxima foto">›</button>' +
          '<span class="gal-contador" id="galCont">1 / ' + fotos.length + '</span>'
        : '');
  }

  function mostrar(i) {
    if (!fotos.length) return;
    atual = (i + fotos.length) % fotos.length;
    var img = document.getElementById("galImg");
    if (img) img.src = fotos[atual];
    var cont = document.getElementById("galCont");
    if (cont) cont.textContent = (atual + 1) + " / " + fotos.length;
    var thumbs = document.querySelectorAll("#galThumbs button");
    Array.prototype.forEach.call(thumbs, function (b, k) { b.classList.toggle("on", k === atual); });
  }

  function ligarGaleria() {
    var main = document.getElementById("galMain");
    if (!main) return;
    main.addEventListener("click", function (ev) {
      if (ev.target.closest(".gal-prev")) mostrar(atual - 1);
      else if (ev.target.closest(".gal-next")) mostrar(atual + 1);
    });
    var thumbs = document.getElementById("galThumbs");
    if (thumbs) thumbs.addEventListener("click", function (ev) {
      var b = ev.target.closest("button[data-i]");
      if (b) mostrar(parseInt(b.dataset.i, 10));
    });
    document.addEventListener("keydown", function (ev) {
      if (fotos.length < 2) return;
      if (ev.key === "ArrowLeft") mostrar(atual - 1);
      if (ev.key === "ArrowRight") mostrar(atual + 1);
    });
  }

  /* ---------------- interesse → leads ---------------- */
  function ligarFormulario() {
    var btn = document.getElementById("btnInteresse");
    var form = document.getElementById("formInteresse");
    if (!form) return;

    if (btn) btn.addEventListener("click", function () {
      form.hidden = false;
      btn.hidden = true;
      document.getElementById("iMsg").value =
        "Tenho interesse no imóvel: " + unidade.titulo + ". Gostaria de agendar uma visita.";
      document.getElementById("iNome").focus();
    });

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var nome = document.getElementById("iNome");
      var email = document.getElementById("iEmail");
      var nota = document.getElementById("iNota");
      var enviar = form.querySelector("button[type=submit]");

      var ok = true;
      [[nome, !nome.value.trim()], [email, !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.value)]]
        .forEach(function (p) { p[0].classList.toggle("invalid", p[1]); if (p[1]) ok = false; });
      if (!ok) { nota.textContent = "Preencha nome e e-mail válidos."; nota.classList.remove("ok"); return; }

      enviar.disabled = true;
      enviar.textContent = "Enviando…";

      db.from("leads").insert({
        nome: nome.value.trim(),
        email: email.value.trim(),
        whatsapp: document.getElementById("iFone").value.trim() || null,
        mensagem: document.getElementById("iMsg").value.trim() || null,
        unidade_id: unidade.id
      }).then(function (r) {
        if (r.error) throw r.error;
        form.innerHTML = '<div class="vazio" style="padding:36px 20px"><b>Interesse registrado</b>' +
          'A equipe da KNO vai entrar em contato em até 1 dia útil.</div>';
        if (window.KNOui) window.KNOui.toast("Interesse enviado com sucesso.", "ok");
      }).catch(function (e) {
        nota.textContent = "Não conseguimos enviar (" + (e.message || e) + "). Tente novamente.";
        nota.classList.remove("ok");
        enviar.disabled = false;
        enviar.textContent = "Enviar interesse";
      });
    });
  }

  /* ---------------- outras unidades do mesmo empreendimento ---------------- */
  function carregarRelacionados() {
    if (!unidade.empreendimento_id) return;
    db.from("unidades").select("*")
      .eq("empreendimento_id", unidade.empreendimento_id)
      .neq("id", unidade.id)
      .neq("status", "vendido")
      .limit(2)
      .then(function (r) {
        if (r.error || !r.data || !r.data.length) return;
        var sec = document.getElementById("relacionados");
        var grid = document.getElementById("relacionadosGrid");
        if (!sec || !grid) return;
        grid.innerHTML = r.data.map(function (u) { return cat.cardUnidade(u, empreendimento); }).join("");
        sec.hidden = false;
      });
  }
})();
