import L from "leaflet";
import { ChartLayer, deleteChart, importChartFile, listCharts, type ChartMeta } from "../lib/charts";
import { onFix, lastFix, type Fix } from "../lib/gps";
import { angleDiff, bearingDeg, compass, destination, distanceNm, formatLat, formatLon } from "../lib/geo";
import { navCondition, navDay, NAV_LEVELS } from "../lib/navcond";
import { loadTracks, loadWaypoints, newId, saveTracks, saveWaypoints, trackLengthNm, trackToGpx, type Track, type Waypoint } from "../lib/navstore";
import { hourIndex } from "../lib/forecast";
import { DAY, dayStart, esc, fmtDate, fmtTime, fmtWeekday, num, storageGet, storageSet, cap } from "../lib/util";
import { state, onData } from "../state";
import { dayChips, navBadge, navScale, tidePanel } from "../ui/components";

type BoatMode = "lancha" | "veleiro";
type Panel = null | "trilha" | "waypoints" | "mares" | "cartas" | "condicao";

const BTS_CENTER: L.LatLngExpression = [-12.92, -38.62];

export function navView(root: HTMLElement): () => void {
  let mode: BoatMode = storageGet("boatMode", "lancha");
  let panel: Panel = null;
  let follow = true;
  let fix: Fix | null = lastFix();
  let gpsErr = "";
  let waypoints: Waypoint[] = [];
  let tracks: Track[] = [];
  let activeWpt: string | null = storageGet("activeWpt", null);
  let recording: Track | null = null;
  let tideDay = dayStart(Date.now());
  let charts: ChartMeta[] = [];
  let showBase = storageGet("showBase", true);
  let importStatus = "";

  root.innerHTML = `<div class="navwrap">
    <div id="map"></div>
    <div class="topbar" id="top"></div>
    <div class="navcontrols">
      <div class="modesw" id="modesw"></div>
      <button class="navbadge-btn" id="cond"></button>
    </div>
    <div class="fabs">
      <button class="fab" id="wptHere" title="Marcar waypoint aqui">⚑</button>
      <button class="fab" id="center" title="Centralizar no barco">◎</button>
    </div>
    <div class="posline" id="pos"></div>
    <div class="sheet" id="sheet"></div>
    <nav class="bottombar">
      <button data-p="trilha"><i>●</i>Trilha</button>
      <button data-p="waypoints"><i>⚑</i>Waypoints</button>
      <button data-p="mares"><i>≈</i>Marés</button>
      <button data-p="cartas"><i>🗺</i>Cartas</button>
      <a href="#/"><i>⌂</i>Início</a>
    </nav>
  </div>`;

  const $ = <T extends HTMLElement>(s: string) => root.querySelector(s) as T;
  const map = L.map($("#map"), { zoomControl: false, attributionControl: true, center: BTS_CENTER, zoom: 11, maxZoom: 18, minZoom: 8 });
  L.control.zoom({ position: "bottomright" }).addTo(map);
  map.attributionControl.setPrefix("");

  // Fundo: OpenStreetMap + OpenSeaMap (o que for visto online fica guardado pra uso offline).
  const osm = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, opacity: 0.55, attribution: "© OpenStreetMap" });
  const seamark = L.tileLayer("https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "© OpenSeaMap" });
  if (showBase) { osm.addTo(map); seamark.addTo(map); }
  const chartLayer = new ChartLayer({ tileSize: 256, maxZoom: 18, zIndex: 5, attribution: "Cartas raster © DHN/CHM – Marinha do Brasil" });
  chartLayer.addTo(map);

  const trackLine = L.polyline([], { color: "#ff2f7a", weight: 3 }).addTo(map);
  const savedTracksLayer = L.layerGroup().addTo(map);
  const wptLayer = L.layerGroup().addTo(map);
  const goLine = L.polyline([], { color: "#111", weight: 1.5, dashArray: "6 4" }).addTo(map);
  const laylines = L.layerGroup().addTo(map);
  const boatIcon = L.divIcon({ className: "boat", html: `<div class="boat-arrow"></div>`, iconSize: [28, 28], iconAnchor: [14, 14] });
  const boat = L.marker([0, 0], { icon: boatIcon, interactive: false, zIndexOffset: 1000 });
  const accCircle = L.circle([0, 0], { radius: 1, color: "#1f8fff", weight: 1, fillOpacity: 0.08 });

  map.on("dragstart", () => { follow = false; });
  map.on("contextmenu", (e: L.LeafletMouseEvent) => addWaypoint(e.latlng.lat, e.latlng.lng));

  // ----- dados -----
  (async () => {
    [waypoints, tracks, charts] = await Promise.all([loadWaypoints(), loadTracks(), listCharts()]);
    chartLayer.setCharts(charts);
    if (charts.length && !fix) {
      const b = L.latLngBounds(charts.map((c) => c.bounds).flat() as L.LatLngTuple[]);
      map.fitBounds(b);
    }
    drawWaypoints();
    renderAll();
  })();

  const windNow = (): { dir: number; kn: number; src: string } | null => {
    const b = state.bundle;
    if (!b) return null;
    if (b.metar && b.metar.windDir != null && Date.now() - b.metar.time < 2 * 3_600_000)
      return { dir: b.metar.windDir, kn: b.metar.windKn, src: "aeroporto" };
    const i = hourIndex(b.weather.time, Date.now());
    return { dir: b.weather.windDir[i], kn: b.weather.windKn[i], src: "previsão" };
  };

  function target(): Waypoint | undefined {
    return waypoints.find((w) => w.id === activeWpt);
  }

  // ----- render -----
  function renderTop() {
    const t = target();
    const sog = fix ? fix.sog : null;
    const cog = fix?.cog ?? null;
    const dist = fix && t ? distanceNm(fix, t) : null;
    const brg = fix && t ? bearingDeg(fix, t) : null;
    const cell = (k: string, v: string, u = "") => `<div class="m"><span>${k}</span><b>${v}${u ? `<small>${u}</small>` : ""}</b></div>`;
    let html: string;
    if (mode === "lancha") {
      html = cell("SOG", sog != null ? num(sog) : "--", " nós") + cell("COG", cog != null ? `${String(Math.round(cog)).padStart(3, "0")}°` : "---") +
        (t ? cell(esc(t.name).slice(0, 12), dist != null ? num(dist, dist < 10 ? 2 : 1) : "--", " NM") : cell("Waypoint", "—"));
    } else {
      const wind = windNow();
      let vmg = "--", side = "--", sideColor = "";
      if (fix && cog != null && wind) {
        const rel = angleDiff(cog, wind.dir);
        side = rel >= 0 ? "BE" : "BB";
        sideColor = rel >= 0 ? "#21d07a" : "#ff3b5c";
        const ref = brg ?? wind.dir;
        vmg = num(fix.sog * Math.cos((angleDiff(cog, ref) * Math.PI) / 180));
      }
      html = cell("SOG", sog != null ? num(sog) : "--") + cell(t ? "VMG wpt" : "VMG vento", vmg) +
        `<div class="m"><span>Bordo</span><b style="color:${sideColor}">${side}</b></div>`;
    }
    $("#top").innerHTML = html;
    $("#modesw").innerHTML = `<button class="${mode === "lancha" ? "on" : ""}" data-m="lancha">Lancha</button><button class="${mode === "veleiro" ? "on" : ""}" data-m="veleiro">Veleiro</button>`;
    $("#modesw").querySelectorAll<HTMLButtonElement>("button").forEach((b) =>
      b.addEventListener("click", () => { mode = b.dataset.m as BoatMode; storageSet("boatMode", mode); renderAll(); }),
    );

    // linha de posição
    let pos = gpsErr ? `<span class="warn">${gpsErr}</span>` : fix ? `${formatLat(fix.lat)} ${formatLon(fix.lon)} · ±${Math.round(fix.acc)} m` : "Aguardando GPS…";
    if (fix && t && dist != null && brg != null) {
      const eta = fix.sog > 0.5 ? (dist / fix.sog) * 60 : null;
      pos += `<br>${esc(t.name)}: ${String(Math.round(brg)).padStart(3, "0")}° · ${num(dist, 2)} NM${eta != null ? ` · ETA ${eta < 90 ? Math.round(eta) + " min" : num(eta / 60) + " h"}` : ""}`;
    }
    if (mode === "veleiro") {
      const w = windNow();
      if (w) pos += `<br>Vento ${compass(w.dir)} ${Math.round(w.kn)} nós (${w.src})`;
    }
    if (recording) pos += `<br><span class="rec">● gravando ${num(trackLengthNm(recording), 2)} NM</span>`;
    $("#pos").innerHTML = pos;

    // termômetro
    const b = state.bundle;
    if (b) {
      const c = navCondition(b, Date.now());
      $("#cond").innerHTML = navBadge(c.level, `${compass(c.windDir)} ${Math.round(c.windKn)} nós · ondas ${num(c.wave)} m`);
    } else $("#cond").innerHTML = `<div class="navbadge"><div><div class="cap">Condição</div><div class="word" style="color:#8aa0b6">SEM DADOS</div><div class="sub">conecte à internet uma vez</div></div></div>`;
  }

  function renderMapOverlays() {
    const t = target();
    if (fix) {
      boat.setLatLng([fix.lat, fix.lon]).addTo(map);
      accCircle.setLatLng([fix.lat, fix.lon]).setRadius(fix.acc).addTo(map);
      const el = (boat.getElement()?.querySelector(".boat-arrow") as HTMLElement | null);
      if (el) el.style.transform = `rotate(${fix.cog ?? 0}deg)`;
      if (follow) map.setView([fix.lat, fix.lon], Math.max(map.getZoom(), 13), { animate: false });
      goLine.setLatLngs(t ? [[fix.lat, fix.lon], [t.lat, t.lon]] : []);
    } else goLine.setLatLngs([]);
    laylines.clearLayers();
    const wind = windNow();
    if (mode === "veleiro" && t && wind) {
      for (const s of [-45, 45]) {
        const p = destination(t, (wind.dir + 180 + s + 360) % 360, 3);
        L.polyline([[t.lat, t.lon], [p.lat, p.lon]], { color: "#1f8fff", weight: 1.2, dashArray: "2 5" }).addTo(laylines);
      }
    }
    trackLine.setLatLngs(recording ? recording.points.map(([a, o]) => [a, o] as L.LatLngTuple) : []);
  }

  function drawWaypoints() {
    wptLayer.clearLayers();
    for (const w of waypoints) {
      const icon = L.divIcon({ className: "wpt", html: `<div class="pin ${w.id === activeWpt ? "act" : ""}"></div><span>${esc(w.name)}</span>`, iconSize: [16, 16], iconAnchor: [8, 16] });
      L.marker([w.lat, w.lon], { icon }).on("click", () => { panel = "waypoints"; renderSheet(); }).addTo(wptLayer);
    }
  }

  function renderSheet() {
    const sheet = $("#sheet");
    root.querySelectorAll<HTMLButtonElement>(".bottombar button").forEach((b) => b.classList.toggle("act", b.dataset.p === panel));
    if (!panel) { sheet.classList.remove("open"); sheet.innerHTML = ""; return; }
    sheet.classList.add("open");
    let body = "";
    if (panel === "trilha") {
      body = `<h3>Trilha</h3>
        <button class="btn ${recording ? "danger" : "primary"}" id="recBtn">${recording ? "■ Parar e salvar" : "● Começar a gravar"}</button>
        <div class="list">${tracks.slice().reverse().map((t) => `<div class="item"><div><b>${esc(t.name)}</b><br><span class="muted small">${cap(fmtDate(dayStart(t.start)))} · ${num(trackLengthNm(t), 2)} NM</span></div>
          <div class="acts"><button data-show="${t.id}">ver</button><button data-gpx="${t.id}">GPX</button><button data-del="${t.id}">✕</button></div></div>`).join("") || `<p class="muted">Nenhuma trilha salva.</p>`}</div>`;
    } else if (panel === "waypoints") {
      body = `<h3>Waypoints</h3><p class="muted small">Toque em ⚑ pra marcar onde o barco está, ou segure o dedo no mapa pra marcar um ponto.</p>
        <div class="list">${waypoints.map((w) => {
          const d = fix ? distanceNm(fix, w) : null;
          return `<div class="item ${w.id === activeWpt ? "sel" : ""}"><div><b>${esc(w.name)}</b><br><span class="muted small">${formatLat(w.lat)} ${formatLon(w.lon)}${d != null ? ` · ${num(d, 2)} NM ${String(Math.round(bearingDeg(fix!, w))).padStart(3, "0")}°` : ""}</span></div>
          <div class="acts"><button data-go="${w.id}">${w.id === activeWpt ? "parar" : "ir"}</button><button data-ren="${w.id}">✎</button><button data-del="${w.id}">✕</button></div></div>`;
        }).join("") || `<p class="muted">Nenhum waypoint.</p>`}</div>`;
    } else if (panel === "mares") {
      const days = Array.from({ length: 7 }, (_, i) => dayStart(Date.now()) + i * DAY);
      body = `<h3>Marés · Porto de Salvador</h3>${dayChips(days, tideDay)}${tidePanel(tideDay)}`;
    } else if (panel === "condicao") {
      const b = state.bundle;
      if (!b) body = `<h3>Condição de navegação</h3><p class="muted">Sem previsão salva. Conecte à internet uma vez.</p>`;
      else {
        const c = navCondition(b, Date.now());
        const days = Array.from({ length: 7 }, (_, i) => dayStart(Date.now()) + i * DAY);
        body = `<h3>Condição de navegação (BTS)</h3>
          <div class="condnow">${navScale(c.level)}<div><b style="color:${NAV_LEVELS[c.level].color};font-size:22px">${NAV_LEVELS[c.level].word}</b><p>${NAV_LEVELS[c.level].hint}</p>
          <p class="muted small">Vento ${compass(c.windDir)} ${Math.round(c.windKn)} nós (rajadas ${Math.round(c.gustKn)}) · ondas ${num(c.wave)} m na entrada da baía (dentro da BTS o mar costuma ser menor)</p></div></div>
          <div class="list">${days.map((d, i) => { const n = navDay(b, d); return `<div class="item"><div><b>${i === 0 ? "Hoje" : cap(fmtWeekday(d, "long"))}</b><br><span class="muted small">até ${Math.round(n.windKn)} nós ${compass(n.windDir)} · raj ${Math.round(n.gustKn)} · ${num(n.wave)} m (${fmtTime(n.time)})</span></div><span class="tag" style="background:${NAV_LEVELS[n.level].color};color:#06121d">${NAV_LEVELS[n.level].word}</span></div>`; }).join("")}</div>`;
      }
    } else if (panel === "cartas") {
      body = `<h3>Cartas náuticas oficiais</h3>
        <p class="small">As cartas raster da Marinha (CHM) são gratuitas. Baixe a versão <b>BSB (.zip)</b> de cada carta da Baía de Todos os Santos (série 1100) e importe aqui. Ficam salvas no aparelho e funcionam sem internet.</p>
        <a class="btn" href="https://www.marinha.mil.br/chm/dados-do-segnav/cartas-raster" target="_blank" rel="noopener">1. Abrir site de cartas do CHM</a>
        <label class="btn primary">2. Importar arquivos .zip / .kap<input type="file" id="chartFile" accept=".zip,.kap,.KAP,application/zip" multiple hidden></label>
        <div id="importMsg" class="muted small">${importStatus}</div>
        <div class="list">${charts.map((c) => `<div class="item"><div><b>${esc(c.number)} ${esc(c.name)}</b><br><span class="muted small">1:${c.scale.toLocaleString("pt-BR")}${c.edition ? ` · edição ${esc(c.edition)}` : ""} · importada ${new Date(c.importedAt).toLocaleDateString("pt-BR")}</span></div>
          <div class="acts"><button data-zoom="${c.id}">ver</button><button data-delc="${c.id}">✕</button></div></div>`).join("") || `<p class="muted">Nenhuma carta importada ainda.</p>`}</div>
        <label class="toggle"><input type="checkbox" id="baseTgl" ${showBase ? "checked" : ""}> Mostrar mapa OpenStreetMap/OpenSeaMap por baixo (precisa de internet)</label>
        <p class="muted small">Confira periodicamente os Avisos aos Navegantes no site do CHM e reimporte a carta quando sair edição nova.</p>`;
    }
    sheet.innerHTML = `<div class="grab" id="closeSheet"></div>${body}`;
    $("#closeSheet").addEventListener("click", () => { panel = null; renderSheet(); });
    bindSheet(sheet);
  }

  function bindSheet(sheet: HTMLElement) {
    sheet.querySelector("#recBtn")?.addEventListener("click", async () => {
      if (recording) {
        recording.end = Date.now();
        if (recording.points.length > 1) { tracks.push(recording); await saveTracks(tracks); }
        recording = null;
      } else {
        recording = { id: newId(), name: `Trilha ${cap(fmtDate(dayStart(Date.now())))} ${fmtTime(Date.now())}`, start: Date.now(), points: [] };
        if (fix) recording.points.push([fix.lat, fix.lon, fix.time]);
      }
      renderAll();
    });
    sheet.querySelectorAll<HTMLButtonElement>("[data-show]").forEach((b) => b.addEventListener("click", () => {
      const t = tracks.find((x) => x.id === b.dataset.show);
      savedTracksLayer.clearLayers();
      if (t && t.points.length > 1) {
        const line = L.polyline(t.points.map(([a, o]) => [a, o] as L.LatLngTuple), { color: "#c040ff", weight: 3, opacity: 0.8 }).addTo(savedTracksLayer);
        follow = false;
        map.fitBounds(line.getBounds(), { padding: [30, 30] });
        panel = null; renderSheet();
      }
    }));
    sheet.querySelectorAll<HTMLButtonElement>("[data-gpx]").forEach((b) => b.addEventListener("click", () => {
      const t = tracks.find((x) => x.id === b.dataset.gpx);
      if (!t) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([trackToGpx(t)], { type: "application/gpx+xml" }));
      a.download = `${t.name.replace(/[^\w-]+/g, "_")}.gpx`;
      a.click();
    }));
    sheet.querySelectorAll<HTMLButtonElement>("[data-del]").forEach((b) => b.addEventListener("click", async () => {
      const id = b.dataset.del!;
      if (panel === "trilha") { if (!confirm("Apagar trilha?")) return; tracks = tracks.filter((t) => t.id !== id); await saveTracks(tracks); savedTracksLayer.clearLayers(); }
      else { if (!confirm("Apagar waypoint?")) return; waypoints = waypoints.filter((w) => w.id !== id); if (activeWpt === id) setActive(null); await saveWaypoints(waypoints); drawWaypoints(); }
      renderAll();
    }));
    sheet.querySelectorAll<HTMLButtonElement>("[data-go]").forEach((b) => b.addEventListener("click", () => {
      setActive(activeWpt === b.dataset.go ? null : b.dataset.go!);
      drawWaypoints(); renderAll();
    }));
    sheet.querySelectorAll<HTMLButtonElement>("[data-ren]").forEach((b) => b.addEventListener("click", async () => {
      const w = waypoints.find((x) => x.id === b.dataset.ren);
      if (!w) return;
      const n = prompt("Nome do waypoint", w.name);
      if (n) { w.name = n.slice(0, 40); await saveWaypoints(waypoints); drawWaypoints(); renderAll(); }
    }));
    sheet.querySelectorAll<HTMLButtonElement>(".day").forEach((b) => b.addEventListener("click", () => { tideDay = Number(b.dataset.day); renderSheet(); }));
    sheet.querySelector<HTMLInputElement>("#chartFile")?.addEventListener("change", async (e) => {
      const files = Array.from((e.target as HTMLInputElement).files ?? []);
      const msg = sheet.querySelector("#importMsg") as HTMLElement;
      let ok = 0;
      importStatus = "";
      for (const f of files) {
        try {
          await importChartFile(f, (m, p) => { msg.textContent = `${m} ${Math.round(p * 100)}%`; });
          ok++;
        } catch (err) {
          importStatus += `<span class="warn">Erro em ${esc(f.name)}: ${esc(err instanceof Error ? err.message : String(err))}</span><br>`;
        }
      }
      charts = await listCharts();
      chartLayer.setCharts(charts);
      importStatus += ok ? `${ok} arquivo(s) importado(s).` : "";
      renderSheet();
    });
    sheet.querySelectorAll<HTMLButtonElement>("[data-zoom]").forEach((b) => b.addEventListener("click", () => {
      const c = charts.find((x) => x.id === b.dataset.zoom);
      if (c) { follow = false; map.fitBounds(c.bounds as L.LatLngBoundsExpression); panel = null; renderSheet(); }
    }));
    sheet.querySelectorAll<HTMLButtonElement>("[data-delc]").forEach((b) => b.addEventListener("click", async () => {
      if (!confirm("Remover esta carta do aparelho?")) return;
      await deleteChart(b.dataset.delc!);
      charts = await listCharts();
      chartLayer.setCharts(charts);
      renderSheet();
    }));
    sheet.querySelector<HTMLInputElement>("#baseTgl")?.addEventListener("change", (e) => {
      showBase = (e.target as HTMLInputElement).checked;
      storageSet("showBase", showBase);
      if (showBase) { osm.addTo(map); seamark.addTo(map); } else { osm.remove(); seamark.remove(); }
    });
  }

  function setActive(id: string | null) {
    activeWpt = id;
    storageSet("activeWpt", id);
  }

  async function addWaypoint(lat: number, lon: number) {
    const name = prompt("Nome do waypoint", `WPT ${waypoints.length + 1}`);
    if (!name) return;
    waypoints.push({ id: newId(), name: name.slice(0, 40), lat, lon, created: Date.now() });
    await saveWaypoints(waypoints);
    drawWaypoints();
    renderAll();
  }

  function renderAll() {
    renderTop();
    renderMapOverlays();
    if (panel && panel !== "cartas") renderSheet();
  }

  // ----- eventos -----
  root.querySelectorAll<HTMLButtonElement>(".bottombar button").forEach((b) =>
    b.addEventListener("click", () => { panel = panel === b.dataset.p ? null : (b.dataset.p as Panel); renderSheet(); }),
  );
  $("#cond").addEventListener("click", () => { panel = panel === "condicao" ? null : "condicao"; renderSheet(); });
  $("#center").addEventListener("click", () => { follow = true; if (fix) map.setView([fix.lat, fix.lon], Math.max(map.getZoom(), 14)); });
  $("#wptHere").addEventListener("click", () => {
    const p = fix ?? { lat: map.getCenter().lat, lon: map.getCenter().lng };
    addWaypoint(p.lat, p.lon);
  });

  let lastRec = 0;
  const offFix = onFix((f, err) => {
    gpsErr = err ?? "";
    if (f) {
      fix = f;
      if (recording) {
        const lp = recording.points[recording.points.length - 1];
        const moved = !lp || distanceNm({ lat: lp[0], lon: lp[1] }, f) * 1852 > 8;
        if (moved && f.time - lastRec > 3000 && f.acc < 60) {
          recording.points.push([f.lat, f.lon, f.time]);
          lastRec = f.time;
        }
      }
    }
    renderTop();
    renderMapOverlays();
  });
  const offData = onData(() => renderTop());
  renderAll();
  setTimeout(() => map.invalidateSize(), 50);

  return () => {
    offFix();
    offData();
    if (recording && recording.points.length > 1) { recording.end = Date.now(); tracks.push(recording); saveTracks(tracks); }
    map.remove();
  };
}
