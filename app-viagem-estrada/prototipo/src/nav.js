/* ============================================================
 * Navegação no Android Auto: mapa MapLibre com a geometria real
 * da rota (OpenStreetMap/OSRM, embutida = funciona offline),
 * câmera seguindo o veículo, inclinada e girando com a estrada.
 * ============================================================ */
const Nav = (() => {
  const R_EARTH = 6371000, rad = Math.PI / 180;
  const hav = (a, b) => {
    const dLa = (b[1] - a[1]) * rad, dLo = (b[0] - a[0]) * rad;
    const h = Math.sin(dLa / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLo / 2) ** 2;
    return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(h)));
  };
  const bearing = (a, b) => {
    const y = Math.sin((b[0] - a[0]) * rad) * Math.cos(b[1] * rad);
    const x = Math.cos(a[1] * rad) * Math.sin(b[1] * rad) - Math.sin(a[1] * rad) * Math.cos(b[1] * rad) * Math.cos((b[0] - a[0]) * rad);
    return (Math.atan2(y, x) / rad + 360) % 360;
  };
  const dest = (p, brg, d) => {
    const la1 = p[1] * rad, lo1 = p[0] * rad, b = brg * rad, dr = d / R_EARTH;
    const la2 = Math.asin(Math.sin(la1) * Math.cos(dr) + Math.cos(la1) * Math.sin(dr) * Math.cos(b));
    const lo2 = lo1 + Math.atan2(Math.sin(b) * Math.sin(dr) * Math.cos(la1), Math.cos(dr) - Math.sin(la1) * Math.sin(la2));
    return [lo2 / rad, la2 / rad];
  };

  /** Prepara uma rota: distâncias acumuladas para achar pontos pela distância. */
  function prep(r) {
    if (r.cum) return r;
    const cum = [0];
    for (let i = 1; i < r.line.length; i++) cum.push(cum[i - 1] + hav(r.line[i - 1], r.line[i]));
    r.cum = cum; r.total = cum[cum.length - 1];
    const ends = []; let acc = 0; for (const l of r.legs) { acc += l; ends.push(acc); }
    // as distâncias das pernas (OSRM) somam ~ o total da linha simplificada: normaliza
    r.legEnds = ends.map((e) => (e / acc) * r.total);
    r.stepAt = r.steps.map((s) => (s.d / acc) * r.total);
    return r;
  }
  function along(r, s) {
    s = Math.max(0, Math.min(r.total, s));
    let lo = 0, hi = r.cum.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (r.cum[m] <= s) lo = m; else hi = m; }
    const seg = r.cum[hi] - r.cum[lo] || 1, f = (s - r.cum[lo]) / seg, a = r.line[lo], b = r.line[hi];
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
  }

  let map = null, ready = false, route = null, marker = null, markerImg = null, labels = [];
  let follow = true, tilt = true, heading = 0, lastS = 0, accent = "#F5A524", camZoom = 16.2;
  let sprites = { chase: "", top: "" };

  function available() { return !!window.maplibregl && (() => { try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch (e) { return false; } })(); }

  let basemap = false;
  function init(container, baseStyle) {
    if (map || !available()) return !!map;
    basemap = !!baseStyle;
    map = new maplibregl.Map({
      container, interactive: false, attributionControl: false, fadeDuration: 0, pitch: 60, zoom: 15, center: [-38.5, -3.7],
      style: baseStyle || {
        version: 8, sources: {},
        layers: [{ id: "bg", type: "background", paint: { "background-color": "#1c232b" } }],
      },
    });
    map.on("load", () => {
      const W = (a, b) => ["interpolate", ["exponential", 2], ["zoom"], 8, a, 18, b];
      map.addSource("stubs", { type: "geojson", data: empty() });
      map.addSource("route", { type: "geojson", data: empty(), lineMetrics: true });
      map.addSource("stops", { type: "geojson", data: empty() });
      if (basemap) {
        // Mapa real por baixo: só a rota (com borda) por cima das ruas.
        map.addLayer({ id: "road-casing", type: "line", source: "route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#0d1117", "line-width": W(3, 46) } });
        map.addLayer({ id: "route", type: "line", source: "route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-width": W(2, 30), "line-gradient": grad(0) } });
      } else {
      map.addLayer({ id: "stubs-casing", type: "line", source: "stubs", layout: { "line-cap": "round" }, paint: { "line-color": "#151a20", "line-width": W(1.5, 80) } });
      map.addLayer({ id: "stubs", type: "line", source: "stubs", layout: { "line-cap": "round" }, paint: { "line-color": "#353f4b", "line-width": W(1, 64) } });
      map.addLayer({ id: "road-casing", type: "line", source: "route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#11161b", "line-width": W(4, 150) } });
      map.addLayer({ id: "road", type: "line", source: "route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#46515f", "line-width": W(3, 128) } });
      map.addLayer({ id: "route", type: "line", source: "route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-width": W(2, 64), "line-gradient": grad(0) } });
      }
      map.addLayer({
        id: "stops", type: "circle", source: "stops",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 4, 16, 11],
          "circle-color": ["get", "c"], "circle-stroke-color": "#0d1117", "circle-stroke-width": 3,
          "circle-pitch-alignment": "map",
        },
      });
      ready = true;
      if (route) applyRoute();
    });
    const el = document.createElement("div"); el.className = "veh-marker";
    markerImg = document.createElement("img"); markerImg.alt = ""; el.appendChild(markerImg);
    marker = new maplibregl.Marker({ element: el, anchor: "center", pitchAlignment: "viewport", rotationAlignment: "viewport" }).setLngLat([-38.5, -3.7]).addTo(map);
    new ResizeObserver(() => { map.resize(); pad(); }).observe(container);
    return true;
  }
  const empty = () => ({ type: "FeatureCollection", features: [] });
  const grad = (f) => ["step", ["line-progress"], "#76808c", Math.max(0.00001, Math.min(0.99999, f)), accent];

  function pad() {
    if (!map) return;
    const c = map.getContainer(), h = c.clientHeight, w = c.clientWidth;
    // veículo no terço de baixo, centralizado na área livre (à esquerda do painel)
    map.setPadding(follow ? { top: h * 0.42, bottom: 0, left: w * 0.3, right: w * 0.26 } : { top: h * 0.08, bottom: h * 0.12, left: w * 0.36, right: w * 0.3 });
  }

  let routeData = null;
  /** Define o dia: rota, cruzamentos (ruas laterais) e paradas. */
  function setRoute(r, stops) {
    route = prep(r); routeData = { stops };
    if (ready) applyRoute();
  }
  function applyRoute() {
    const r = route;
    map.getSource("route").setData({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: r.line } });
    const stubs = [];
    for (const s of (r.stubs || [])) { const p = [s[0], s[1]]; for (let i = 2; i < s.length; i++) stubs.push([p, dest(p, s[i], 170)]); }
    if (map.getSource("stubs")) map.getSource("stubs").setData({ type: "Feature", properties: {}, geometry: { type: "MultiLineString", coordinates: stubs } });
    updateStops(routeData.stops);
  }
  /** Paradas: círculos coloridos no mapa + etiquetas com o nome das próximas. */
  function updateStops(stops) {
    if (routeData) routeData.stops = stops;
    if (!ready) return;
    map.getSource("stops").setData({
      type: "FeatureCollection",
      features: stops.filter((s) => s.pos).map((s) => ({ type: "Feature", properties: { c: s.color }, geometry: { type: "Point", coordinates: [s.pos[1], s.pos[0]] } })),
    });
    labels.forEach((m) => m.remove()); labels = [];
    for (const s of stops) {
      if (!s.pos || s.reached) continue;
      const el = document.createElement("div"); el.className = "stop-label" + (s.current ? " cur" : "");
      el.textContent = s.label;
      labels.push(new maplibregl.Marker({ element: el, anchor: "bottom", offset: [0, -14], pitchAlignment: "viewport", rotationAlignment: "viewport" }).setLngLat([s.pos[1], s.pos[0]]).addTo(map));
    }
  }

  function setAccent(c) { accent = c; if (ready) map.setPaintProperty("route", "line-gradient", grad(lastS / (route?.total || 1))); }
  function setSprites(chase, top) { sprites = { chase, top }; if (markerImg) markerImg.src = follow ? chase : top; }

  /** Atualiza câmera e veículo para a distância s (m) ao longo da rota do dia. */
  function update(s, speedFactor) {
    if (!map || !route) return;
    lastS = s;
    const p = along(route, s), ahead = along(route, s + 70);
    const target = s + 70 >= route.total ? heading : bearing(p, ahead);
    let diff = ((target - heading + 540) % 360) - 180;
    heading = (heading + diff * 0.18 + 360) % 360;
    marker.setLngLat(p);
    if (ready) map.setPaintProperty("route", "line-gradient", grad(s / route.total));
    if (follow) {
      const z = speedFactor >= 100 ? 14.6 : speedFactor >= 20 ? 15.4 : speedFactor >= 5 ? 16.2 : 17;
      camZoom += (z - camZoom) * 0.08;
      map.jumpTo({ center: p, bearing: heading, pitch: tilt ? 62 : 0, zoom: camZoom });
      marker.setRotationAlignment("viewport"); marker.setRotation(0);
    } else {
      marker.setRotationAlignment("map"); marker.setRotation(heading);
    }
  }
  function setFollow(v, s) {
    follow = v; pad();
    if (markerImg) markerImg.src = follow ? sprites.chase : sprites.top;
    if (!map || !route) return;
    if (!follow) {
      const b = new maplibregl.LngLatBounds(); route.line.forEach((c) => b.extend(c));
      map.fitBounds(b, { bearing: 0, pitch: 0, duration: 600 });
      marker.setRotationAlignment("map"); marker.setRotation(heading);
    } else update(s ?? lastS, 1);
  }
  function setTilt(v) { tilt = v; if (follow) update(lastS, 1); }
  function resize() { if (map) { map.resize(); pad(); } }

  /* ---------- manobras ---------- */
  function nextStep(s) {
    if (!route) return null;
    for (let i = 0; i < route.steps.length; i++) {
      const st = route.steps[i];
      if (st.t === "depart") continue;
      if (route.stepAt[i] > s + 4) return { ...st, dist: route.stepAt[i] - s, after: route.steps[i + 1] };
    }
    return null;
  }
  function roadAt(s) {
    if (!route) return "";
    let name = "";
    for (let i = 0; i < route.steps.length; i++) { if (route.stepAt[i] <= s) { if (route.steps[i].n) name = route.steps[i].n; } else break; }
    return name;
  }
  return { get map() { return map; }, init, available, setRoute, updateStops, update, setFollow, setTilt, setAccent, setSprites, resize, nextStep, roadAt, prep, along, get follow() { return follow; }, get tilt() { return tilt; } };
})();
