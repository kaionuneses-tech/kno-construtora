/* ============================================================
   KNO — comportamentos comuns a todas as páginas
   (menu, animação de entrada, ano do rodapé, avisos flutuantes)
   ============================================================ */
(function (global) {
  "use strict";

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  function initNav() {
    var toggle = $("#navToggle"), links = $("#navLinks");
    if (!toggle || !links) return;
    toggle.addEventListener("click", function () {
      var open = links.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
    });
    $$("a", links).forEach(function (a) {
      a.addEventListener("click", function () {
        links.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  function initReveal(escopo) {
    var els = $$(".reveal:not(.in)", escopo || document);
    if (!els.length) return;
    if (!("IntersectionObserver" in global)) {
      els.forEach(function (e) { e.classList.add("in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { threshold: 0.18, rootMargin: "0px 0px -8% 0px" });
    els.forEach(function (e) { io.observe(e); });
  }

  function initAno() {
    var el = $("#year");
    if (el) el.textContent = new Date().getFullYear();
  }

  /** Barra fixa da nav ganha fundo ao rolar (páginas internas já nascem sólidas). */
  function initNavSolida() {
    var nav = $("#nav");
    if (!nav || nav.dataset.sempreSolida === "1") return;
    var aplicar = function () {
      nav.classList.toggle("solid", (global.pageYOffset || document.documentElement.scrollTop) > 60);
    };
    global.addEventListener("scroll", aplicar, { passive: true });
    aplicar();
  }

  var toastEl = null, toastTimer = 0;
  function toast(msg, tipo) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "toast";
      toastEl.setAttribute("role", "status");
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.className = "toast show" + (tipo ? " " + tipo : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.className = "toast" + (tipo ? " " + tipo : "");
    }, tipo === "erro" ? 6000 : 3800);
  }

  global.KNOui = { nav: initNav, reveal: initReveal, ano: initAno, toast: toast, $: $, $$: $$ };

  function start() {
    initNav();
    initNavSolida();
    initReveal();
    initAno();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})(window);
