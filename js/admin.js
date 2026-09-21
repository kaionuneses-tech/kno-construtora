/* ============================================================
   KNO — painel administrativo (admin.html)
   Login por e-mail/senha, CRUD de empreendimentos e unidades,
   upload de fotos comprimidas para o Storage e leitura de leads.

   Toda a segurança está no RLS (sql/schema.sql): sem sessão
   autenticada o Supabase recusa qualquer escrita, mesmo que
   alguém abra este arquivo.
   ============================================================ */
(function () {
  "use strict";

  var cat = window.KNOcat;
  var ui = window.KNOui;
  var $ = function (id) { return document.getElementById(id); };
  var MAX_LARGURA = 1600;
  var QUALIDADE = 0.8;

  if (!window.KNOdb || !window.KNOdb.pronto()) {
    window.KNOdb && window.KNOdb.avisar(".page .wrap");
    var f = $("formLogin");
    if (f) {
      f.querySelectorAll("input,button").forEach(function (el) { el.disabled = true; });
      $("loginNota").textContent = "Configure js/supabase-config.js para usar o painel.";
    }
    return;
  }

  var db = window.KNOdb.client;
  var BUCKET = window.KNOdb.bucket;

  /* ---------------- estado ---------------- */
  var emps = [], unis = [], leads = [];
  var editandoUni = null, editandoEmp = null;
  var fotosUni = [];      // URLs públicas já enviadas
  var capaEmp = null;     // URL pública da capa
  var carregado = false;

  /* ============================================================
     AUTENTICAÇÃO
     ============================================================ */
  function aplicarSessao(session) {
    var logado = !!(session && session.user);
    $("login").hidden = logado;
    $("painel").hidden = !logado;
    $("btnSair").hidden = !logado;
    if (logado) {
      $("quemSou").textContent = session.user.email;
      if (!carregado) { carregado = true; carregarTudo(); }
    } else {
      carregado = false;
    }
  }

  db.auth.getSession().then(function (r) { aplicarSessao(r.data.session); });
  db.auth.onAuthStateChange(function (_evento, session) { aplicarSessao(session); });

  $("formLogin").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var nota = $("loginNota");
    var botao = ev.target.querySelector("button[type=submit]");
    nota.textContent = "Entrando…";
    nota.classList.remove("ok");
    botao.disabled = true;

    db.auth.signInWithPassword({
      email: $("lEmail").value.trim(),
      password: $("lSenha").value
    }).then(function (r) {
      if (r.error) throw r.error;
      nota.textContent = "";
      $("lSenha").value = "";
    }).catch(function (e) {
      var msg = /invalid login/i.test(e.message || "")
        ? "E-mail ou senha incorretos."
        : (e.message || "Não foi possível entrar.");
      nota.textContent = msg;
    }).then(function () { botao.disabled = false; });
  });

  $("btnSair").addEventListener("click", function (ev) {
    ev.preventDefault();
    db.auth.signOut().then(function () { location.reload(); });
  });

  /* ============================================================
     ABAS
     ============================================================ */
  document.querySelectorAll(".tab-btn").forEach(function (b) {
    b.addEventListener("click", function () {
      document.querySelectorAll(".tab-btn").forEach(function (o) { o.classList.toggle("on", o === b); });
      document.querySelectorAll(".tab-pane").forEach(function (p) {
        p.hidden = p.id !== "tab-" + b.dataset.tab;
      });
    });
  });

  /* ============================================================
     CARGA DE DADOS
     ============================================================ */
  function carregarTudo() {
    return Promise.all([carregarEmps(), carregarUnis(), carregarLeads()]);
  }

  function carregarEmps() {
    return db.from("empreendimentos").select("*").order("nome").then(function (r) {
      if (r.error) throw r.error;
      emps = r.data || [];
      renderEmps();
      preencherSelectEmps();
      if (unis.length) renderUnis();   // atualiza a coluna "Empreendimento"
    }).catch(falha);
  }

  function carregarUnis() {
    return db.from("unidades").select("*").order("criado_em", { ascending: false }).then(function (r) {
      if (r.error) throw r.error;
      unis = r.data || [];
      renderUnis();
      renderEmps(); // atualiza a contagem de unidades por empreendimento
    }).catch(falha);
  }

  function carregarLeads() {
    return db.from("leads").select("*, unidades(titulo)").order("criado_em", { ascending: false })
      .then(function (r) {
        if (r.error) throw r.error;
        leads = r.data || [];
        renderLeads();
      }).catch(falha);
  }

  function falha(e) {
    if (ui) ui.toast("Erro: " + (e.message || e), "erro");
    if (window.console) console.error("[KNO admin]", e);
  }

  /* ============================================================
     LISTAS
     ============================================================ */
  function nomeEmp(id) {
    for (var i = 0; i < emps.length; i++) if (emps[i].id === id) return emps[i].nome;
    return "—";
  }

  function renderUnis() {
    var tb = $("listaUnidades");
    $("contaUni").textContent = unis.length ? "(" + unis.length + ")" : "";
    if (!unis.length) {
      tb.innerHTML = '<tr><td colspan="6" style="color:var(--muted);padding:26px 12px">' +
        'Nenhuma unidade cadastrada. Use o formulário ao lado.</td></tr>';
      return;
    }
    tb.innerHTML = unis.map(function (u) {
      var st = cat.STATUS_UNIDADE[u.status] || cat.STATUS_UNIDADE.disponivel;
      var f = cat.fotos(u);
      return '<tr>' +
        '<td>' + (f.length
          ? '<img class="mini-foto" src="' + cat.esc(f[0]) + '" alt="" />'
          : '<span style="color:var(--muted);font-size:11px">sem foto</span>') + '</td>' +
        '<td>' + cat.esc(u.titulo) +
          (u.destaque ? ' <span class="uni-tipo" style="position:static;display:inline-block;margin-left:6px">destaque</span>' : '') +
        '</td>' +
        '<td style="color:var(--muted)">' + cat.esc(nomeEmp(u.empreendimento_id)) + '</td>' +
        '<td class="num">' + cat.moeda(u.preco) + '</td>' +
        '<td><span class="uni-status ' + st.cls + '" style="position:static;display:inline-block">' + st.label + '</span></td>' +
        '<td><div class="acoes">' +
          '<button class="btn-sm" data-editar-uni="' + u.id + '">Editar</button>' +
          '<button class="btn-sm danger" data-excluir-uni="' + u.id + '">Excluir</button>' +
        '</div></td>' +
      '</tr>';
    }).join("");
  }

  function renderEmps() {
    var tb = $("listaEmps");
    $("contaEmp").textContent = emps.length ? "(" + emps.length + ")" : "";
    if (!emps.length) {
      tb.innerHTML = '<tr><td colspan="6" style="color:var(--muted);padding:26px 12px">' +
        'Nenhum empreendimento cadastrado.</td></tr>';
      return;
    }
    tb.innerHTML = emps.map(function (e) {
      var qtd = unis.filter(function (u) { return u.empreendimento_id === e.id; }).length;
      var local = [e.bairro, e.cidade].filter(Boolean).join(" · ") || "—";
      return '<tr>' +
        '<td>' + (e.capa_url
          ? '<img class="mini-foto" src="' + cat.esc(e.capa_url) + '" alt="" />'
          : '<span style="color:var(--muted);font-size:11px">sem capa</span>') + '</td>' +
        '<td>' + cat.esc(e.nome) + '</td>' +
        '<td style="color:var(--muted)">' + cat.esc(local) + '</td>' +
        '<td style="color:var(--muted)">' + cat.esc(cat.STATUS_EMPREENDIMENTO[e.status] || e.status) + '</td>' +
        '<td class="num">' + qtd + '</td>' +
        '<td><div class="acoes">' +
          '<button class="btn-sm" data-editar-emp="' + e.id + '">Editar</button>' +
          '<button class="btn-sm danger" data-excluir-emp="' + e.id + '">Excluir</button>' +
        '</div></td>' +
      '</tr>';
    }).join("");
  }

  function renderLeads() {
    var tb = $("listaLeads");
    $("contaLeads").textContent = leads.length ? "(" + leads.length + ")" : "";
    $("leadsBadge").textContent = leads.length ? "(" + leads.length + ")" : "";
    if (!leads.length) {
      tb.innerHTML = '<tr><td colspan="5" style="color:var(--muted);padding:26px 12px">' +
        'Nenhum contato recebido ainda.</td></tr>';
      return;
    }
    tb.innerHTML = leads.map(function (l) {
      var contato = '<a href="mailto:' + cat.esc(l.email) + '">' + cat.esc(l.email) + '</a>';
      if (l.whatsapp) {
        contato += '<br /><a href="https://wa.me/55' + cat.esc(String(l.whatsapp).replace(/\D/g, "")) +
          '" target="_blank" rel="noopener" style="color:var(--muted)">' + cat.esc(l.whatsapp) + '</a>';
      }
      return '<tr>' +
        '<td style="color:var(--muted);white-space:nowrap">' + cat.esc(cat.data(l.criado_em)) + '</td>' +
        '<td>' + cat.esc(l.nome) + '</td>' +
        '<td style="font-size:13px">' + contato + '</td>' +
        '<td style="color:var(--muted)">' + cat.esc(l.unidades ? l.unidades.titulo : "—") + '</td>' +
        '<td style="color:var(--muted);max-width:340px">' + cat.esc(l.mensagem || "—") + '</td>' +
      '</tr>';
    }).join("");
  }

  function preencherSelectEmps() {
    var sel = $("uEmp");
    var atual = sel.value;
    sel.innerHTML = '<option value="">Sem empreendimento</option>' +
      emps.map(function (e) {
        return '<option value="' + cat.esc(e.id) + '">' + cat.esc(e.nome) + '</option>';
      }).join("");
    sel.value = atual;
  }

  /* ============================================================
     FOTOS: compressão + upload
     ============================================================ */
  function comprimir(file) {
    return new Promise(function (resolve, reject) {
      if (!/^image\//.test(file.type)) return reject(new Error(file.name + " não é uma imagem"));
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var escala = Math.min(1, MAX_LARGURA / img.naturalWidth);
        var w = Math.max(1, Math.round(img.naturalWidth * escala));
        var h = Math.max(1, Math.round(img.naturalHeight * escala));
        var c = document.createElement("canvas");
        c.width = w; c.height = h;
        var ctx = c.getContext("2d");
        ctx.fillStyle = "#ffffff";           // PNG com transparência vira branco, não preto
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        c.toBlob(function (blob) {
          blob ? resolve(blob) : reject(new Error("Falha ao converter " + file.name));
        }, "image/jpeg", QUALIDADE);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("Não foi possível ler " + file.name));
      };
      img.src = url;
    });
  }

  function idAleatorio() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return Date.now() + "-" + Math.random().toString(16).slice(2);
  }

  function enviarArquivo(blob, pasta) {
    var caminho = pasta + "/" + idAleatorio() + ".jpg";
    return db.storage.from(BUCKET)
      .upload(caminho, blob, { contentType: "image/jpeg", cacheControl: "31536000", upsert: false })
      .then(function (r) {
        if (r.error) throw r.error;
        return db.storage.from(BUCKET).getPublicUrl(caminho).data.publicUrl;
      });
  }

  function caminhoDaUrl(url) {
    var marca = "/object/public/" + BUCKET + "/";
    var i = String(url).indexOf(marca);
    return i === -1 ? null : decodeURIComponent(String(url).slice(i + marca.length));
  }

  function apagarArquivo(url) {
    var p = caminhoDaUrl(url);
    if (!p) return Promise.resolve();
    return db.storage.from(BUCKET).remove([p]).catch(function () { /* silencioso */ });
  }

  /** Processa uma lista de arquivos: comprime, envia e chama onPronto(url) para cada um. */
  function processar(files, pasta, elProgresso, onPronto) {
    var lista = Array.prototype.slice.call(files).filter(function (f) {
      return f && /^image\//.test(f.type);
    });
    if (!lista.length) return Promise.resolve();

    var total = lista.length, feitos = 0;
    elProgresso.hidden = false;
    elProgresso.textContent = "Enviando 0 de " + total + "…";

    return lista.reduce(function (cadeia, file) {
      return cadeia.then(function () {
        return comprimir(file)
          .then(function (blob) { return enviarArquivo(blob, pasta); })
          .then(function (url) { onPronto(url); })
          .catch(function (e) { if (ui) ui.toast(e.message || String(e), "erro"); })
          .then(function () {
            feitos++;
            elProgresso.textContent = "Enviando " + feitos + " de " + total + "…";
          });
      });
    }, Promise.resolve()).then(function () {
      elProgresso.textContent = feitos + (feitos > 1 ? " fotos enviadas." : " foto enviada.");
      setTimeout(function () { elProgresso.hidden = true; }, 2500);
    });
  }

  /** Liga um dropzone (clique + arrastar) a um input de arquivo. */
  function ligarDropzone(zona, input, aoReceber) {
    zona.addEventListener("click", function () { input.click(); });
    input.addEventListener("change", function () {
      aoReceber(input.files);
      input.value = "";
    });
    ["dragenter", "dragover"].forEach(function (ev) {
      zona.addEventListener(ev, function (e) { e.preventDefault(); zona.classList.add("drag"); });
    });
    ["dragleave", "drop"].forEach(function (ev) {
      zona.addEventListener(ev, function (e) { e.preventDefault(); zona.classList.remove("drag"); });
    });
    zona.addEventListener("drop", function (e) {
      if (e.dataTransfer && e.dataTransfer.files) aoReceber(e.dataTransfer.files);
    });
  }

  /* ---------- fotos da unidade ---------- */
  function renderFotosUni() {
    $("fotosUni").innerHTML = fotosUni.map(function (url, i) {
      return '<div class="foto-item">' +
        '<img src="' + cat.esc(url) + '" alt="" />' +
        (i === 0 ? '<span class="capa-tag">capa</span>' : '') +
        '<div class="foto-acoes">' +
          (i > 0 ? '<button type="button" title="Usar como capa" data-capa="' + i + '">★</button>' : '') +
          '<button type="button" title="Remover" data-remover="' + i + '">✕</button>' +
        '</div>' +
      '</div>';
    }).join("");
  }

  $("fotosUni").addEventListener("click", function (ev) {
    var capa = ev.target.closest("[data-capa]");
    var rem = ev.target.closest("[data-remover]");
    if (capa) {
      var i = +capa.dataset.capa;
      fotosUni.unshift(fotosUni.splice(i, 1)[0]);
      renderFotosUni();
    } else if (rem) {
      var j = +rem.dataset.remover;
      var url = fotosUni.splice(j, 1)[0];
      renderFotosUni();
      apagarArquivo(url);
    }
  });

  ligarDropzone($("dropUni"), $("fileUni"), function (files) {
    processar(files, "unidades", $("progressoUni"), function (url) {
      fotosUni.push(url);
      renderFotosUni();
    });
  });

  /* ---------- capa do empreendimento ---------- */
  function renderCapaEmp() {
    $("fotosEmp").innerHTML = capaEmp
      ? '<div class="foto-item"><img src="' + cat.esc(capaEmp) + '" alt="" />' +
        '<div class="foto-acoes"><button type="button" title="Remover" data-remover-capa="1">✕</button></div></div>'
      : "";
  }

  $("fotosEmp").addEventListener("click", function (ev) {
    if (!ev.target.closest("[data-remover-capa]")) return;
    var url = capaEmp;
    capaEmp = null;
    renderCapaEmp();
    apagarArquivo(url);
  });

  ligarDropzone($("dropEmp"), $("fileEmp"), function (files) {
    processar([files[0]], "empreendimentos", $("progressoEmp"), function (url) {
      if (capaEmp) apagarArquivo(capaEmp);
      capaEmp = url;
      renderCapaEmp();
    });
  });

  /* ============================================================
     FORMULÁRIO — UNIDADES
     ============================================================ */
  function limparFormUni() {
    editandoUni = null;
    fotosUni = [];
    $("formUnidade").reset();
    ["uQuartos", "uSuites", "uBanheiros", "uVagas"].forEach(function (id) { $(id).value = 0; });
    $("tituloFormUni").textContent = "Nova unidade";
    $("salvarUni").textContent = "Salvar unidade";
    $("cancelarUni").hidden = true;
    renderFotosUni();
  }

  function editarUni(id) {
    var u = unis.filter(function (x) { return x.id === id; })[0];
    if (!u) return;
    editandoUni = id;
    $("uTitulo").value = u.titulo || "";
    $("uEmp").value = u.empreendimento_id || "";
    $("uTipo").value = u.tipo || "casa";
    $("uPreco").value = u.preco == null ? "" : u.preco;
    $("uArea").value = u.area_m2 == null ? "" : u.area_m2;
    $("uQuartos").value = u.quartos || 0;
    $("uSuites").value = u.suites || 0;
    $("uBanheiros").value = u.banheiros || 0;
    $("uVagas").value = u.vagas || 0;
    $("uStatus").value = u.status || "disponivel";
    $("uDestaque").checked = !!u.destaque;
    $("uDescricao").value = u.descricao || "";
    fotosUni = cat.fotos(u).slice();
    renderFotosUni();
    $("tituloFormUni").textContent = "Editando unidade";
    $("salvarUni").textContent = "Salvar alterações";
    $("cancelarUni").hidden = false;
    $("formUnidade").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function num(id) {
    var v = $(id).value.trim();
    return v === "" ? null : Number(v);
  }

  $("formUnidade").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var titulo = $("uTitulo").value.trim();
    if (!titulo) { if (ui) ui.toast("O título é obrigatório.", "erro"); return; }

    var dados = {
      titulo: titulo,
      empreendimento_id: $("uEmp").value || null,
      tipo: $("uTipo").value,
      preco: num("uPreco"),
      area_m2: num("uArea"),
      quartos: num("uQuartos") || 0,
      suites: num("uSuites") || 0,
      banheiros: num("uBanheiros") || 0,
      vagas: num("uVagas") || 0,
      status: $("uStatus").value,
      destaque: $("uDestaque").checked,
      descricao: $("uDescricao").value.trim() || null,
      fotos: fotosUni
    };

    var botao = $("salvarUni");
    botao.disabled = true;

    var op = editandoUni
      ? db.from("unidades").update(dados).eq("id", editandoUni)
      : db.from("unidades").insert(dados);

    op.then(function (r) {
      if (r.error) throw r.error;
      if (ui) ui.toast(editandoUni ? "Unidade atualizada." : "Unidade cadastrada.", "ok");
      limparFormUni();
      return carregarUnis();
    }).catch(falha).then(function () { botao.disabled = false; });
  });

  $("cancelarUni").addEventListener("click", limparFormUni);

  $("listaUnidades").addEventListener("click", function (ev) {
    var ed = ev.target.closest("[data-editar-uni]");
    var ex = ev.target.closest("[data-excluir-uni]");
    if (ed) return editarUni(ed.dataset.editarUni);
    if (!ex) return;

    var id = ex.dataset.excluirUni;
    var u = unis.filter(function (x) { return x.id === id; })[0];
    if (!u) return;
    if (!confirm('Excluir "' + u.titulo + '"? As fotos também serão apagadas. Não dá para desfazer.')) return;

    db.from("unidades").delete().eq("id", id).then(function (r) {
      if (r.error) throw r.error;
      cat.fotos(u).forEach(apagarArquivo);
      if (editandoUni === id) limparFormUni();
      if (ui) ui.toast("Unidade excluída.", "ok");
      return carregarUnis();
    }).catch(falha);
  });

  /* ============================================================
     FORMULÁRIO — EMPREENDIMENTOS
     ============================================================ */
  function limparFormEmp() {
    editandoEmp = null;
    capaEmp = null;
    $("formEmp").reset();
    $("tituloFormEmp").textContent = "Novo empreendimento";
    $("salvarEmp").textContent = "Salvar empreendimento";
    $("cancelarEmp").hidden = true;
    renderCapaEmp();
  }

  function editarEmp(id) {
    var e = emps.filter(function (x) { return x.id === id; })[0];
    if (!e) return;
    editandoEmp = id;
    $("eNome").value = e.nome || "";
    $("eBairro").value = e.bairro || "";
    $("eCidade").value = e.cidade || "";
    $("eStatus").value = e.status || "lancamento";
    $("eDescricao").value = e.descricao || "";
    capaEmp = e.capa_url || null;
    renderCapaEmp();
    $("tituloFormEmp").textContent = "Editando empreendimento";
    $("salvarEmp").textContent = "Salvar alterações";
    $("cancelarEmp").hidden = false;
    $("formEmp").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  $("formEmp").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var nome = $("eNome").value.trim();
    if (!nome) { if (ui) ui.toast("O nome é obrigatório.", "erro"); return; }

    var dados = {
      nome: nome,
      bairro: $("eBairro").value.trim() || null,
      cidade: $("eCidade").value.trim() || null,
      status: $("eStatus").value,
      descricao: $("eDescricao").value.trim() || null,
      capa_url: capaEmp
    };

    var botao = $("salvarEmp");
    botao.disabled = true;

    var op = editandoEmp
      ? db.from("empreendimentos").update(dados).eq("id", editandoEmp)
      : db.from("empreendimentos").insert(dados);

    op.then(function (r) {
      if (r.error) throw r.error;
      if (ui) ui.toast(editandoEmp ? "Empreendimento atualizado." : "Empreendimento cadastrado.", "ok");
      limparFormEmp();
      return carregarEmps();
    }).catch(falha).then(function () { botao.disabled = false; });
  });

  $("cancelarEmp").addEventListener("click", limparFormEmp);

  $("listaEmps").addEventListener("click", function (ev) {
    var ed = ev.target.closest("[data-editar-emp]");
    var ex = ev.target.closest("[data-excluir-emp]");
    if (ed) return editarEmp(ed.dataset.editarEmp);
    if (!ex) return;

    var id = ex.dataset.excluirEmp;
    var e = emps.filter(function (x) { return x.id === id; })[0];
    if (!e) return;
    var qtd = unis.filter(function (u) { return u.empreendimento_id === id; }).length;
    var aviso = qtd
      ? "\n\n" + qtd + (qtd > 1 ? " unidades ficarão" : " unidade ficará") + " sem empreendimento (não serão excluídas)."
      : "";
    if (!confirm('Excluir "' + e.nome + '"?' + aviso)) return;

    db.from("empreendimentos").delete().eq("id", id).then(function (r) {
      if (r.error) throw r.error;
      if (e.capa_url) apagarArquivo(e.capa_url);
      if (editandoEmp === id) limparFormEmp();
      if (ui) ui.toast("Empreendimento excluído.", "ok");
      return Promise.all([carregarEmps(), carregarUnis()]);
    }).catch(falha);
  });

  /* ---------------- início ---------------- */
  limparFormUni();
  limparFormEmp();
})();
