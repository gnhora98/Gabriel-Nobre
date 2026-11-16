/* ============================================================
 * Garagem 3D: modelos feitos em código (three.js).
 * Meteor 650: cruiser bicilíndrica, tanque em gota, farol redondo,
 * motor aletado, escapes "peashooter", banco em dois níveis.
 * Eixos: x = frente, y = cima, z = lateral. Unidades em metros.
 * ============================================================ */
const Moto3D = (() => {
  if (!window.THREE) return null;
  const T = THREE;
  let renderer;
  try {
    renderer = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  } catch (e) { return null; }
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = T.SRGBColorSpace;

  const scene = new T.Scene();
  // Ambiente de estúdio (softboxes) para reflexos realistas na pintura e nos cromados.
  const pmrem = new T.PMREMGenerator(renderer);
  const studio = new T.Scene();
  studio.add(new T.Mesh(new T.BoxGeometry(30, 14, 30), new T.MeshBasicMaterial({ color: 0x1b2027, side: T.BackSide })));
  const soft = (w, h, x, y, z, ry, rx, c) => {
    const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: c, side: T.DoubleSide }));
    m.position.set(x, y, z); m.rotation.set(rx || 0, ry || 0, 0); studio.add(m);
  };
  soft(14, 3, 0, 6.8, 0, 0, Math.PI / 2, 0xffffff);
  soft(6, 4, -9, 3, 4, Math.PI / 2, 0, 0xdfe8ff);
  soft(6, 4, 9, 3, -4, -Math.PI / 2, 0, 0xfff1dc);
  soft(10, 1.2, 0, 1.2, -14, 0, 0, 0x9aa7b8);
  scene.environment = pmrem.fromScene(studio, 0.035).texture;

  scene.add(new T.HemisphereLight(0xffffff, 0x2a3038, 0.55));
  const key = new T.DirectionalLight(0xffffff, 1.6); key.position.set(3, 5, 2.5); scene.add(key);
  const rim = new T.DirectionalLight(0xbfd4ff, 0.8); rim.position.set(-4, 2.5, -3); scene.add(rim);

  const camera = new T.PerspectiveCamera(30, 1, 0.1, 50);
  const holder = new T.Group(); scene.add(holder);

  // Sombra de contato (gradiente radial).
  const shadowTex = (() => {
    const c = document.createElement("canvas"); c.width = c.height = 128;
    const g = c.getContext("2d"); const r = g.createRadialGradient(64, 64, 4, 64, 64, 64);
    r.addColorStop(0, "rgba(0,0,0,.55)"); r.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = r; g.fillRect(0, 0, 128, 128); return new T.CanvasTexture(c);
  })();

  /* ---------- materiais ---------- */
  const mats = (color) => ({
    paint: new T.MeshPhysicalMaterial({ color, metalness: 0.35, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.06 }),
    chrome: new T.MeshStandardMaterial({ color: 0xf2f4f7, metalness: 1, roughness: 0.08 }),
    alu: new T.MeshStandardMaterial({ color: 0xbfc5cd, metalness: 0.9, roughness: 0.28 }),
    black: new T.MeshStandardMaterial({ color: 0x15171a, metalness: 0.4, roughness: 0.5 }),
    engine: new T.MeshStandardMaterial({ color: 0x2b2e33, metalness: 0.7, roughness: 0.4 }),
    rubber: new T.MeshStandardMaterial({ color: 0x101112, metalness: 0, roughness: 0.92 }),
    seat: new T.MeshStandardMaterial({ color: 0x1d1612, metalness: 0, roughness: 0.78 }),
    lens: new T.MeshStandardMaterial({ color: 0xfff8e6, emissive: 0xfff1cc, emissiveIntensity: 0.6, roughness: 0.1 }),
    red: new T.MeshStandardMaterial({ color: 0xb3121a, emissive: 0x7a0a10, emissiveIntensity: 0.6, roughness: 0.3 }),
    amber: new T.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0x7a4a05, emissiveIntensity: 0.5, roughness: 0.3 }),
    gold: new T.MeshStandardMaterial({ color: 0xd4af37, metalness: 1, roughness: 0.25 }),
    glass: new T.MeshPhysicalMaterial({ color: 0x0f1820, metalness: 0.2, roughness: 0.05, transmission: 0, clearcoat: 1 }),
  });

  /* ---------- auxiliares de geometria ---------- */
  const V = (x, y, z) => new T.Vector3(x, y, z || 0);
  function rod(a, b, r, mat, seg = 14) {
    const dir = new T.Vector3().subVectors(b, a); const len = dir.length();
    const m = new T.Mesh(new T.CylinderGeometry(r, r, len, seg), mat);
    m.position.copy(a).addScaledVector(dir, 0.5);
    m.quaternion.setFromUnitVectors(V(0, 1, 0), dir.normalize());
    return m;
  }
  function tube(points, r, mat, seg = 48) {
    return new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points), seg, r, 12, false), mat);
  }
  function wheel(R, M, opts = {}) {
    const g = new T.Group();
    const tireR = opts.knobby ? 0.075 : 0.062;
    g.add(new T.Mesh(new T.TorusGeometry(R - tireR, tireR, 18, 64), M.rubber));
    g.add(new T.Mesh(new T.TorusGeometry(R - tireR * 2 - 0.006, 0.016, 10, 64), M.alu));
    const hub = new T.Mesh(new T.CylinderGeometry(0.055, 0.055, 0.13, 20), M.alu); hub.rotation.x = Math.PI / 2; g.add(hub);
    const spokes = opts.spokes || 10;
    for (let i = 0; i < spokes; i++) {
      const a = (i / spokes) * Math.PI * 2;
      const s = new T.Mesh(new T.BoxGeometry(R - tireR * 2 - 0.05, 0.018, 0.022), opts.wire ? M.chrome : M.black);
      s.position.set(Math.cos(a) * (R - tireR * 2) / 2, Math.sin(a) * (R - tireR * 2) / 2, 0);
      s.rotation.z = a; g.add(s);
    }
    if (opts.disc) {
      const d = new T.Mesh(new T.CylinderGeometry(0.15, 0.15, 0.006, 40), M.chrome);
      d.rotation.x = Math.PI / 2; d.position.z = 0.07; g.add(d);
    }
    return g;
  }
  function fender(R, startDeg, arcDeg, width, M) {
    const m = new T.Mesh(new T.TorusGeometry(R, 0.045, 10, 40, (arcDeg * Math.PI) / 180), M.paint);
    m.rotation.z = (startDeg * Math.PI) / 180; m.scale.z = width / 0.09; return m;
  }

  /* ---------- Meteor 650 (e variações de moto) ---------- */
  function buildMoto(color, variant) {
    const M = mats(color);
    const g = new T.Group();
    const trail = variant === "TRAIL";
    const fx = 0.72, fy = trail ? 0.37 : 0.345, rx = -0.7, ry = trail ? 0.35 : 0.32;

    // Rodas
    const fw = wheel(fy, M, { disc: true, knobby: trail, wire: trail, spokes: trail ? 28 : 10 }); fw.position.set(fx, fy, 0); g.add(fw);
    const rw = wheel(ry, M, { knobby: trail, wire: trail, spokes: trail ? 28 : 10 }); rw.position.set(rx, ry, 0); g.add(rw);
    const rwDisc = new T.Mesh(new T.CylinderGeometry(0.12, 0.12, 0.006, 32), M.chrome); rwDisc.rotation.x = Math.PI / 2; rwDisc.position.set(rx, ry, -0.07); g.add(rwDisc);

    // Garfo dianteiro (cromado em baixo, preto em cima)
    const head = V(0.5, trail ? 1.06 : 0.98);
    for (const z of [-0.085, 0.085]) {
      const a = V(fx, fy, z), b = V(head.x, head.y, z);
      const mid = a.clone().lerp(b, 0.55);
      g.add(rod(a, mid, 0.024, M.chrome));
      g.add(rod(mid, b, 0.03, M.black));
    }
    const clamp = new T.Mesh(new T.BoxGeometry(0.09, 0.03, 0.24), M.alu); clamp.position.set(head.x, head.y, 0); g.add(clamp);

    // Paralamas
    const ff = fender(fy + 0.035, trail ? 50 : 25, trail ? 80 : 130, 0.14, M); ff.position.set(fx, fy, 0); g.add(ff);
    const rf = fender(ry + 0.045, trail ? 70 : 45, trail ? 90 : 135, 0.2, M); rf.position.set(rx, ry, 0); g.add(rf);

    // Farol redondo com aro cromado
    const hl = new T.Group();
    const bucket = new T.Mesh(new T.CylinderGeometry(0.1, 0.075, 0.13, 32), M.chrome); bucket.rotation.z = -Math.PI / 2; hl.add(bucket);
    const bezel = new T.Mesh(new T.TorusGeometry(0.098, 0.012, 10, 40), M.chrome); bezel.rotation.y = Math.PI / 2; bezel.position.x = 0.066; hl.add(bezel);
    const lens = new T.Mesh(new T.CircleGeometry(0.09, 32), M.lens); lens.rotation.y = Math.PI / 2; lens.position.x = 0.067; hl.add(lens);
    hl.position.set(head.x + 0.1, head.y - 0.02, 0); g.add(hl);

    // Painel, guidão, manoplas e retrovisores
    const pod = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 0.035, 24), M.black); pod.position.set(head.x - 0.02, head.y + 0.1, 0); pod.rotation.z = 0.5; g.add(pod);
    const hb = trail ? 1.18 : 1.1;
    g.add(tube([V(0.4, hb - 0.03, -0.36), V(0.45, hb + 0.03, -0.22), V(0.48, hb, 0), V(0.45, hb + 0.03, 0.22), V(0.4, hb - 0.03, 0.36)], 0.013, M.chrome));
    for (const z of [-1, 1]) {
      g.add(rod(V(0.4, hb - 0.03, 0.33 * z), V(0.39, hb - 0.035, 0.44 * z), 0.019, M.rubber));
      g.add(rod(V(0.43, hb, 0.26 * z), V(0.39, hb + 0.13, 0.31 * z), 0.007, M.chrome));
      const mir = new T.Mesh(new T.CylinderGeometry(0.052, 0.052, 0.014, 28), M.chrome); mir.rotation.z = Math.PI / 2; mir.position.set(0.39, hb + 0.15, 0.31 * z); g.add(mir);
      // piscas
      const s1 = new T.Mesh(new T.SphereGeometry(0.022, 14, 10), M.amber); s1.position.set(head.x + 0.05, head.y - 0.04, 0.16 * z); g.add(s1);
      const s2 = new T.Mesh(new T.SphereGeometry(0.02, 14, 10), M.amber); s2.position.set(-0.98, 0.8, 0.12 * z); g.add(s2);
    }

    // Tanque em gota (lathe girado para o eixo x)
    const tankPts = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24; const r = 0.19 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.02)), 0.7) * (0.82 + 0.25 * t);
      tankPts.push(new T.Vector2(Math.max(0.001, r), t * 0.64));
    }
    const tank = new T.Mesh(new T.LatheGeometry(tankPts, 48), M.paint);
    tank.rotation.z = -Math.PI / 2; tank.scale.set(trail ? 0.85 : 1, 1, trail ? 0.8 : 0.72);
    tank.position.set(-0.2, trail ? 0.99 : 0.9, 0); g.add(tank);
    // emblema dourado nas laterais e friso cromado
    for (const z of [-1, 1]) {
      const em = new T.Mesh(new T.CircleGeometry(0.045, 24), M.gold); em.position.set(0.16, trail ? 0.99 : 0.91, 0.135 * z); if (z < 0) em.rotation.y = Math.PI; g.add(em);
    }
    const cap = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, 0.02, 20), M.chrome); cap.position.set(0.22, trail ? 1.12 : 1.04, 0); g.add(cap);

    // Banco em dois níveis (piloto baixo, garupa elevado)
    const seat1 = new T.Mesh(new T.CapsuleGeometry(0.07, 0.28, 8, 20), M.seat); seat1.rotation.z = Math.PI / 2; seat1.scale.set(1, 1, 2.2); seat1.position.set(-0.32, trail ? 0.92 : 0.8, 0); g.add(seat1);
    const seat2 = new T.Mesh(new T.CapsuleGeometry(0.055, 0.18, 8, 20), M.seat); seat2.rotation.z = Math.PI / 2; seat2.scale.set(1, 1, 2.0); seat2.position.set(-0.64, trail ? 0.96 : 0.88, 0); g.add(seat2);
    if (!trail) g.add(tube([V(-0.55, 0.86, -0.16), V(-0.8, 0.9, -0.15), V(-0.88, 0.9, 0), V(-0.8, 0.9, 0.15), V(-0.55, 0.86, 0.16)], 0.012, M.chrome));

    // Quadro (berço duplo)
    for (const z of [-0.075, 0.075]) {
      g.add(tube([V(0.47, 0.9, z), V(0.38, 0.5, z), V(0.3, 0.24, z), V(-0.1, 0.22, z), V(-0.22, 0.5, z), V(-0.12, 0.86, z)], 0.02, M.black));
      g.add(tube([V(-0.12, 0.86, z), V(-0.5, 0.8, z * 1.4), V(-0.92, 0.8, z * 1.3)], 0.017, M.black));
    }
    g.add(tube([V(0.5, 0.98, 0), V(0.1, 0.9, 0), V(-0.15, 0.86, 0)], 0.026, M.black));

    // Motor bicilíndrico: cárter + cilindros aletados + tampas
    const crank = new T.Mesh(new T.BoxGeometry(0.44, 0.2, 0.28), M.engine); crank.position.set(0.04, 0.36, 0); g.add(crank);
    for (const z of [-1, 1]) {
      const cv = new T.Mesh(new T.CylinderGeometry(0.1, 0.1, 0.03, 32), M.alu); cv.rotation.x = Math.PI / 2; cv.position.set(0.0, 0.36, 0.155 * z); g.add(cv);
      const cv2 = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 0.035, 28), M.chrome); cv2.rotation.x = Math.PI / 2; cv2.position.set(0.15, 0.33, 0.16 * z); g.add(cv2);
    }
    const fins = new T.Group();
    for (let i = 0; i < 10; i++) {
      const f = new T.Mesh(new T.BoxGeometry(0.19, 0.011, 0.3), i % 2 ? M.engine : M.alu);
      f.position.y = i * 0.021; fins.add(f);
    }
    const headCover = new T.Mesh(new T.BoxGeometry(0.17, 0.06, 0.3), M.alu); headCover.position.y = 0.23; fins.add(headCover);
    fins.position.set(0.12, 0.47, 0); fins.rotation.z = -0.22; g.add(fins);

    // Escapamentos duplos (coletores cromados + ponteiras "peashooter")
    for (const z of [-1, 1]) {
      if (trail && z < 0) continue;
      const pipe = trail
        ? [V(0.22, 0.58, 0.09 * z), V(0.3, 0.45, 0.17 * z), V(0.05, 0.42, 0.2 * z), V(-0.3, 0.62, 0.17 * z), V(-0.55, 0.7, 0.17 * z)]
        : [V(0.2, 0.6, 0.08 * z), V(0.32, 0.46, 0.13 * z), V(0.24, 0.27, 0.18 * z), V(-0.05, 0.26, 0.19 * z), V(-0.3, 0.3, 0.19 * z)];
      g.add(tube(pipe, 0.022, M.chrome));
      const muff = new T.Mesh(new T.CylinderGeometry(0.042, 0.05, trail ? 0.38 : 0.62, 28), M.chrome);
      muff.rotation.z = Math.PI / 2 + (trail ? -0.2 : -0.06);
      muff.position.set(trail ? -0.72 : -0.6, trail ? 0.74 : 0.33, (trail ? 0.17 : 0.19) * z); g.add(muff);
      const tip = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, 0.01, 20), M.black); tip.rotation.z = Math.PI / 2; tip.position.set(trail ? -0.91 : -0.915, trail ? 0.78 : 0.35, (trail ? 0.17 : 0.19) * z); g.add(tip);
    }

    // Balança, amortecedores, corrente e pedaleiras
    for (const z of [-1, 1]) {
      g.add(rod(V(-0.12, 0.38, 0.11 * z), V(rx, ry, 0.11 * z), 0.024, M.black));
      g.add(rod(V(-0.56, trail ? 0.88 : 0.8, 0.13 * z), V(-0.66, ry + 0.04, 0.12 * z), 0.017, M.chrome));
      g.add(rod(V(-0.575, trail ? 0.78 : 0.7, 0.13 * z), V(-0.64, ry + 0.16, 0.12 * z), 0.032, M.black));
      g.add(rod(V(trail ? 0.05 : 0.3, 0.36, 0.17 * z), V(trail ? 0.05 : 0.3, 0.36, 0.26 * z), 0.016, M.rubber));
      g.add(rod(V(-0.36, 0.42, 0.16 * z), V(-0.36, 0.42, 0.24 * z), 0.013, M.rubber));
      const side = new T.Mesh(new T.BoxGeometry(0.22, 0.15, 0.02), M.paint); side.position.set(-0.24, 0.62, 0.13 * z); g.add(side);
    }
    const chain = new T.Mesh(new T.BoxGeometry(0.62, 0.035, 0.02), M.black); chain.position.set(-0.38, 0.4, -0.15); chain.rotation.z = 0.06; g.add(chain);

    // Traseira: lanterna, placa
    const tail = new T.Mesh(new T.BoxGeometry(0.03, 0.05, 0.11), M.red); tail.position.set(-0.98, 0.82, 0); g.add(tail);
    const plate = new T.Mesh(new T.BoxGeometry(0.01, 0.12, 0.18), M.black); plate.position.set(-0.99, 0.7, 0); g.add(plate);
    if (trail) { const bash = new T.Mesh(new T.BoxGeometry(0.4, 0.04, 0.22), M.alu); bash.position.set(0.06, 0.22, 0); g.add(bash); }
    return g;
  }

  /* ---------- Carros (perfil extrudado) ---------- */
  function buildCar(color, model) {
    const M = mats(color);
    const g = new T.Group();
    const L = model === "SEDAN" ? 4.4 : model === "SUV" ? 4.4 : 4.0, H = model === "SUV" ? 1.65 : 1.48, W = model === "SUV" ? 1.8 : 1.7;
    const wheelR = model === "SUV" ? 0.36 : 0.31;
    const s = new T.Shape();
    const x0 = -L / 2, x1 = L / 2, belt = H * 0.55, roof = H, rearDrop = model === "HATCH" ? 0.15 : model === "SUV" ? 0.08 : 0.35;
    s.moveTo(x0, 0.28); s.lineTo(x0, belt - 0.05); s.quadraticCurveTo(x0, belt + 0.05, x0 + 0.2, belt + 0.05);
    s.lineTo(x0 + (model === "SEDAN" ? 0.9 : 0.35), belt + 0.08);
    s.lineTo(x0 + (model === "SEDAN" ? 1.3 : 0.55), roof - (model === "SEDAN" ? 0.02 : rearDrop * 0.2));
    s.lineTo(x1 - (model === "SUV" ? 1.35 : 1.6), roof);
    s.lineTo(x1 - 1.05, belt + 0.1); s.lineTo(x1 - 0.25, belt - 0.02);
    s.quadraticCurveTo(x1, belt - 0.05, x1, belt - 0.25); s.lineTo(x1, 0.28); s.lineTo(x0, 0.28);
    const body = new T.Mesh(new T.ExtrudeGeometry(s, { depth: W - 0.12, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 4, curveSegments: 16 }), M.paint);
    body.position.z = -(W - 0.12) / 2; g.add(body);
    // vidros
    const gl = new T.Shape();
    gl.moveTo(x0 + (model === "SEDAN" ? 1.0 : 0.45), belt + 0.12);
    gl.lineTo(x0 + (model === "SEDAN" ? 1.34 : 0.6), roof - 0.08);
    gl.lineTo(x1 - (model === "SUV" ? 1.4 : 1.65), roof - 0.08);
    gl.lineTo(x1 - 1.12, belt + 0.14); gl.lineTo(x0 + 0.45, belt + 0.12);
    const glass = new T.Mesh(new T.ExtrudeGeometry(gl, { depth: W - 0.02, bevelEnabled: false }), M.glass);
    glass.position.z = -(W - 0.02) / 2; g.add(glass);
    for (const [x, z] of [[x0 + 0.85, 1], [x0 + 0.85, -1], [x1 - 0.8, 1], [x1 - 0.8, -1]]) {
      const w = wheel(wheelR, M, { spokes: 5 }); w.scale.z = 1.6; w.position.set(x, wheelR, (W / 2 - 0.08) * z); g.add(w);
    }
    for (const z of [-1, 1]) {
      const hl = new T.Mesh(new T.BoxGeometry(0.04, 0.09, 0.3), M.lens); hl.position.set(x1 + 0.04, belt - 0.12, (W / 2 - 0.3) * z); g.add(hl);
      const tl = new T.Mesh(new T.BoxGeometry(0.04, 0.1, 0.32), M.red); tl.position.set(x0 - 0.04, belt - 0.05, (W / 2 - 0.3) * z); g.add(tl);
    }
    g.scale.setScalar(0.5); // escala para caber no mesmo enquadramento da moto
    return g;
  }

  let current = { key: "", obj: null, shadow: null };
  function setVehicle(model, color) {
    const k = model + color;
    if (current.key === k) return;
    if (current.obj) holder.remove(current.obj);
    const isMoto = ["METEOR", "CUSTOM", "TRAIL"].includes(model);
    const obj = isMoto ? buildMoto(color, model) : buildCar(color, model);
    if (model === "CUSTOM") obj.scale.set(1.06, 0.94, 1.02);
    if (!current.shadow) {
      current.shadow = new T.Mesh(new T.PlaneGeometry(2.8, 1.3), new T.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
      current.shadow.rotation.x = -Math.PI / 2; current.shadow.position.y = 0.002; holder.add(current.shadow);
    }
    holder.add(obj); current = { key: k, obj, shadow: current.shadow };
  }

  /* Enquadramentos: hero (3/4), side (lateral), chase (de trás e de cima, para o mapa), top (de cima). */
  function frame(view, yaw = 0, pitch = 0) {
    holder.rotation.set(0, 0, 0);
    current.shadow.visible = view !== "chase" && view !== "top";
    if (view === "hero") { holder.rotation.y = yaw; camera.fov = 26; camera.position.set(2.7, 1.25 + pitch, 3.6); camera.up.set(0, 1, 0); camera.lookAt(0, 0.55, 0); }
    if (view === "side") { holder.rotation.y = 0; camera.fov = 24; camera.position.set(0, 0.62, 5.6); camera.up.set(0, 1, 0); camera.lookAt(0, 0.58, 0); }
    if (view === "chase") { camera.fov = 30; camera.position.set(-3.3, 2.7, 0); camera.up.set(0, 1, 0); camera.lookAt(0.35, 0.45, 0); }
    if (view === "top") { camera.fov = 30; camera.position.set(0, 6.2, 0.0001); camera.up.set(1, 0, 0); camera.lookAt(0, 0, 0); }
    camera.updateProjectionMatrix();
  }

  const stillCache = new Map();
  let needsSize = false; // o visualizador volta ao próprio tamanho depois de gerar uma imagem
  /** Renderiza uma imagem (data URL) do veículo; usada no celular, no carro e no mapa. */
  function still(model, color, view, w, h) {
    const k = [model, color, view, w, h].join("|");
    if (stillCache.has(k)) return stillCache.get(k);
    setVehicle(model, color);
    renderer.setSize(w, h, false); camera.aspect = w / h; frame(view);
    renderer.setClearColor(0x000000, 0); renderer.render(scene, camera);
    const url = renderer.domElement.toDataURL("image/png");
    needsSize = true;
    stillCache.set(k, url); return url;
  }

  /** Visualizador 3D interativo da garagem: arrastar gira 360°, solta e ele gira devagar. */
  function mountViewer(container, model, color) {
    setVehicle(model, color);
    const cv = renderer.domElement; cv.className = "viewer3d"; container.prepend(cv);
    let yaw = 0.6, pitch = 0, vel = 0.004, dragging = false, lastX = 0, lastY = 0, raf = 0, alive = true;
    const size = () => { const r = container.getBoundingClientRect(); const w = Math.max(10, r.width), h = Math.max(10, r.width * 0.62); renderer.setSize(w, h); camera.aspect = w / h; };
    const loop = () => {
      if (!alive) return;
      if (needsSize) { needsSize = false; setVehicle(model, color); size(); }
      if (!dragging) yaw += vel;
      frame("hero", yaw, pitch); renderer.setClearColor(0x000000, 0); renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    const down = (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; vel = 0; cv.setPointerCapture?.(e.pointerId); };
    const move = (e) => { if (!dragging) return; yaw += (e.clientX - lastX) * 0.012; pitch = Math.max(-0.9, Math.min(1.6, pitch - (e.clientY - lastY) * 0.006)); vel = (e.clientX - lastX) * 0.0015; lastX = e.clientX; lastY = e.clientY; };
    const up = () => { dragging = false; vel = Math.max(-0.02, Math.min(0.02, vel || 0.004)); };
    cv.addEventListener("pointerdown", down); cv.addEventListener("pointermove", move);
    cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
    size(); loop();
    return () => { alive = false; cancelAnimationFrame(raf); cv.removeEventListener("pointerdown", down); cv.removeEventListener("pointermove", move); cv.removeEventListener("pointerup", up); cv.removeEventListener("pointercancel", up); cv.remove(); };
  }

  return { still, mountViewer, setVehicle };
})();
