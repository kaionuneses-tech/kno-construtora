/* ============================================================
   KNO — Cena 3D: construção de uma casa dirigida pelo scroll
   Three.js r157 (build UMD). Tudo procedural: nenhum modelo externo.
   API:  KNOScene.init(canvas) -> { setProgress(p), setActive(b), resize() }
   ============================================================ */
(function (global) {
  "use strict";

  if (typeof THREE === "undefined") {
    global.KNOScene = { unavailable: true, init: function () { return null; } };
    return;
  }

  /* ---------------- utilidades ---------------- */
  var clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  var inv = function (p, a, b) { return clamp((p - a) / (b - a), 0, 1); };
  var smooth = function (t) { return t * t * (3 - 2 * t); };
  var easeOut = function (t) { return 1 - Math.pow(1 - t, 3); };
  var easeOutBack = function (t) {
    var c1 = 1.5, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  };
  var lerp = function (a, b, t) { return a + (b - a) * t; };

  /* ---------------- geometria da casa (metros) ---------------- */
  var W = 12, D = 9;              // largura (X) e profundidade (Z)
  var HX = W / 2, HZ = D / 2;     // 6 e 4.5
  var TW = 0.24;                  // espessura da parede
  var SLAB1_T = 0.35, H1 = 3.10, BEAM_T = 0.40, SLAB2_T = 0.25, H2 = 2.90, SLABR_T = 0.25, PAR_H = 0.60;

  var Y_F1 = SLAB1_T;             // 0.35  piso térreo
  var Y_B1 = Y_F1 + H1;           // 3.45  base das vigas do 1º pav.
  var Y_S2 = Y_B1 + BEAM_T;       // 3.85  base da laje do 2º pav.
  var Y_F2 = Y_S2 + SLAB2_T;      // 4.10  piso do 2º pav.
  var Y_B2 = Y_F2 + H2;           // 7.00  base das vigas de cobertura
  var Y_SR = Y_B2 + BEAM_T;       // 7.40  base da laje de cobertura
  var Y_PAR = Y_SR + SLABR_T;     // 7.65  base da platibanda

  var Z2 = 1.5;                   // fachada frontal do 2º pav. (varanda de Z2 até HZ)

  /* ---------------- linha do tempo (p global 0..1) ---------------- */
  var T = {
    grid:      [-0.050, 0.020],
    stakes:    [-0.020, 0.055],
    gridOut:   [0.255, 0.320],
    pit:       [0.170, 0.215],
    footings:  [0.185, 0.258],
    slab1:     [0.258, 0.318],
    crane:     [0.170, 0.250],
    cols1:     [0.325, 0.378],
    beams1:    [0.370, 0.408],
    slab2:     [0.400, 0.440],
    cols2:     [0.432, 0.478],
    walls1:    [0.485, 0.552],
    walls2:    [0.548, 0.612],
    scaffold:  [0.492, 0.560],
    roofBeams: [0.622, 0.666],
    roofSlab:  [0.662, 0.702],
    parapet:   [0.700, 0.730],
    frames:    [0.736, 0.790],
    glass:     [0.778, 0.828],
    door:      [0.790, 0.830],
    scaffOut:  [0.832, 0.876],
    craneOut:  [0.836, 0.882],
    plaster:   [0.838, 0.900],
    fins:      [0.862, 0.906],
    paving:    [0.868, 0.914],
    garden:    [0.880, 0.940],
    grass:     [0.862, 0.948],
    lights:    [0.946, 0.992],
    dusk:      [0.900, 1.000]
  };

  /* ---------------- câmera: keyframes ---------------- */
  var CAM = [
    { p: 0.00, pos: [-19, 5.2, 30], look: [0, 4.2, -3] },
    { p: 0.10, pos: [-24, 4.6, 21], look: [0, 0.8, 0] },
    { p: 0.22, pos: [-12.5, 4.2, 17], look: [0, 0.7, 0] },
    { p: 0.31, pos: [4, 8.5, 18], look: [0, 1.2, 0] },
    { p: 0.40, pos: [15, 6.5, 17], look: [0, 3.2, 0] },
    { p: 0.50, pos: [20, 4.2, 12], look: [0, 3.0, 0] },
    { p: 0.60, pos: [13, 5.5, 18], look: [0, 3.6, 1] },
    { p: 0.68, pos: [5, 16.5, 22], look: [0, 4.6, 0] },
    { p: 0.78, pos: [-9.5, 3.2, 17.5], look: [-1.5, 2.6, 3] },
    { p: 0.87, pos: [-16, 4.0, 18], look: [-0.5, 2.8, 1] },
    { p: 0.95, pos: [-18, 6.2, 23], look: [0, 3.0, 0] },
    { p: 1.00, pos: [-16, 7.6, 31], look: [0, 3.2, -0.5] }
  ];

  /* ============================================================ */
  function init(canvas) {
    var renderer, scene, camera, clock;
    var parts = [];      // peças animadas pelo progresso
    var fades = [];      // materiais que entram/saem
    var mobile = Math.min(window.innerWidth, window.innerHeight) < 760;

    try {
      renderer = new THREE.WebGLRenderer({
        canvas: canvas, antialias: !mobile, alpha: true, powerPreference: "high-performance"
      });
    } catch (e) { return null; }
    if (!renderer.getContext()) { return null; }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.6 : 2));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if ("outputColorSpace" in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.setClearColor(0x000000, 0);

    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0d1730, 46, 145);
    clock = new THREE.Clock();

    camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.5, 400);
    camera.position.set(CAM[0].pos[0], CAM[0].pos[1], CAM[0].pos[2]);

    /* ---------------- ambiente / reflexos ---------------- */
    (function () {
      var c = document.createElement("canvas"); c.width = 512; c.height = 256;
      var g = c.getContext("2d");
      var sky = g.createLinearGradient(0, 0, 0, 256);
      sky.addColorStop(0, "#26375e"); sky.addColorStop(0.46, "#8ea4c9");
      sky.addColorStop(0.52, "#3c4459"); sky.addColorStop(1, "#11162a");
      g.fillStyle = sky; g.fillRect(0, 0, 512, 256);
      var sun = g.createRadialGradient(150, 68, 0, 150, 68, 96);
      sun.addColorStop(0, "#fff3d4"); sun.addColorStop(1, "rgba(255,243,212,0)");
      g.fillStyle = sun; g.fillRect(0, 0, 512, 256);
      var tex = new THREE.CanvasTexture(c);
      tex.mapping = THREE.EquirectangularReflectionMapping;
      var pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromEquirectangular(tex).texture;
      tex.dispose(); pmrem.dispose();
    })();

    /* ---------------- luzes ---------------- */
    var hemi = new THREE.HemisphereLight(0x8fa8d8, 0x1b2135, 0.75);
    scene.add(hemi);

    var sun = new THREE.DirectionalLight(0xfff0d0, 2.15);
    sun.position.set(-26, 30, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
    sun.shadow.camera.near = 6;
    sun.shadow.camera.far = 90;
    sun.shadow.camera.left = -26; sun.shadow.camera.right = 26;
    sun.shadow.camera.top = 26; sun.shadow.camera.bottom = -20;
    sun.shadow.bias = -0.0009;
    sun.shadow.normalBias = 0.035;
    scene.add(sun);
    scene.add(sun.target);

    var rim = new THREE.DirectionalLight(0xd9b45b, 0.85);
    rim.position.set(22, 12, -22);
    scene.add(rim);

    var fill = new THREE.DirectionalLight(0x6f8dc4, 0.5);
    fill.position.set(14, 8, 26);
    scene.add(fill);

    /* ---------------- texturas procedurais ---------------- */
    function noiseCanvas(size, base, dots, dotAlpha) {
      var c = document.createElement("canvas"); c.width = c.height = size;
      var g = c.getContext("2d");
      g.fillStyle = base; g.fillRect(0, 0, size, size);
      for (var i = 0; i < dots; i++) {
        var x = Math.random() * size, y = Math.random() * size, r = Math.random() * 2.2 + 0.4;
        g.fillStyle = "rgba(" + (Math.random() > 0.5 ? "255,255,255," : "0,0,0,") + (Math.random() * dotAlpha).toFixed(3) + ")";
        g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill();
      }
      return c;
    }

    function makeTex(canvas, repX, repY) {
      var t = new THREE.CanvasTexture(canvas);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(repX || 1, repY || 1);
      t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      if ("colorSpace" in t) t.colorSpace = THREE.SRGBColorSpace;
      return t;
    }

    // bloco de concreto
    var blockCanvas = (function () {
      var s = 256, c = noiseCanvas(s, "#b5afa1", 2200, 0.16), g = c.getContext("2d");
      g.strokeStyle = "rgba(108,104,95,.75)"; g.lineWidth = 3;
      var rows = 4, rh = s / rows;
      for (var r = 0; r < rows; r++) {
        g.beginPath(); g.moveTo(0, r * rh); g.lineTo(s, r * rh); g.stroke();
        var off = (r % 2) * (s / 4);
        for (var k = 0; k < 2; k++) {
          var x = off + k * (s / 2);
          g.beginPath(); g.moveTo(x, r * rh); g.lineTo(x, r * rh + rh); g.stroke();
        }
      }
      return c;
    })();
    var blockTex = makeTex(blockCanvas, 1, 1);

    var concreteCanvas = noiseCanvas(256, "#a09c95", 2600, 0.14);
    var concreteTex = makeTex(concreteCanvas, 3, 3);
    var plasterCanvas = noiseCanvas(256, "#efeae0", 2000, 0.07);
    var plasterTex = makeTex(plasterCanvas, 2, 2);
    var earthCanvas = noiseCanvas(256, "#6a5c49", 3400, 0.22);
    var earthTex = makeTex(earthCanvas, 26, 26);

    /* ---------------- materiais ---------------- */
    var M = {
      concrete: new THREE.MeshStandardMaterial({ color: 0x8e8b85, map: concreteTex, roughness: 0.92, metalness: 0.02 }),
      concreteDark: new THREE.MeshStandardMaterial({ color: 0x6f6d6a, map: concreteTex, roughness: 0.95 }),
      block: new THREE.MeshStandardMaterial({ color: 0xa8a294, map: blockTex, roughness: 0.95 }),
      steel: new THREE.MeshStandardMaterial({ color: 0x9aa2ad, roughness: 0.38, metalness: 0.85 }),
      rebar: new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 0.6, metalness: 0.5 }),
      wood: new THREE.MeshStandardMaterial({ color: 0x8a5a33, roughness: 0.8 }),
      plaster: new THREE.MeshStandardMaterial({ color: 0xece6db, map: plasterTex, roughness: 0.82, transparent: true, opacity: 0 }),
      accentDark: new THREE.MeshStandardMaterial({ color: 0x232a3c, roughness: 0.5, metalness: 0.25 }),
      gold: new THREE.MeshStandardMaterial({ color: 0xc79a3f, roughness: 0.28, metalness: 0.92 }),
      frame: new THREE.MeshStandardMaterial({ color: 0x2a3040, roughness: 0.35, metalness: 0.6 }),
      glass: new THREE.MeshPhysicalMaterial({
        color: 0x9fc0dd, roughness: 0.06, metalness: 0.0, transparent: true, opacity: 0.34,
        envMapIntensity: 1.6, emissive: 0xffb95e, emissiveIntensity: 0
      }),
      earth: new THREE.MeshStandardMaterial({ color: 0x4b4437, map: earthTex, roughness: 1 }),
      pit: new THREE.MeshStandardMaterial({ color: 0x332d24, roughness: 1 }),
      paving: new THREE.MeshStandardMaterial({ color: 0x5c5f66, map: concreteTex, roughness: 0.85 }),
      trunk: new THREE.MeshStandardMaterial({ color: 0x4a3626, roughness: 0.95 }),
      leaf: new THREE.MeshStandardMaterial({ color: 0x2f5238, roughness: 0.95, flatShading: true }),
      lamp: new THREE.MeshStandardMaterial({ color: 0x1c2030, roughness: 0.5, metalness: 0.4 }),
      bulb: new THREE.MeshStandardMaterial({ color: 0x2a2a2a, emissive: 0xffbe63, emissiveIntensity: 0 })
    };

    /* ---------------- helpers de peça ---------------- */
    function part(x, y, z) {
      var g = new THREE.Group();
      g.position.set(x || 0, y || 0, z || 0);
      return g;
    }

    function mesh(geo, mat, cast, receive) {
      var m = new THREE.Mesh(geo, mat);
      m.castShadow = cast !== false;
      m.receiveShadow = receive !== false;
      return m;
    }

    /** caixa com pivô na base (para crescer de baixo para cima) */
    function boxPart(w, h, d, mat, x, yBase, z) {
      var g = part(x, yBase, z);
      var m = mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.y = h / 2;
      g.add(m);
      g.userData.mesh = m;
      g.userData.dims = [w, h, d];
      return g;
    }

    function reg(obj, range, type, opts) {
      var o = opts || {};
      o.obj = obj; o.a = range[0]; o.b = range[1]; o.type = type || "grow";
      if (o.type === "drop") o.y0 = obj.position.y;
      obj.visible = false;
      parts.push(o);
      return obj;
    }

    /** registra cada filho separadamente (mantém o pivô de cada peça) */
    function regChildren(group, range, type, opts) {
      var span = range[1] - range[0], n = group.children.length;
      group.children.forEach(function (c, i) {
        var s = range[0] + span * 0.55 * (i / n);
        var o = {};
        if (opts) for (var k in opts) o[k] = opts[k];
        reg(c, [s, Math.min(1, s + span * 0.45)], type, o);
      });
    }

    function regFade(mat, range, dir) {
      fades.push({ mat: mat, a: range[0], b: range[1], out: dir === "out" });
      mat.transparent = true;
    }

    /* ============================================================
       TERRENO
       ============================================================ */
    var groundMat = M.earth;
    var ground = mesh(new THREE.CircleGeometry(78, 64), groundMat, false, true);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    scene.add(ground);

    // malha topográfica (blueprint)
    var grid = new THREE.GridHelper(44, 44, 0xe7c375, 0x7d8bb0);
    grid.position.y = 0.012;
    grid.material.transparent = true;
    grid.material.opacity = 0;
    scene.add(grid);

    // contorno da implantação
    var outlinePts = [
      new THREE.Vector3(-HX - 0.5, 0.03, -HZ - 0.5), new THREE.Vector3(HX + 0.5, 0.03, -HZ - 0.5),
      new THREE.Vector3(HX + 0.5, 0.03, HZ + 0.5), new THREE.Vector3(-HX - 0.5, 0.03, HZ + 0.5),
      new THREE.Vector3(-HX - 0.5, 0.03, -HZ - 0.5)
    ];
    var outlineMat = new THREE.LineBasicMaterial({ color: 0xf6e3b4, transparent: true, opacity: 0 });
    var outline = new THREE.Line(new THREE.BufferGeometry().setFromPoints(outlinePts), outlineMat);
    scene.add(outline);

    // piquetes de topografia
    var stakes = part(0, 0, 0);
    scene.add(stakes);
    [[-HX - 0.5, -HZ - 0.5], [HX + 0.5, -HZ - 0.5], [HX + 0.5, HZ + 0.5], [-HX - 0.5, HZ + 0.5]].forEach(function (c) {
      var s = boxPart(0.09, 1.25, 0.09, M.wood, c[0], 0, c[1]);
      var flag = mesh(new THREE.BoxGeometry(0.4, 0.22, 0.02), M.gold);
      flag.position.set(0.2, 1.1, 0);
      s.add(flag);
      stakes.add(s);
    });
    reg(stakes, T.stakes, "grow");
    reg(stakes, T.pit, "hideAfter");

    /* ============================================================
       FUNDAÇÃO
       ============================================================ */
    var houseRoot = new THREE.Group();
    scene.add(houseRoot);

    // escavação
    var pit = boxPart(W + 1.3, 0.55, D + 1.3, M.pit, 0, -0.55, 0);
    houseRoot.add(pit);
    reg(pit, T.pit, "fadeGroup");

    var colXs = [-HX + 0.5, 0, HX - 0.5];
    var colZs = [-HZ + 0.5, 0, HZ - 0.5];
    var footPos = [];
    colXs.forEach(function (x) {
      colZs.forEach(function (z) {
        if (x === 0 && z === 0) return;
        footPos.push([x, z]);
      });
    });

    var footings = part(0, 0, 0);
    houseRoot.add(footings);
    footPos.forEach(function (c, i) {
      var f = boxPart(1.5, 0.7, 1.5, M.concreteDark, c[0], -0.4, c[1]);
      footings.add(f);
      // arranque de armadura
      for (var a = 0; a < 4; a++) {
        var bx = (a % 2 ? 0.16 : -0.16), bz = (a < 2 ? 0.16 : -0.16);
        var bar = mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.35, 6), M.rebar);
        bar.position.set(bx, 1.0, bz);
        bar.castShadow = false;
        f.add(bar);
      }
      var start = T.footings[0] + (T.footings[1] - T.footings[0]) * 0.55 * (i / footPos.length);
      reg(f, [start, start + (T.footings[1] - T.footings[0]) * 0.45], "grow");
    });

    // laje / radier
    var slab1 = boxPart(W, SLAB1_T, D, M.concrete, 0, 0, 0);
    houseRoot.add(slab1);
    reg(slab1, T.slab1, "grow");

    // degraus de entrada
    var steps = part(0, 0, 0);
    houseRoot.add(steps);
    for (var st = 0; st < 3; st++) {
      var sw = 3.4, sh = SLAB1_T / 3;
      var s2 = boxPart(sw, sh * (st + 1), 0.42, M.concrete, -0.05, 0, HZ + 0.42 * (2.5 - st));
      steps.add(s2);
    }
    reg(steps, [T.slab1[0] + 0.02, T.slab1[1] + 0.02], "grow");

    /* ============================================================
       ESTRUTURA
       ============================================================ */
    var cols1 = part(0, 0, 0); houseRoot.add(cols1);
    footPos.forEach(function (c, i) {
      var col = boxPart(0.46, H1, 0.46, M.concrete, c[0], Y_F1, c[1]);
      cols1.add(col);
      var span = T.cols1[1] - T.cols1[0];
      var s = T.cols1[0] + span * 0.5 * (i / footPos.length);
      reg(col, [s, s + span * 0.5], "grow");
    });

    function ringBeams(group, yBase, xs, zs, range) {
      // vigas no sentido X
      zs.forEach(function (z, i) {
        var b = boxPart(W - 0.1, BEAM_T, 0.34, M.concrete, 0, yBase, z);
        group.add(b);
        var sp = range[1] - range[0];
        var s = range[0] + sp * 0.45 * (i / Math.max(1, zs.length));
        reg(b, [s, s + sp * 0.55], "drop", { h: 3.2 });
      });
      // vigas no sentido Z
      xs.forEach(function (x, i) {
        var b = boxPart(0.34, BEAM_T, zs[zs.length - 1] - zs[0], M.concrete, x, yBase, (zs[0] + zs[zs.length - 1]) / 2);
        group.add(b);
        var sp = range[1] - range[0];
        var s = range[0] + sp * 0.5 + sp * 0.3 * (i / Math.max(1, xs.length));
        reg(b, [s, Math.min(1, s + sp * 0.5)], "drop", { h: 3.2 });
      });
    }

    var beams1 = part(0, 0, 0); houseRoot.add(beams1);
    ringBeams(beams1, Y_B1, [-HX + 0.5, 0, HX - 0.5], [-HZ + 0.5, 0, HZ - 0.5], T.beams1);

    var slab2 = boxPart(W, SLAB2_T, D, M.concrete, 0, Y_S2, 0);
    houseRoot.add(slab2);
    reg(slab2, T.slab2, "sweepX", { w: W });

    // pilares do 2º pavimento (inclui os da varanda)
    var col2Pos = [[-HX + 0.5, -HZ + 0.5], [0, -HZ + 0.5], [HX - 0.5, -HZ + 0.5],
                   [-HX + 0.5, Z2 - 0.5], [HX - 0.5, Z2 - 0.5],
                   [-HX + 0.5, HZ - 0.5], [HX - 0.5, HZ - 0.5]];
    var cols2 = part(0, 0, 0); houseRoot.add(cols2);
    col2Pos.forEach(function (c, i) {
      var col = boxPart(0.42, H2, 0.42, M.concrete, c[0], Y_F2, c[1]);
      cols2.add(col);
      var span = T.cols2[1] - T.cols2[0];
      var s = T.cols2[0] + span * 0.5 * (i / col2Pos.length);
      reg(col, [s, s + span * 0.5], "grow");
    });

    /* ============================================================
       ALVENARIA  (paredes com vãos) + reboco + esquadrias
       ============================================================ */
    var wallsG = part(0, 0, 0); houseRoot.add(wallsG);
    var plasterG = part(0, 0, 0); houseRoot.add(plasterG);
    var framesG = part(0, 0, 0); houseRoot.add(framesG);
    var glassG = part(0, 0, 0); houseRoot.add(glassG);

    /**
     * axis: "x" -> parede corre em X, num Z fixo. "z" -> corre em Z, num X fixo.
     * openings: [{a,b,y0,y1,kind}] em coordenadas do eixo e alturas relativas à base
     */
    function buildWall(axis, fixed, from, to, yBase, height, openings, range) {
      var span = range[1] - range[0];
      var total = to - from;
      var ops = (openings || []).slice().sort(function (p, q) { return p.a - q.a; });
      var pieces = [];
      var cursor = from;

      function push(a, b, y0, y1) {
        if (b - a < 0.02 || y1 - y0 < 0.02) return;
        pieces.push({ a: a, b: b, y0: y0, y1: y1 });
      }

      ops.forEach(function (op) {
        push(cursor, op.a, 0, height);
        if (op.y0 > 0.001) push(op.a, op.b, 0, op.y0);
        if (op.y1 < height - 0.001) push(op.a, op.b, op.y1, height);
        cursor = op.b;
      });
      push(cursor, to, 0, height);

      pieces.forEach(function (pc) {
        var len = pc.b - pc.a, h = pc.y1 - pc.y0;
        var mid = (pc.a + pc.b) / 2;
        var w = axis === "x" ? len : TW;
        var d = axis === "x" ? TW : len;
        var x = axis === "x" ? mid : fixed;
        var z = axis === "x" ? fixed : mid;

        // material com textura escalada pelo tamanho real do trecho
        var mat = M.block.clone();
        mat.map = blockTex.clone();
        mat.map.repeat.set(Math.max(1, Math.round(len / 0.9)), Math.max(1, Math.round(h / 0.45)));
        var g = boxPart(w, h, d, mat, x, yBase + pc.y0, z);
        wallsG.add(g);

        // ordem de execução: de baixo para cima, da esquerda para a direita
        var o = clamp(((mid - from) / total) * 0.45 + (pc.y0 / height) * 0.55, 0, 1);
        var s = range[0] + span * 0.55 * o;
        reg(g, [s, Math.min(1, s + span * 0.45)], "grow");

        // reboco/pintura por cima (aparece no acabamento)
        var pw = axis === "x" ? len + 0.05 : TW + 0.07;
        var pd = axis === "x" ? TW + 0.07 : len + 0.05;
        var pm = mesh(new THREE.BoxGeometry(pw, h + 0.03, pd), M.plaster);
        pm.position.set(x, yBase + pc.y0 + h / 2, z);
        plasterG.add(pm);
      });

      // esquadrias de cada vão
      ops.forEach(function (op) {
        if (op.kind === "none") return;
        var len = op.b - op.a, h = op.y1 - op.y0;
        var mid = (op.a + op.b) / 2;
        var cx = axis === "x" ? mid : fixed;
        var cz = axis === "x" ? fixed : mid;
        var cy = yBase + (op.y0 + op.y1) / 2;
        var fw = axis === "x" ? len : TW + 0.06;
        var fd = axis === "x" ? TW + 0.06 : len;

        var fr = part(cx, cy, cz);
        var bar = 0.09;
        // moldura
        [[0, h / 2 - bar / 2], [0, -h / 2 + bar / 2]].forEach(function (o2) {
          var m = mesh(new THREE.BoxGeometry(axis === "x" ? len : fw, bar, axis === "x" ? fd : len), M.frame);
          m.position.set(0, o2[1], 0);
          fr.add(m);
        });
        [-1, 1].forEach(function (sgn) {
          var m = mesh(new THREE.BoxGeometry(axis === "x" ? bar : fw, h, axis === "x" ? fd : bar), M.frame);
          if (axis === "x") m.position.x = sgn * (len / 2 - bar / 2);
          else m.position.z = sgn * (len / 2 - bar / 2);
          fr.add(m);
        });
        // montante central em vãos largos
        if (len > 2.4) {
          var mid2 = mesh(new THREE.BoxGeometry(axis === "x" ? bar * 0.8 : fw, h - bar * 2, axis === "x" ? fd : bar * 0.8), M.frame);
          fr.add(mid2);
        }
        framesG.add(fr);
        reg(fr, T.frames, "pop");

        // vidro
        var gw = axis === "x" ? len - 0.14 : 0.06;
        var gd = axis === "x" ? 0.06 : len - 0.14;
        var gm = mesh(new THREE.BoxGeometry(gw, h - 0.14, gd), M.glass, false, false);
        var gg = part(cx, cy, cz);
        gg.add(gm);
        glassG.add(gg);
        reg(gg, op.kind === "door" ? T.door : T.glass, "pop");
      });
    }

    var op = function (a, b, y0, y1, kind) { return { a: a, b: b, y0: y0, y1: y1, kind: kind || "win" }; };

    /* --- térreo --- */
    // fachada frontal (Z = +HZ)
    buildWall("x", HZ - TW / 2, -HX, HX, Y_F1, H1, [
      op(-4.7, -2.6, 0.95, 2.45),
      op(-0.75, 0.65, 0.00, 2.45, "door"),
      op(1.9, 4.9, 0.85, 2.55)
    ], T.walls1);
    // fundos (Z = -HZ)
    buildWall("x", -HZ + TW / 2, -HX, HX, Y_F1, H1, [
      op(-1.6, 1.6, 1.35, 2.45)
    ], T.walls1);
    // lateral esquerda (X = -HX)
    buildWall("z", -HX + TW / 2, -HZ, HZ, Y_F1, H1, [
      op(-3.5, -1.7, 0.95, 2.45),
      op(0.4, 2.4, 0.95, 2.45)
    ], T.walls1);
    // lateral direita (X = +HX)
    buildWall("z", HX - TW / 2, -HZ, HZ, Y_F1, H1, [
      op(-2.4, 1.6, 0.85, 2.55)
    ], T.walls1);

    /* --- 2º pavimento (recuado: de -HZ até Z2) --- */
    buildWall("x", Z2 - TW / 2, -HX, HX, Y_F2, H2, [
      op(-1.6, 1.6, 0.00, 2.35, "door"),
      op(3.1, 5.1, 0.80, 2.25)
    ], T.walls2);
    buildWall("x", -HZ + TW / 2, -HX, HX, Y_F2, H2, [
      op(-4.9, -2.9, 0.90, 2.30),
      op(2.5, 4.5, 0.90, 2.30)
    ], T.walls2);
    buildWall("z", -HX + TW / 2, -HZ, Z2, Y_F2, H2, [
      op(-3.7, -1.9, 0.85, 2.30)
    ], T.walls2);
    buildWall("z", HX - TW / 2, -HZ, Z2, Y_F2, H2, [
      op(-3.7, -1.9, 0.85, 2.30),
      op(-0.8, 0.9, 0.85, 2.30)
    ], T.walls2);

    regFade(M.plaster, T.plaster, "in");

    // porta de entrada (folha)
    var doorLeaf = part(-0.05, Y_F1 + 1.22, HZ - TW / 2 + 0.02);
    var dl = mesh(new THREE.BoxGeometry(1.24, 2.34, 0.08), M.accentDark);
    doorLeaf.add(dl);
    var handle = mesh(new THREE.BoxGeometry(0.05, 0.5, 0.05), M.gold);
    handle.position.set(0.45, 0, 0.07);
    doorLeaf.add(handle);
    houseRoot.add(doorLeaf);
    reg(doorLeaf, T.door, "pop");

    /* ============================================================
       COBERTURA
       ============================================================ */
    var roofBeams = part(0, 0, 0); houseRoot.add(roofBeams);
    ringBeams(roofBeams, Y_B2, [-HX + 0.5, 0, HX - 0.5], [-HZ + 0.5, 0, HZ - 0.5], T.roofBeams);
    // terças aparentes sobre a varanda
    [-3.5, 0, 3.5].forEach(function (x, i) {
      var b = boxPart(0.24, 0.3, D - 1, M.concrete, x, Y_B2 + 0.05, 0);
      roofBeams.add(b);
      var s = T.roofBeams[0] + (T.roofBeams[1] - T.roofBeams[0]) * (0.3 + i * 0.2);
      reg(b, [s, Math.min(1, s + 0.03)], "drop", { h: 2.6 });
    });

    var roofSlab = boxPart(W + 0.9, SLABR_T, D + 0.9, M.concrete, 0, Y_SR, 0);
    houseRoot.add(roofSlab);
    reg(roofSlab, T.roofSlab, "sweepX", { w: W + 0.9 });

    var parapet = part(0, 0, 0); houseRoot.add(parapet);
    (function () {
      var ox = (W + 0.9) / 2 - 0.1, oz = (D + 0.9) / 2 - 0.1;
      [[0, -oz, W + 0.9, 0.2], [0, oz, W + 0.9, 0.2]].forEach(function (c) {
        parapet.add(boxPart(c[2], PAR_H, c[3], M.concrete, c[0], Y_PAR, c[1]));
      });
      [[-ox, 0, 0.2, D + 0.9], [ox, 0, 0.2, D + 0.9]].forEach(function (c) {
        parapet.add(boxPart(c[2], PAR_H, c[3], M.concrete, c[0], Y_PAR, c[1]));
      });
      // friso dourado no topo da platibanda
      var trim = mesh(new THREE.BoxGeometry(W + 1.06, 0.07, D + 1.06), M.gold);
      trim.position.y = Y_PAR + PAR_H + 0.03;
      parapet.add(trim);
    })();
    regChildren(parapet, T.parapet, "grow");

    // guarda-corpo de vidro da varanda
    var railing = part(0, 0, 0); houseRoot.add(railing);
    (function () {
      var gmat = M.glass;
      var r1 = part(0, Y_F2, HZ - 0.25);
      var p1 = mesh(new THREE.BoxGeometry(W - 1.4, 1.0, 0.05), gmat, false, false);
      p1.position.y = 0.55; r1.add(p1);
      var cap = mesh(new THREE.BoxGeometry(W - 1.3, 0.07, 0.12), M.gold);
      cap.position.y = 1.08; r1.add(cap);
      railing.add(r1);
      [-1, 1].forEach(function (s) {
        var r2 = part(s * (HX - 0.25), Y_F2, (Z2 + HZ) / 2);
        var p2 = mesh(new THREE.BoxGeometry(0.05, 1.0, HZ - Z2 - 0.8), gmat, false, false);
        p2.position.y = 0.55; r2.add(p2);
        var cap2 = mesh(new THREE.BoxGeometry(0.12, 0.07, HZ - Z2 - 0.7), M.gold);
        cap2.position.y = 1.08; r2.add(cap2);
        railing.add(r2);
      });
    })();
    regChildren(railing, T.glass, "pop");

    /* ============================================================
       ACABAMENTO: brises dourados, piso externo, jardim, luzes
       ============================================================ */
    var fins = part(0, 0, 0); houseRoot.add(fins);
    (function () {
      for (var i = 0; i < 9; i++) {
        var f = boxPart(0.1, H2 - 0.2, 0.42, M.gold, -HX + 0.9 + i * 0.44, Y_F2 + 0.1, Z2 + 0.18);
        fins.add(f);
      }
      // painel ripado na entrada
      for (var j = 0; j < 7; j++) {
        var r = boxPart(0.12, 2.5, 0.16, M.gold, 1.1 + j * 0.3, Y_F1, HZ + 0.06);
        fins.add(r);
      }
    })();
    regChildren(fins, T.fins, "grow");

    var paving = part(0, 0, 0); scene.add(paving);
    (function () {
      var drive = boxPart(7.5, 0.1, 9, M.paving, -11.5, 0.0, 6);
      paving.add(drive);
      var walk = boxPart(3.6, 0.12, 8, M.paving, -0.05, 0.0, HZ + 5.2);
      paving.add(walk);
      var apron = boxPart(W + 3.2, 0.09, 2.4, M.paving, 0, 0, HZ + 1.6);
      paving.add(apron);
      // canteiros
      [[-8.4, 8.4], [8.4, 8.4], [-9.6, -2], [9.6, -2]].forEach(function (c) {
        paving.add(boxPart(2.6, 0.28, 2.6, M.concreteDark, c[0], 0, c[1]));
      });
    })();
    reg(paving, T.paving, "sweepZ", { w: 18 });

    var garden = part(0, 0, 0); scene.add(garden);
    (function () {
      function tree(x, z, s) {
        var t = part(x, 0, z);
        var tr = mesh(new THREE.CylinderGeometry(0.16 * s, 0.22 * s, 2.2 * s, 7), M.trunk);
        tr.position.y = 1.1 * s; t.add(tr);
        [[0, 2.7, 1.25], [0.5, 3.4, 0.95], [-0.45, 3.25, 0.85]].forEach(function (c) {
          var lf = mesh(new THREE.IcosahedronGeometry(c[2] * s, 0), M.leaf);
          lf.position.set(c[0] * s, c[1] * s, (c[0] * 0.6) * s);
          lf.rotation.set(Math.random(), Math.random(), Math.random());
          t.add(lf);
        });
        return t;
      }
      [[-10.5, 11, 1.1], [10.8, 10.2, 0.95], [-13, 1, 1.25], [13.2, 3.5, 1.05],
       [-8, -9.5, 0.9], [9, -10, 1.15]].forEach(function (c) {
        garden.add(tree(c[0], c[1], c[2]));
      });
      function bush(x, z, s) {
        var b = mesh(new THREE.IcosahedronGeometry(0.62 * s, 0), M.leaf);
        var g = part(x, 0.28, z); g.add(b); b.position.y = 0.3 * s;
        return g;
      }
      [[-8.4, 8.4, 1], [-7.7, 9.1, .8], [-9.1, 9.1, .75], [8.4, 8.4, 1], [9.1, 9.1, .8],
       [7.7, 7.9, .75], [-9.6, -2, 1], [-9.6, -1, .8], [9.6, -2, 1], [9.6, -1.1, .85]].forEach(function (c) {
        garden.add(bush(c[0], c[1], c[2]));
      });
      // grama nos canteiros
    })();
    regChildren(garden, T.garden, "pop");

    // iluminação externa
    var lamps = part(0, 0, 0); scene.add(lamps);
    var bulbs = [];
    (function () {
      [[-2.4, HZ + 3.2], [2.3, HZ + 3.2], [-2.4, HZ + 6.6], [2.3, HZ + 6.6]].forEach(function (c) {
        var l = part(c[0], 0.1, c[1]);
        var post = mesh(new THREE.CylinderGeometry(0.055, 0.07, 1.05, 8), M.lamp);
        post.position.y = 0.52; l.add(post);
        var head = mesh(new THREE.BoxGeometry(0.22, 0.12, 0.22), M.lamp);
        head.position.y = 1.08; l.add(head);
        var b = mesh(new THREE.SphereGeometry(0.075, 10, 8), M.bulb, false, false);
        b.position.y = 1.0; l.add(b); bulbs.push(b);
        lamps.add(l);
      });
    })();
    regChildren(lamps, T.garden, "pop");

    var warmLight = new THREE.PointLight(0xffb164, 0, 30, 2);
    warmLight.position.set(0, Y_F1 + 2.4, HZ + 2.2);
    scene.add(warmLight);
    var innerLight = new THREE.PointLight(0xffc98a, 0, 26, 2);
    innerLight.position.set(0, Y_F1 + 1.9, 0);
    scene.add(innerLight);
    var innerLight2 = new THREE.PointLight(0xffc98a, 0, 24, 2);
    innerLight2.position.set(0, Y_F2 + 1.6, -1);
    scene.add(innerLight2);

    /* ============================================================
       GRUA
       ============================================================ */
    var crane = part(-17.5, 0, -9);
    scene.add(crane);
    var craneMat = M.steel.clone();
    craneMat.transparent = true;
    var jib = part(0, 0, 0);
    (function () {
      var MH = 17, s = 0.55;
      var base = mesh(new THREE.BoxGeometry(3, 0.5, 3), M.concreteDark);
      base.position.y = 0.25; crane.add(base);
      // mastro treliçado
      [[-s, -s], [s, -s], [s, s], [-s, s]].forEach(function (c) {
        var p = mesh(new THREE.BoxGeometry(0.14, MH, 0.14), craneMat);
        p.position.set(c[0], MH / 2 + 0.5, c[1]);
        crane.add(p);
      });
      for (var i = 0; i <= 11; i++) {
        var y = 0.9 + i * (MH / 11.6);
        [0, 1].forEach(function (ax) {
          var r = mesh(new THREE.BoxGeometry(ax ? 0.08 : s * 2.1, 0.08, ax ? s * 2.1 : 0.08), craneMat);
          r.position.set(0, y, 0); crane.add(r);
        });
        if (i < 11) {
          var dg = mesh(new THREE.BoxGeometry(0.07, Math.sqrt(Math.pow(MH / 11.6, 2) + Math.pow(s * 2, 2)), 0.07), craneMat);
          dg.position.set(0, y + (MH / 23.2), s);
          dg.rotation.z = (i % 2 ? 1 : -1) * Math.atan2(s * 2, MH / 11.6);
          crane.add(dg);
        }
      }
      // lança
      var jy = MH + 0.9;
      jib.position.y = jy;
      crane.add(jib);
      var cab = mesh(new THREE.BoxGeometry(1.1, 1.1, 1.1), craneMat);
      cab.position.set(0, -0.4, 0); jib.add(cab);
      [[-0.02, 0.25], [-0.02, -0.25]].forEach(function (o) {
        var chord = mesh(new THREE.BoxGeometry(26, 0.12, 0.12), craneMat);
        chord.position.set(4.5, o[0], o[1]); jib.add(chord);
      });
      var low = mesh(new THREE.BoxGeometry(24, 0.1, 0.1), craneMat);
      low.position.set(5, -0.85, 0); jib.add(low);
      for (var d = 0; d < 11; d++) {
        var di = mesh(new THREE.BoxGeometry(0.07, 1.3, 0.07), craneMat);
        di.position.set(-6.5 + d * 2.2, -0.42, 0);
        di.rotation.z = (d % 2 ? 0.9 : -0.9);
        jib.add(di);
      }
      var cw = mesh(new THREE.BoxGeometry(2.2, 1.5, 1.8), M.concreteDark);
      cw.position.set(-7.4, -0.6, 0); jib.add(cw);
      var tower = mesh(new THREE.BoxGeometry(0.12, 2.6, 0.12), craneMat);
      tower.position.y = 1.3; jib.add(tower);
      // estais (do topo da torre até as pontas da lança)
      [-7.2, 14].forEach(function (x) {
        var ty = mesh(new THREE.BoxGeometry(Math.sqrt(x * x + 2.6 * 2.6), 0.06, 0.06), craneMat, false, false);
        ty.position.set(x / 2, 1.3, 0);
        ty.rotation.z = Math.atan2(-2.6, x);
        jib.add(ty);
      });
      // cabo + gancho
      var cable = mesh(new THREE.BoxGeometry(0.05, 9, 0.05), craneMat, false, false);
      cable.position.set(9.5, -5, 0); jib.add(cable);
      var hook = mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), craneMat, false, false);
      hook.position.set(9.5, -9.4, 0); jib.add(hook);
      crane.userData.hook = hook;
      crane.userData.cable = cable;
    })();
    reg(crane, T.crane, "grow");
    regFade(craneMat, T.craneOut, "out");

    /* ============================================================
       ANDAIMES
       ============================================================ */
    var scaff = part(0, 0, 0); scene.add(scaff);
    var scaffMat = M.steel.clone();
    scaffMat.color = new THREE.Color(0x8b93a0);
    scaffMat.transparent = true;
    var plankMat = M.wood.clone(); plankMat.transparent = true;
    (function () {
      var topY = Y_B2 + 0.6;
      function bay(x, z, dirX) {
        var g = part(x, 0, z);
        [-1, 1].forEach(function (s) {
          var p = mesh(new THREE.CylinderGeometry(0.055, 0.055, topY, 6), scaffMat);
          p.position.set(dirX ? s * 0.9 : 0.55, topY / 2, dirX ? 0.55 : s * 0.9);
          g.add(p);
        });
        for (var lv = 1; lv <= 4; lv++) {
          var y = lv * (topY / 4.2);
          var rail = mesh(new THREE.BoxGeometry(dirX ? 1.9 : 0.09, 0.08, dirX ? 0.09 : 1.9), scaffMat);
          rail.position.set(dirX ? 0 : 0.55, y, dirX ? 0.55 : 0);
          g.add(rail);
          var plank = mesh(new THREE.BoxGeometry(dirX ? 1.9 : 0.9, 0.06, dirX ? 0.9 : 1.9), plankMat);
          plank.position.set(dirX ? 0 : 0.3, y + 0.05, dirX ? 0.3 : 0);
          g.add(plank);
        }
        return g;
      }
      for (var i = 0; i < 6; i++) scaff.add(bay(-HX + 1 + i * 2, HZ + 0.65, true));
      for (var j = 0; j < 4; j++) scaff.add(bay(HX + 0.65, -HZ + 1.4 + j * 2, false));
    })();
    scaff.children.forEach(function (c, i) {
      var sp = T.scaffold[1] - T.scaffold[0];
      var s = T.scaffold[0] + sp * 0.6 * (i / scaff.children.length);
      reg(c, [s, s + sp * 0.4], "grow");
    });
    regFade(scaffMat, T.scaffOut, "out");
    regFade(plankMat, T.scaffOut, "out");

    /* ============================================================
       POEIRA DE OBRA
       ============================================================ */
    var dust;
    (function () {
      var n = mobile ? 110 : 240, pos = new Float32Array(n * 3);
      for (var i = 0; i < n; i++) {
        pos[i * 3] = (Math.random() - 0.5) * 46;
        pos[i * 3 + 1] = Math.random() * 13;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 40;
      }
      var g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      var c = document.createElement("canvas"); c.width = c.height = 64;
      var ctx = c.getContext("2d");
      var rg = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      rg.addColorStop(0, "rgba(255,236,196,.9)"); rg.addColorStop(1, "rgba(255,236,196,0)");
      ctx.fillStyle = rg; ctx.fillRect(0, 0, 64, 64);
      var m = new THREE.PointsMaterial({
        size: 0.22, map: new THREE.CanvasTexture(c), transparent: true, opacity: 0,
        depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true
      });
      dust = new THREE.Points(g, m);
      scene.add(dust);
    })();

    /* ---------------- otimização de sombras ----------------
       Peças leves não projetam sombra: menos draw calls no shadow map. */
    [crane, scaff, framesG, glassG, railing, lamps, dust].forEach(function (root) {
      root.traverse(function (o) { if (o.isMesh || o.isPoints) { o.castShadow = false; o.receiveShadow = false; } });
    });
    plasterG.traverse(function (o) { if (o.isMesh) o.castShadow = false; });

    /* ============================================================
       ATUALIZAÇÃO POR PROGRESSO
       ============================================================ */
    var skyFog = new THREE.Color(0x0d1730);
    var duskFog = new THREE.Color(0x141c33);
    var dirtColor = new THREE.Color(0x4b4437);
    var grassColor = new THREE.Color(0x35553c);
    var tmpColor = new THREE.Color();

    var camPos = new THREE.Vector3(CAM[0].pos[0], CAM[0].pos[1], CAM[0].pos[2]);
    var camLook = new THREE.Vector3(CAM[0].look[0], CAM[0].look[1], CAM[0].look[2]);
    var curPos = camPos.clone();
    var curLook = camLook.clone();
    var progress = 0, target = 0, active = true;

    function camAt(p) {
      var i = 0;
      for (; i < CAM.length - 2; i++) { if (p < CAM[i + 1].p) break; }
      var a = CAM[i], b = CAM[i + 1];
      var t = smooth(inv(p, a.p, b.p));
      camPos.set(lerp(a.pos[0], b.pos[0], t), lerp(a.pos[1], b.pos[1], t), lerp(a.pos[2], b.pos[2], t));
      camLook.set(lerp(a.look[0], b.look[0], t), lerp(a.look[1], b.look[1], t), lerp(a.look[2], b.look[2], t));
    }

    function applyParts(p) {
      for (var i = 0; i < parts.length; i++) {
        var it = parts[i], raw = inv(p, it.a, it.b), t;
        switch (it.type) {
          case "grow":
            it.obj.visible = raw > 0.0015;
            it.obj.scale.y = Math.max(0.0001, easeOut(raw));
            break;
          case "pop":
            t = raw <= 0 ? 0 : easeOutBack(raw);
            it.obj.visible = raw > 0.0015;
            it.obj.scale.setScalar(Math.max(0.0001, t));
            break;
          case "drop":
            it.obj.visible = raw > 0.0015;
            it.obj.position.y = it.y0 + (1 - easeOut(raw)) * (it.h || 6);
            break;
          case "sweepX":
            it.obj.visible = raw > 0.0015;
            it.obj.scale.x = Math.max(0.0001, easeOut(raw));
            break;
          case "sweepZ":
            it.obj.visible = raw > 0.0015;
            it.obj.scale.z = Math.max(0.0001, easeOut(raw));
            break;
          case "fadeGroup":
            it.obj.visible = raw > 0.0015;
            it.obj.scale.y = Math.max(0.0001, easeOut(raw));
            break;
          case "hideAfter":
            it.obj.visible = it.obj.visible && raw < 0.999;
            break;
        }
      }
      for (var f = 0; f < fades.length; f++) {
        var fd = fades[f], v = smooth(inv(p, fd.a, fd.b));
        fd.mat.opacity = fd.out ? 1 - v : v;
        fd.mat.visible = fd.mat.opacity > 0.004;
      }
    }

    function applyScene(p) {
      // malha topográfica
      var gIn = smooth(inv(p, T.grid[0], T.grid[1]));
      var gOut = smooth(inv(p, T.gridOut[0], T.gridOut[1]));
      grid.material.opacity = 0.5 * gIn * (1 - gOut);
      grid.visible = grid.material.opacity > 0.005;
      outlineMat.opacity = 0.9 * gIn * (1 - gOut);
      outline.visible = outlineMat.opacity > 0.005;

      // terra -> grama
      var gr = smooth(inv(p, T.grass[0], T.grass[1]));
      tmpColor.copy(dirtColor).lerp(grassColor, gr);
      groundMat.color.copy(tmpColor);
      groundMat.roughness = lerp(1, 0.88, gr);

      // entardecer + luzes
      var dk = smooth(inv(p, T.dusk[0], T.dusk[1]));
      scene.fog.color.copy(skyFog).lerp(duskFog, dk);
      hemi.intensity = lerp(0.75, 0.42, dk);
      sun.intensity = lerp(2.15, 0.95, dk);
      sun.color.setHSL(lerp(0.13, 0.085, dk), lerp(0.45, 0.72, dk), 0.62);
      rim.intensity = lerp(0.85, 1.3, dk);

      var li = smooth(inv(p, T.lights[0], T.lights[1]));
      M.bulb.emissiveIntensity = li * 6;
      M.glass.emissiveIntensity = li * 1.35;
      M.glass.opacity = lerp(0.34, 0.62, li);
      M.glass.roughness = lerp(0.06, 0.2, li);
      warmLight.intensity = li * 260;
      innerLight.intensity = li * 210;
      innerLight2.intensity = li * 170;

      // poeira de obra: só durante a execução
      var dIn = smooth(inv(p, 0.17, 0.26));
      var dOut = smooth(inv(p, 0.80, 0.88));
      dust.material.opacity = 0.5 * dIn * (1 - dOut);
      dust.visible = dust.material.opacity > 0.006;
    }

    /* ---------------- loop ---------------- */
    var raf = 0, time = 0;
    function frame() {
      raf = requestAnimationFrame(frame);
      var dt = Math.min(clock.getDelta(), 0.05);
      time += dt;

      // suavização do progresso (efeito "scrub" da Apple)
      progress += (target - progress) * (1 - Math.exp(-dt * 7.5));
      if (Math.abs(target - progress) < 0.00004) progress = target;

      applyParts(progress);
      applyScene(progress);
      camAt(progress);

      // deriva sutil da câmera
      var sway = Math.sin(time * 0.25) * 0.55 * (1 - progress * 0.5);
      var bob = Math.cos(time * 0.19) * 0.22;
      var k = 1 - Math.exp(-dt * 3.4);
      curPos.lerp(camPos, k);
      curLook.lerp(camLook, k);
      camera.position.set(curPos.x + sway, curPos.y + bob, curPos.z);
      camera.lookAt(curLook);

      // grua gira devagar
      if (crane.visible) {
        jib.rotation.y = Math.sin(time * 0.1) * 0.85 - 0.6;
        var h = crane.userData.hook, cb = crane.userData.cable;
        var L = 6.4 + Math.sin(time * 0.33) * 2.6;   // comprimento do cabo
        cb.scale.y = L / 9;
        cb.position.y = -0.5 - L / 2;
        h.position.y = -0.7 - L;
      }

      if (dust.visible) {
        dust.rotation.y = time * 0.012;
        dust.position.y = Math.sin(time * 0.2) * 0.4;
      }

      sun.target.position.set(0, 3, 0);
      renderer.render(scene, camera);
    }

    function resize() {
      var w = window.innerWidth, h = window.innerHeight;
      camera.aspect = w / h;
      // em telas estreitas, afasta um pouco a câmera para a casa caber
      camera.fov = w / h < 1 ? 54 : 42;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, w < 760 ? 1.6 : 2));
    }

    resize();
    applyParts(0);
    applyScene(0);
    frame();

    return {
      setProgress: function (p) { target = clamp(p, 0, 1); },
      jumpTo: function (p) { target = progress = clamp(p, 0, 1); },
      setActive: function (v) {
        if (v === active) return;
        active = v;
        if (active) { clock.getDelta(); frame(); }
        else { cancelAnimationFrame(raf); raf = 0; }
      },
      resize: resize,
      renderer: renderer
    };
  }

  global.KNOScene = { init: init, timeline: T };
})(window);
