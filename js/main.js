/* ============================================================
   KNO — interações do site + ligação scroll → cena 3D
   ============================================================ */
(function () {
  "use strict";

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };

  /* Limites de cada etapa no progresso global (0..1) — casam com a timeline da cena */
  var STEPS = [0, 0.188, 0.330, 0.483, 0.620, 0.733, 0.834, 0.944];

  var journey = $("#journey");
  var stage = $("#stage");
  var canvas = $("#scene");
  var captions = $$(".caption");
  var railItems = $$("#rail li");
  var metaPct = $("#metaPct");
  var metaStage = $("#metaStage");
  var scrollBar = $("#scrollBar");

  var scene = null;
  var currentStep = -1;
  var ticking = false;
  var journeyEnd = 1;
  var docHeight = 1;

  /* ---------------- cena 3D ---------------- */
  function bootScene() {
    if (!window.KNOScene || window.KNOScene.unavailable) return fallback();
    try {
      scene = window.KNOScene.init(canvas);
    } catch (e) {
      scene = null;
      if (window.console) console.warn("KNO 3D:", e);
    }
    if (!scene) return fallback();
  }

  function fallback() {
    canvas.style.display = "none";
    var fb = $("#stageFallback");
    if (fb) fb.hidden = false;
  }

  /* ---------------- medidas ---------------- */
  function measure() {
    var vh = window.innerHeight;
    journeyEnd = Math.max(1, journey.offsetTop + journey.offsetHeight - vh);
    docHeight = Math.max(1, document.documentElement.scrollHeight - vh);
    if (scene) scene.resize();
  }

  /* ---------------- scroll ---------------- */
  function onScroll() {
    var y = window.pageYOffset || document.documentElement.scrollTop;
    var p = clamp(y / journeyEnd, 0, 1);

    if (scene) scene.setProgress(p);

    // barra de progresso do documento inteiro
    scrollBar.style.width = (clamp(y / docHeight, 0, 1) * 100).toFixed(2) + "%";

    // etapa atual
    var step = 0;
    for (var i = STEPS.length - 1; i >= 0; i--) {
      if (p >= STEPS[i]) { step = i; break; }
    }
    if (step !== currentStep) {
      currentStep = step;
      captions.forEach(function (c, i) { c.classList.toggle("is-active", i === step); });
      railItems.forEach(function (li, i) {
        li.classList.toggle("active", i === step);
        li.classList.toggle("done", i < step);
      });
      metaStage.textContent = railItems[step] ? railItems[step].querySelector("span").textContent : "";
    }

    // percentual da obra (começa a contar quando a construção começa)
    var pct = Math.round(clamp((p - STEPS[1] * 0.5) / (1 - STEPS[1] * 0.5), 0, 1) * 100);
    metaPct.textContent = pct + "%";

    // entardecer no fundo do palco
    stage.classList.toggle("finale", p > 0.9);

    // pausa o render quando o palco já saiu de cena
    if (scene) scene.setActive(!document.hidden && y < journeyEnd + window.innerHeight * 0.75);

    ticking = false;
  }

  function requestScroll() {
    if (!ticking) { ticking = true; window.requestAnimationFrame(onScroll); }
  }

  /* ---------------- contadores ---------------- */
  function initCounters() {
    var nodes = $$(".count");
    if (!nodes.length) return;
    var run = function (el) {
      var to = parseFloat(el.getAttribute("data-to")) || 0;
      var suffix = el.getAttribute("data-suffix") || "";
      if (suffix && /^[a-zA-Z]/.test(suffix)) suffix = " " + suffix;
      var t0 = performance.now(), dur = 1500;
      var tick = function (now) {
        var k = clamp((now - t0) / dur, 0, 1);
        var v = Math.round(to * (1 - Math.pow(1 - k, 3)));
        el.textContent = v.toLocaleString("pt-BR") + suffix;
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    if (!("IntersectionObserver" in window)) { nodes.forEach(run); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { run(en.target); io.unobserve(en.target); }
      });
    }, { threshold: 0.6 });
    nodes.forEach(function (n) { io.observe(n); });
  }

  /* ---------------- formulário (grava em leads) ---------------- */
  function initForm() {
    var form = $("#contactForm");
    if (!form) return;
    var note = $("#formNote");
    var botao = form.querySelector("button[type=submit]");
    var textoBotao = botao ? botao.textContent : "";

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();

      var ok = true;
      ["nome", "email"].forEach(function (id) {
        var f = $("#" + id);
        var bad = !f.value.trim() || (id === "email" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.value));
        f.classList.toggle("invalid", bad);
        if (bad) ok = false;
      });
      if (!ok) {
        note.textContent = "Preencha nome e e-mail para continuarmos.";
        note.classList.remove("ok");
        return;
      }

      if (!window.KNOdb || !window.KNOdb.pronto()) {
        note.textContent = "Não foi possível enviar agora: o banco de dados ainda não está configurado.";
        note.classList.remove("ok");
        return;
      }

      if (botao) { botao.disabled = true; botao.textContent = "Enviando…"; }
      note.textContent = "Enviando…";
      note.classList.remove("ok");

      var mensagem = $("#msg").value.trim();
      var tipo = $("#tipo").value;
      window.KNOdb.client.from("leads").insert({
        nome: $("#nome").value.trim(),
        email: $("#email").value.trim(),
        whatsapp: $("#fone").value.trim() || null,
        mensagem: "[" + tipo + "] " + (mensagem || "(sem mensagem)"),
        unidade_id: null
      }).then(function (r) {
        if (r.error) throw r.error;
        form.reset();
        note.textContent = "Mensagem enviada. A KNO responde em até 1 dia útil.";
        note.classList.add("ok");
      }).catch(function (e) {
        note.textContent = "Não conseguimos enviar agora (" + (e.message || e) +
          "). Tente novamente ou fale pelo telefone acima.";
        note.classList.remove("ok");
      }).then(function () {
        if (botao) { botao.disabled = false; botao.textContent = textoBotao; }
      });
    });
  }

  /* ---------------- destaques vindos do banco ---------------- */
  function initDestaques() {
    var grid = $("#destaquesGrid");
    if (!grid || !window.KNOcat) return;
    window.KNOcat.carregarDestaques(grid, 3).then(function (n) {
      var sec = $("#destaques");
      if (!sec || !n) return;
      sec.hidden = false;
      // A seção nasce oculta (hidden), e um elemento oculto nunca chega a
      // "entrar na tela" para o IntersectionObserver — liberamos a animação
      // de entrada aqui mesmo, sem depender do scroll.
      $$(".reveal", sec).forEach(function (el) { el.classList.add("in"); });
    });
  }

  /* ---------------- preloader ---------------- */
  function initPreloader() {
    var pre = $("#preloader"), bar = $("#preBar");
    var v = 0;
    var id = setInterval(function () {
      v = Math.min(92, v + Math.random() * 16);
      bar.style.width = v + "%";
    }, 160);
    var finish = function () {
      clearInterval(id);
      bar.style.width = "100%";
      setTimeout(function () {
        pre.classList.add("done");
        document.body.classList.add("ready");
        setTimeout(function () { pre.style.display = "none"; }, 900);
      }, 260);
    };
    if (document.readyState === "complete") setTimeout(finish, 500);
    else window.addEventListener("load", function () { setTimeout(finish, 400); });
    setTimeout(finish, 6000); // trava de segurança
  }

  /* ---------------- start ---------------- */
  function start() {
    bootScene();
    measure();
    initCounters();
    initForm();
    initDestaques();
    initPreloader();
    onScroll();

    window.addEventListener("scroll", requestScroll, { passive: true });
    window.addEventListener("resize", function () { measure(); requestScroll(); });
    window.addEventListener("orientationchange", function () { setTimeout(function () { measure(); requestScroll(); }, 300); });
    document.addEventListener("visibilitychange", requestScroll);
    // imagens/fontes podem mudar a altura do documento
    window.addEventListener("load", function () { measure(); requestScroll(); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
