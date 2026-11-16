/* ============================================================
 * App: estado compartilhado (celular + Android Auto), telas,
 * tema pela cor da moto e simulação da estrada.
 * ============================================================ */
// Viagens no aparelho (a primeira é a de teste em Stella Maris) e rotas reais por viagem/dia.
const TRIPS = JSON.parse(document.getElementById("trips").textContent);
const ROUTES = JSON.parse(document.getElementById("routes").textContent);
const TRIP = TRIPS[0];

/* ---------------- textos (PT / EN / ES) ---------------- */
const STR = {
 pt:{tripsAvail:"Viagens no aparelho",inUse:"Em uso",useTrip:"Usar esta viagem",day1:"dia",trips:"Viagens",route:"Roteiro",garage:"Garagem",settings:"Ajustes",days:"dias",cont:"Continuar viagem · Dia {0} de {1}",next:"{0} · próxima parada: {1} ({2})",openRoute:"Abrir roteiro",restart:"Recomeçar viagem",restartQ:"Voltar a viagem para o dia 1?",cancel:"Cancelar",done:"Viagem concluída",aaTitle:"Android Auto",aaHint:"Conecte o celular na multimídia e abra o app: ele mostra a sua moto e o botão Seguir viagem, continuando da etapa salva aqui.",day:"DIA",times:"Saída {0} · chegada {1} · {2}",gap:"Trecho {0} → {1} ({2}) passa da autonomia útil de {3}. Adicione um posto.",dep:"Saída {0}",fuel:"posto",yours:"sua parada",night:"pernoite",arrival:"chegada",current:"atual",back:"◀ Voltar",edit:"✎ Editar",adv:"Avançar ▶",add:"+ Adicionar parada",offMaps:"Rota da viagem (OpenStreetMap)",offReady:"baixada",offOk:"✓ Roteiro, rota, postos e progresso salvos no aparelho",setCur:"Definir como etapa atual",newStop:"Nova parada",editStop:"Editar parada",name:"Nome",time:"Horário (HH:MM)",km:"Km no dia",type:"Tipo",invalid:"Confira o nome, o horário (HH:MM) e o km.",save:"Salvar",del:"Excluir",tFuel:"Posto",tMeal:"Almoço + posto",tOpt:"Posto opcional",tNight:"Pernoite",tArr:"Chegada",tUser:"Parada",gSub:"Escolha o veículo da viagem",drag:"⟲ arraste para girar 360°",v3d:"3D",vPhoto:"Foto",range:"Autonomia",margin:"Margem de segurança",cons:"Consumo médio",usable:"Autonomia útil para sugerir postos: {0}",sSub:"Valem também para a multimídia",lang:"Idioma",theme:"Fundo",dark:"Escuro",light:"Claro",desert:"Deserto",coast:"Litoral",vt:"Cores da moto no app",vtSub:"Botões, rota e destaques usam a cor escolhida na Garagem",nav:"Navegação",voice:"Avisos por voz",sunsetW:"Avisar antes do pôr do sol",dirt:"Evitar estradas de terra",auto:"Fundo automático (dia/noite)",units:"Unidades",yourName:"Seu nome",gm:"Bom dia, {0}",ga:"Boa tarde, {0}",ge:"Boa noite, {0}",follow:"▶ Seguir viagem",stages:"Etapas",skip:"Pular etapa",autonomy:"Autonomia",left:"{0} restantes",nextFuel:"Próximo posto em {0} · {1}",ok:"margem ok",low:"autonomia baixa",noFuel:"Nenhum posto à frente hoje",nextStage:"Próxima etapa · {0}/{1}",arr:"Chegada {0}",dest:"Destino do dia",sunset:"pôr do sol {0}",eta:"{0} · {1} até {2}",arrived:"Chegamos em {0}",dayDone:"Dia concluído: chegamos em {0}",offline:"Offline",ready:"offline pronto ✓",sunWarn:"Pôr do sol às {0}. Faltam {1} até {2}.",then:"Depois: {0}",overview:"Visão geral",followBtn:"Seguir",mapNo:"Este navegador não conseguiu abrir o mapa 3D (WebGL indisponível).",
   m:"Meteor 650",c:"Moto custom",tr:"Moto trail",h:"Hatch",se:"Sedã",su:"SUV",mSub:"Royal Enfield · 648 cc bicilíndrica · cruiser",cSub:"Modelo genérico de cruiser",trSub:"Modelo genérico de trail",carSub:"Modelo genérico de carro",
   i_dep:"Siga",i_turn:"Vire {0}",i_cont:"Continue {0}",i_merge:"Entre {0}",i_onramp:"Pegue o acesso {0}",i_offramp:"Pegue a saída {0}",i_fork:"Na bifurcação, mantenha-se {0}",i_end:"No fim da via, vire {0}",i_round:"Na rotatória, pegue a {0}ª saída",i_arrive:"Chegada ao destino",i_uturn:"Faça o retorno",d_right:"à direita",d_left:"à esquerda",d_sright:"levemente à direita",d_sleft:"levemente à esquerda",d_shright:"acentuadamente à direita",d_shleft:"acentuadamente à esquerda",d_straight:"em frente",on:"{0} · {1}",to:"{0} · {1}"},
 en:{tripsAvail:"Trips on this device",inUse:"Active",useTrip:"Use this trip",day1:"day",trips:"Trips",route:"Itinerary",garage:"Garage",settings:"Settings",days:"days",cont:"Continue trip · Day {0} of {1}",next:"{0} · next stop: {1} ({2})",openRoute:"Open itinerary",restart:"Restart trip",restartQ:"Reset the trip to day 1?",cancel:"Cancel",done:"Trip completed",aaTitle:"Android Auto",aaHint:"Connect your phone to the car display and open the app: it shows your bike and the Continue trip button, resuming from the stage saved here.",day:"DAY",times:"Departure {0} · arrival {1} · {2}",gap:"Leg {0} → {1} ({2}) exceeds the usable range of {3}. Add a fuel stop.",dep:"Depart {0}",fuel:"fuel",yours:"your stop",night:"overnight",arrival:"arrival",current:"current",back:"◀ Back",edit:"✎ Edit",adv:"Next ▶",add:"+ Add stop",offMaps:"Trip route (OpenStreetMap)",offReady:"downloaded",offOk:"✓ Itinerary, route, fuel stops and progress stored on the device",setCur:"Set as current stage",newStop:"New stop",editStop:"Edit stop",name:"Name",time:"Time (HH:MM)",km:"Km into the day",type:"Type",invalid:"Check the name, time (HH:MM) and km.",save:"Save",del:"Delete",tFuel:"Fuel",tMeal:"Lunch + fuel",tOpt:"Optional fuel",tNight:"Overnight",tArr:"Arrival",tUser:"Stop",gSub:"Choose the vehicle for this trip",drag:"⟲ drag to rotate 360°",v3d:"3D",vPhoto:"Photo",range:"Range",margin:"Safety margin",cons:"Average consumption",usable:"Usable range for fuel suggestions: {0}",sSub:"Also applied on the car display",lang:"Language",theme:"Background",dark:"Dark",light:"Light",desert:"Desert",coast:"Coast",vt:"Bike colors in the app",vtSub:"Buttons, route and highlights use the color chosen in the Garage",nav:"Navigation",voice:"Voice announcements",sunsetW:"Warn before sunset",dirt:"Avoid dirt roads",auto:"Automatic background (day/night)",units:"Units",yourName:"Your name",gm:"Good morning, {0}",ga:"Good afternoon, {0}",ge:"Good evening, {0}",follow:"▶ Continue trip",stages:"Stages",skip:"Skip stage",autonomy:"Range",left:"{0} left",nextFuel:"Next fuel in {0} · {1}",ok:"margin ok",low:"low range",noFuel:"No fuel stops ahead today",nextStage:"Next stage · {0}/{1}",arr:"Arrive {0}",dest:"Destination today",sunset:"sunset {0}",eta:"{0} · {1} to {2}",arrived:"Arrived at {0}",dayDone:"Day complete: arrived at {0}",offline:"Offline",ready:"offline ready ✓",sunWarn:"Sunset at {0}. {1} to go to {2}.",then:"Then: {0}",overview:"Overview",followBtn:"Follow",mapNo:"This browser could not open the 3D map (WebGL unavailable).",
   m:"Meteor 650",c:"Cruiser",tr:"Adventure bike",h:"Hatchback",se:"Sedan",su:"SUV",mSub:"Royal Enfield · 648 cc parallel twin · cruiser",cSub:"Generic cruiser model",trSub:"Generic adventure model",carSub:"Generic car model",
   i_dep:"Head",i_turn:"Turn {0}",i_cont:"Continue {0}",i_merge:"Merge {0}",i_onramp:"Take the ramp {0}",i_offramp:"Take the exit {0}",i_fork:"At the fork, keep {0}",i_end:"At the end of the road, turn {0}",i_round:"At the roundabout, take exit {0}",i_arrive:"You have arrived",i_uturn:"Make a U-turn",d_right:"right",d_left:"left",d_sright:"slightly right",d_sleft:"slightly left",d_shright:"sharp right",d_shleft:"sharp left",d_straight:"straight",on:"{0} onto {1}",to:"{0} toward {1}"},
 es:{tripsAvail:"Viajes en el dispositivo",inUse:"En uso",useTrip:"Usar este viaje",day1:"día",trips:"Viajes",route:"Itinerario",garage:"Garaje",settings:"Ajustes",days:"días",cont:"Continuar viaje · Día {0} de {1}",next:"{0} · próxima parada: {1} ({2})",openRoute:"Abrir itinerario",restart:"Reiniciar viaje",restartQ:"¿Volver el viaje al día 1?",cancel:"Cancelar",done:"Viaje terminado",aaTitle:"Android Auto",aaHint:"Conecta el móvil a la pantalla del coche y abre la app: muestra tu moto y el botón Seguir viaje, continuando desde la etapa guardada aquí.",day:"DÍA",times:"Salida {0} · llegada {1} · {2}",gap:"El tramo {0} → {1} ({2}) supera la autonomía útil de {3}. Agrega una gasolinera.",dep:"Salida {0}",fuel:"gasolinera",yours:"tu parada",night:"pernocta",arrival:"llegada",current:"actual",back:"◀ Volver",edit:"✎ Editar",adv:"Avanzar ▶",add:"+ Agregar parada",offMaps:"Ruta del viaje (OpenStreetMap)",offReady:"descargada",offOk:"✓ Itinerario, ruta, gasolineras y progreso guardados en el dispositivo",setCur:"Marcar como etapa actual",newStop:"Nueva parada",editStop:"Editar parada",name:"Nombre",time:"Hora (HH:MM)",km:"Km en el día",type:"Tipo",invalid:"Revisa el nombre, la hora (HH:MM) y el km.",save:"Guardar",del:"Eliminar",tFuel:"Gasolinera",tMeal:"Almuerzo + gasolinera",tOpt:"Gasolinera opcional",tNight:"Pernocta",tArr:"Llegada",tUser:"Parada",gSub:"Elige el vehículo del viaje",drag:"⟲ arrastra para girar 360°",v3d:"3D",vPhoto:"Foto",range:"Autonomía",margin:"Margen de seguridad",cons:"Consumo medio",usable:"Autonomía útil para sugerir gasolineras: {0}",sSub:"También se aplican en la pantalla del coche",lang:"Idioma",theme:"Fondo",dark:"Oscuro",light:"Claro",desert:"Desierto",coast:"Litoral",vt:"Colores de la moto en la app",vtSub:"Botones, ruta y destacados usan el color elegido en el Garaje",nav:"Navegación",voice:"Avisos por voz",sunsetW:"Avisar antes del atardecer",dirt:"Evitar caminos de tierra",auto:"Fondo automático (día/noche)",units:"Unidades",yourName:"Tu nombre",gm:"Buenos días, {0}",ga:"Buenas tardes, {0}",ge:"Buenas noches, {0}",follow:"▶ Seguir viaje",stages:"Etapas",skip:"Saltar etapa",autonomy:"Autonomía",left:"{0} restantes",nextFuel:"Próxima gasolinera en {0} · {1}",ok:"margen ok",low:"autonomía baja",noFuel:"No hay gasolineras adelante hoy",nextStage:"Próxima etapa · {0}/{1}",arr:"Llegada {0}",dest:"Destino del día",sunset:"atardecer {0}",eta:"{0} · {1} hasta {2}",arrived:"Llegamos a {0}",dayDone:"Día terminado: llegamos a {0}",offline:"Offline",ready:"offline listo ✓",sunWarn:"Atardecer a las {0}. Faltan {1} hasta {2}.",then:"Después: {0}",overview:"Vista general",followBtn:"Seguir",mapNo:"Este navegador no pudo abrir el mapa 3D (WebGL no disponible).",
   m:"Meteor 650",c:"Moto custom",tr:"Moto trail",h:"Hatchback",se:"Sedán",su:"SUV",mSub:"Royal Enfield · 648 cc bicilíndrica · cruiser",cSub:"Modelo genérico de custom",trSub:"Modelo genérico de trail",carSub:"Modelo genérico de coche",
   i_dep:"Sigue",i_turn:"Gira {0}",i_cont:"Continúa {0}",i_merge:"Incorpórate {0}",i_onramp:"Toma el acceso {0}",i_offramp:"Toma la salida {0}",i_fork:"En la bifurcación, mantente {0}",i_end:"Al final de la vía, gira {0}",i_round:"En la rotonda, toma la {0}ª salida",i_arrive:"Has llegado",i_uturn:"Haz un cambio de sentido",d_right:"a la derecha",d_left:"a la izquierda",d_sright:"ligeramente a la derecha",d_sleft:"ligeramente a la izquierda",d_shright:"bruscamente a la derecha",d_shleft:"bruscamente a la izquierda",d_straight:"recto",on:"{0} · {1}",to:"{0} · {1}"}
};
const t = (k, ...a) => (STR[S.set.lang][k] ?? STR.pt[k] ?? k).replace(/\{(\d)\}/g, (_, i) => a[i]);
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

/* ---------------- estado ---------------- */
const MODELS = [["METEOR","m",1,"mSub"],["CUSTOM","c",1,"cSub"],["TRAIL","tr",1,"trSub"],["HATCH","h",0,"carSub"],["SEDAN","se",0,"carSub"],["SUV","su",0,"carSub"]];
// Cores inspiradas nas pinturas da linha Meteor 650.
const COLORS = [["#A3211F","Stellar Red"],["#E2611B","Fireball Orange"],["#E3A81A","Fireball Yellow"],["#1F3F8F","Stellar Blue"],["#3E5B41","Astral Green"],["#5B3A29","Supernova Brown"],["#16181C","Astral Black"],["#E6E8EB","Branco"]];
const CITY = {"Stella Maris":[-12.9406,-38.3364],"Maceió":[-9.6658,-35.7353],"Natal":[-5.7945,-35.211],"Fortaleza":[-3.7319,-38.5267],"Pipa":[-6.229,-35.047],"Porto de Galinhas":[-8.503,-35.005],"Aracaju":[-10.9472,-37.0731]};
const S = {
  trip: JSON.parse(JSON.stringify(TRIP)),
  p: {d: 0, s: 0, done: false}, km: 0, rm: 0,
  g: {model: "METEOR", color: "#A3211F", range: TRIP.veiculo.autonomia_km, margin: TRIP.veiculo.margem_seguranca_pct, kmpl: TRIP.veiculo.consumo_km_l || 21.5},
  set: {lang: "pt", theme: "dark", vt: true, voice: true, sunset: true, dirt: true, auto: false, units: "km", name: "Gabriel"},
  tab: "trips", shownDay: 0, carScreen: "welcome", driving: false, speed: 1, gview: "3d", modal: null, toast: null, prevNav: false
};

/* ---------------- cor da moto → tema ---------------- */
function hexToHsl(hex){ const n = parseInt(hex.slice(1), 16); let r = (n>>16&255)/255, g = (n>>8&255)/255, b = (n&255)/255; const mx = Math.max(r,g,b), mn = Math.min(r,g,b); let h = 0, s = 0, l = (mx+mn)/2; if (mx !== mn){ const d = mx-mn; s = l > .5 ? d/(2-mx-mn) : d/(mx+mn); h = mx===r ? (g-b)/d + (g<b?6:0) : mx===g ? (b-r)/d+2 : (r-g)/d+4; h /= 6; } return [h,s,l]; }
function hslToHex(h,s,l){ const f = n => { const k = (n + h*12) % 12, a = s*Math.min(l,1-l); const c = l - a*Math.max(-1, Math.min(k-3, 9-k, 1)); return Math.round(c*255).toString(16).padStart(2,"0"); }; return "#" + f(0) + f(8) + f(4); }
const lum = hex => { const n = parseInt(hex.slice(1),16); const c = [n>>16&255, n>>8&255, n&255].map(v => { v/=255; return v <= .03928 ? v/12.92 : ((v+.055)/1.055)**2.4; }); return .2126*c[0]+.7152*c[1]+.0722*c[2]; };
/** Destaque legível a partir da cor da moto: mantém o tom e ajusta a luminosidade ao fundo. */
function accentFrom(hex, lightBg){
  const [h,s,l] = hexToHsl(hex);
  let out;
  if (s < .14) out = lightBg ? "#4B5563" : (l < .5 ? "#C9CFD8" : "#EEF0F3");
  else out = hslToHex(h, Math.max(s, .62), lightBg ? .42 : Math.min(.62, Math.max(.52, l + .14)));
  return { acc: out, on: lum(out) > .4 ? "#14171C" : "#FFFFFF" };
}
function applyAccent(){
  const theme = appTheme();
  const phone = accentFrom(S.g.color, theme === "light");
  const car = accentFrom(S.g.color, false);
  const root = document.documentElement.style;
  const useCar = S.set.vt ? car : { acc: "#F5A524", on: "#1A1300" };
  root.setProperty("--acc", useCar.acc); root.setProperty("--on-acc", useCar.on);
  app.style.setProperty("--acc-app", phone.acc); app.style.setProperty("--on-acc-app", phone.on);
  app.dataset.vt = S.set.vt ? "1" : "0";
  Nav.setAccent(useCar.acc);
  return useCar.acc;
}

/* ---------------- lógica (porta do módulo core) ---------------- */
const kindOf = tp => ({abastecer:"FUEL",almoco_abastecer:"MEAL",abastecer_opcional:"OPT",pernoite:"NIGHT",chegada:"ARR",chegada_casa:"ARR"}[tp] || "USER");
const isFuel = st => ["FUEL","MEAL","OPT"].includes(kindOf(st.tipo));
const day = () => S.trip.dias[S.p.d];
const target = () => S.p.done ? null : day()?.paradas[S.p.s] ?? null;
const usable = () => S.g.range * (1 - S.g.margin / 100);
function reachedKm(){ const d = day(); if (!d) return 0; if (S.p.done) return d.km; return S.p.s > 0 ? d.paradas[S.p.s-1].km : 0; }
function lastFuelKm(){ const d = day(); if (!d) return 0; const r = S.p.done ? d.paradas : d.paradas.slice(0, S.p.s); const f = [...r].reverse().find(isFuel); return f ? f.km : 0; }
const curKm = () => Math.max(S.km, reachedKm());
const rangeLeft = () => Math.max(0, usable() - (curKm() - lastFuelKm()));
const nextFuel = () => (!day() || S.p.done) ? null : day().paradas.slice(S.p.s).find(isFuel) ?? null;
function gaps(d){ const m=[0,...d.paradas.filter(isFuel).map(x=>x.km),d.km]; const u=[...new Set(m)].sort((a,b)=>a-b); const g=[]; for(let i=1;i<u.length;i++) if(u[i]-u[i-1]>usable()) g.push([u[i-1],u[i]]); return g; }

/* km do roteiro ⇄ metros na rota real (por perna, entre paradas) */
function routeOf(i){ return Nav.prep(ROUTES[S.trip.id][i]); }
function kmMap(i){
  const d = S.trip.dias[i], r = routeOf(i);
  if (r.legEnds.length === d.paradas.length) return [[0,0], ...d.paradas.map((p,j) => [p.km, r.legEnds[j]])];
  return [[0,0],[d.km, r.total]];
}
function interp(pairs, x, a, b){ for (let i=1;i<pairs.length;i++){ if (x <= pairs[i][a] || i === pairs.length-1){ const p0 = pairs[i-1], p1 = pairs[i]; const f = (x - p0[a]) / Math.max(1e-6, p1[a]-p0[a]); return p0[b] + (p1[b]-p0[b]) * Math.max(0, Math.min(1, f)); } } return x; }
const kmToRm = km => interp(kmMap(S.p.d), km, 0, 1);
const rmToKm = rm => interp(kmMap(S.p.d), rm, 1, 0);
function syncRm(){ S.km = reachedKm(); S.rm = kmToRm(S.km); }

function advance(){
  if (S.p.done) return;
  const d = day(), prevDay = S.p.d;
  if (S.p.s + 1 < d.paradas.length) S.p.s++;
  else if (S.p.d + 1 < S.trip.dias.length) S.p = {d: S.p.d + 1, s: 0, done: false};
  else S.p.done = true;
  syncRm(); if (S.p.d !== prevDay) dayChanged();
}
function back(){
  const prevDay = S.p.d;
  if (S.p.done) S.p.done = false;
  else if (S.p.s > 0) S.p.s--;
  else if (S.p.d > 0){ S.p.d--; S.p.s = day().paradas.length - 1; }
  syncRm(); if (S.p.d !== prevDay) dayChanged();
}
function jump(d, s){ const prevDay = S.p.d; S.p = {d, s, done: false}; syncRm(); if (d !== prevDay) dayChanged(); }

const toMin = h => { const [a,b] = h.split(":").map(Number); return a*60+b; };
const toHM = m => { m = ((Math.round(m) % 1440) + 1440) % 1440; return String(Math.floor(m/60)).padStart(2,"0") + ":" + String(m%60).padStart(2,"0"); };
function sunsetMin(dateStr, lat, lng){
  const dt = new Date(dateStr + "T12:00:00Z"); const start = Date.UTC(dt.getUTCFullYear(),0,1);
  const n = Math.floor((dt - start) / 864e5) + 1; const g = 2*Math.PI/365*(n-1);
  const eq = 229.18*(0.000075+0.001868*Math.cos(g)-0.032077*Math.sin(g)-0.014615*Math.cos(2*g)-0.040849*Math.sin(2*g));
  const de = 0.006918-0.399912*Math.cos(g)+0.070257*Math.sin(g)-0.006758*Math.cos(2*g)+0.000907*Math.sin(2*g)-0.002697*Math.cos(3*g)+0.00148*Math.sin(3*g);
  const la = lat*Math.PI/180; const c = Math.cos(90.833*Math.PI/180)/(Math.cos(la)*Math.cos(de)) - Math.tan(la)*Math.tan(de);
  if (c < -1 || c > 1) return null;
  const ha = Math.acos(c)*180/Math.PI; return 720 - 4*(lng - ha) - eq - 180;
}
const city = s => s.split(",")[0].trim();
function posOf(st, d){ if (st.lat != null) return [st.lat, st.lng]; return CITY[city(st.nome)] || CITY[city(d.para)] || null; }
function sunsetOf(d){ const l = [...d.paradas].reverse().map(x=>posOf(x,d)).find(Boolean); if (!l) return null; return toHM(sunsetMin(d.data, l[0], l[1])); }
function clockAt(d, km){ const pts = [[0,toMin(d.saida)], ...d.paradas.map(x=>[x.km,toMin(x.hora)])]; for (let i=1;i<pts.length;i++){ if (km <= pts[i][0]) { const [k0,t0]=pts[i-1],[k1,t1]=pts[i]; return t0 + (t1-t0)*((km-k0)/Math.max(1,k1-k0)); } } return pts[pts.length-1][1]; }
function dist(km){ const mi = S.set.units === "mi", v = mi ? km/1.609344 : km, u = mi ? " mi" : " km"; if (!mi && v < 1) return Math.round(km*100)*10 + " m"; return (v < 10 ? v.toFixed(1).replace(".", ",") : Math.round(v).toLocaleString("pt-BR")) + u; }
function distShort(m){ if (S.set.units === "mi"){ const mi = m/1609.344; return mi < 0.2 ? Math.round(m*3.28084/50)*50 + " ft" : mi.toFixed(mi < 10 ? 1 : 0) + " mi"; } if (m < 1000) return (m < 100 ? Math.max(10, Math.round(m/10)*10) : Math.round(m/50)*50) + " m"; const k = m/1000; return (k < 10 ? k.toFixed(1).replace(".", ",") : Math.round(k)) + " km"; }
const cons = v => S.set.units === "km" ? v.toFixed(1).replace(".", ",") + " km/l" : (v*2.352).toFixed(1).replace(".", ",") + " mpg";
const emoji = st => ({FUEL:"⛽",OPT:"⛽",MEAL:"🍽",NIGHT:"🛏",ARR:"🏁",USER:"📍"}[kindOf(st.tipo)]);
const kindColor = k => ({FUEL:"var(--fuel)",OPT:"var(--fuel)",MEAL:"var(--user)",USER:"var(--user)",NIGHT:"var(--night)",ARR:"var(--night)"}[k]);
const kindHex = k => ({FUEL:"#F5A524",OPT:"#F5A524",MEAL:"#3B8BEB",USER:"#3B8BEB",NIGHT:"#A371F7",ARR:"#A371F7"}[k]);
const dayLabel = d => new Date(d.data+"T12:00:00").toLocaleDateString({pt:"pt-BR",en:"en-US",es:"es-ES"}[S.set.lang], {weekday:"short", day:"2-digit", month:"2-digit"}).replace(/\./g,"").replace(",","").toUpperCase();
function appTheme(){ if (!S.set.auto) return S.set.theme; const h = Math.floor(clockAt(day() || S.trip.dias[0], curKm())/60); return h>=6 && h<18 ? "light" : "dark"; }
const modelInfo = () => MODELS.find(m => m[0] === S.g.model);
const colorName = () => (COLORS.find(c => c[0] === S.g.color) || ["", ""])[1];

/* ---------------- imagens do veículo (3D, com reserva 2D) ---------------- */
function vehImg(view, w, h){
  if (Moto3D) return Moto3D.still(S.g.model, S.g.color, view, w, h);
  const cv = document.createElement("canvas"); cv.width = w; cv.height = h; const c = cv.getContext("2d");
  c.fillStyle = S.g.color; c.beginPath(); c.ellipse(w/2, h/2, w*.3, h*.18, 0, 0, 7); c.fill(); return cv.toDataURL();
}

/* ---------------- manobras: texto e seta ---------------- */
function dirWord(m){ return t({"right":"d_right","left":"d_left","slight right":"d_sright","slight left":"d_sleft","sharp right":"d_shright","sharp left":"d_shleft","straight":"d_straight"}[m] || "d_straight"); }
function instruction(st){
  if (!st) return "";
  const m = st.m || "straight", ty = st.t;
  let base;
  if (m === "uturn") base = t("i_uturn");
  else if (ty === "turn" && m !== "straight") base = t("i_turn", dirWord(m));
  else if (ty === "new name" || ty === "continue") base = t("i_cont", dirWord(m));
  else if (ty === "merge") base = t("i_merge", dirWord(m));
  else if (ty === "on ramp") base = t("i_onramp", dirWord(m));
  else if (ty === "off ramp") base = t("i_offramp", dirWord(m));
  else if (ty === "fork") base = t("i_fork", dirWord(m));
  else if (ty === "end of road") base = t("i_end", dirWord(m));
  else if (ty.includes("roundabout") || ty.includes("rotary")) base = t("i_round", st.x || 1);
  else if (ty === "arrive") return t("i_arrive");
  else base = t("i_cont", dirWord(m));
  return st.n ? t(ty === "off ramp" || ty === "fork" ? "to" : "on", base, st.n) : base;
}
function arrowSVG(st){
  const m = st?.m || "straight", ty = st?.t || "continue";
  let d;
  if (ty && (ty.includes("roundabout") || ty.includes("rotary"))) d = '<circle cx="24" cy="20" r="8" fill="none" stroke="#fff" stroke-width="4"/><path d="M24 44V28M31 14l7-6M38 8v8h-8" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>';
  else if (m === "uturn") d = '<path d="M30 44V20a8 8 0 0 0-16 0v10" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/><path d="M7 26l7 8 7-8" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>';
  else if (m === "straight" || ty === "arrive") d = '<path d="M24 44V8M12 20L24 8l12 12" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>';
  else {
    const left = m.includes("left");
    const sharp = m.includes("sharp"), slight = m.includes("slight");
    const end = slight ? "M18 44V26l14-16M24 9h9v9" : sharp ? "M16 44V14l18 22M36 26v11H25" : "M16 44V22a6 6 0 0 1 6-6h18M32 8l8 8-8 8";
    d = `<g${left ? ' transform="translate(48 0) scale(-1 1)"' : ""}><path d="${end}" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></g>`;
  }
  return `<svg viewBox="0 0 48 48" aria-hidden="true">${d}</svg>`;
}

/* ---------------- celular ---------------- */
const app = document.getElementById("app");
let disposeViewer = null;
function phoneHTML(){
  const d = day(), tr = S.trip, sb = toHM(clockAt(d || tr.dias[0], curKm()));
  const totalKm = tr.dias.reduce((a,x)=>a+x.km,0);
  let body = "";
  if (S.tab === "trips"){
    const tg = target();
    body = `<p class="h1">${t("trips")}</p><img class="veh" src="${vehImg("hero", 760, 475)}" alt="${esc(t(modelInfo()[1]))}">
    <div class="card"><div class="trip-name">${esc(tr.nome)}</div><div class="muted" style="font-size:14px">${tr.dias.length} ${t(tr.dias.length===1?"day1":"days")} · ${dist(totalKm)} · ${esc(t(modelInfo()[1]))}</div>
    <div style="height:12px"></div>
    ${S.p.done ? `<b style="color:var(--done)">${t("done")}</b>` : `<div class="eyebrow">${t("cont", S.p.d+1, tr.dias.length)}</div><div class="big">${esc(city(d.de))} → ${esc(city(d.para))}</div>
      ${tg ? `<div class="muted" style="font-size:14px">${esc(t("next", dist(d.km), tg.nome, dist(Math.max(0, tg.km - curKm()))))}</div>` : ""}`}
    <div class="row-btns"><button class="btn pri" data-act="tab" data-v="route">${t("openRoute")}</button><button class="btn ghost" data-act="askRestart">${t("restart")}</button></div></div>
    <p class="sec">${t("tripsAvail")}</p>${TRIPS.map(x => { const act = x.id === tr.id; const km = x.dias.reduce((a,d)=>a+d.km,0); return `<div class="card" style="margin-bottom:8px;display:flex;align-items:center;gap:10px"><div style="flex:1;min-width:0"><b>${esc(x.nome)}</b><div class="muted" style="font-size:13px">${x.dias.length} ${t(x.dias.length===1?"day1":"days")} · ${dist(km)}</div></div>${act ? `<b style="color:var(--accent)">${t("inUse")}</b>` : `<button class="btn ghost" style="flex:none;padding:9px 12px" data-act="trip" data-v="${x.id}">${t("useTrip")}</button>`}</div>`; }).join("")}
    <p class="sec">${t("aaTitle")}</p><div class="card muted" style="font-size:13.5px;line-height:1.5">${t("aaHint")}</div>`;
  }
  if (S.tab === "route"){
    const i = S.shownDay, sd = tr.dias[i];
    body = `<p class="h1">${t("route")}</p><p class="sub">${esc(tr.nome)} · ${tr.dias.length} ${t(tr.dias.length===1?"day1":"days")} · ${dist(totalKm)}</p>
    <div class="dayhdr"><button data-act="day" data-v="-1" ${i===0?"disabled":""} aria-label="Dia anterior">◀</button><b>${t("day")} ${i+1} · ${dayLabel(sd)} · ${esc(city(sd.de))} → ${esc(city(sd.para))}</b><button data-act="day" data-v="1" ${i===tr.dias.length-1?"disabled":""} aria-label="Próximo dia">▶</button></div>
    <p class="times">${t("times", sd.saida, sd.chegada, dist(sd.km))}</p>
    ${gaps(sd).map(([a,b])=>`<div class="warn">⚠ ${t("gap", dist(a), dist(b), dist(b-a), dist(usable()))}</div>`).join("")}
    <div class="tl"><div class="stop"><span class="dot" style="background:var(--done)"></span><span class="grow"><span class="nm">${t("dep", esc(city(sd.de)))}</span><br><span class="meta">${sd.saida}</span></span></div>
    ${sd.paradas.map((st, j)=>{ const k = kindOf(st.tipo), cur = !S.p.done && S.p.d===i && S.p.s===j, reached = S.p.done || i<S.p.d || (i===S.p.d && j<S.p.s);
      const lab = ["FUEL","OPT"].includes(k) ? t("fuel") : ["MEAL","USER"].includes(k) ? t("yours") : k==="NIGHT" ? t("night") : t("arrival");
      return `<button class="stop" data-act="stopMenu" data-v="${j}"><span class="dot" style="background:${reached?"var(--done)":kindColor(k)}"></span><span class="grow"><span class="nm" style="${cur?"font-weight:700":""}">${emoji(st)} ${esc(st.nome)}</span><br><span class="meta">${lab} · ${dist(st.km)} · ${st.hora}</span></span>${cur?`<span class="tag">${t("current")}</span>`:reached?`<span class="tag ok">✓</span>`:`<span class="tag muted">⋮</span>`}</button>`; }).join("")}</div>
    <div class="row-btns"><button class="btn" data-act="back">${t("back")}</button><button class="btn" data-act="editCur">${t("edit")}</button><button class="btn pri" data-act="adv">${t("adv")}</button></div>
    <div class="row-btns" style="margin-top:8px"><button class="btn" data-act="addStop">${t("add")}</button></div>
    <div class="card" style="margin-top:12px"><div class="offline"><span>${t("offMaps")}</span><span style="font-size:13px;color:var(--done)">✓ ${t("offReady")}</span></div><div class="okline">${t("offOk")}</div></div>`;
  }
  if (S.tab === "garage"){
    const mi = modelInfo();
    body = `<p class="h1">${t("garage")}</p><p class="sub">${t("gSub")}</p>
    <div class="viewer" id="viewer"><div class="vtoggle" role="group"><button data-act="gview" data-v="3d" aria-pressed="${S.gview==="3d"}">${t("v3d")}</button><button data-act="gview" data-v="photo" aria-pressed="${S.gview==="photo"}">${t("vPhoto")}</button></div>
      ${S.gview === "photo" || !Moto3D ? `<img src="${vehImg("side", 760, 475)}" alt="${esc(t(mi[1]))}">` : `<small>${t("drag")}</small>`}</div>
    <p class="model-name">${esc(t(mi[1]))} · ${esc(colorName())}</p><p class="model-sub">${t(mi[3])}</p>
    <div class="chips">${MODELS.map(([id,k])=>`<button class="chip" data-act="model" data-v="${id}" aria-pressed="${S.g.model===id}">${t(k)}</button>`).join("")}</div>
    <div class="swatches">${COLORS.map(([c,n])=>`<button class="sw" style="background:${c}" data-act="color" data-v="${c}" aria-pressed="${S.g.color===c}" aria-label="${esc(n)}" title="${esc(n)}"></button>`).join("")}</div>
    <div class="step"><span>${t("range")}</span><button data-act="g" data-v="range,-10" aria-label="menos">−</button><b>${dist(S.g.range)}</b><button data-act="g" data-v="range,10" aria-label="mais">+</button></div>
    <div class="step"><span>${t("margin")}</span><button data-act="g" data-v="margin,-5" aria-label="menos">−</button><b>${S.g.margin}%</b><button data-act="g" data-v="margin,5" aria-label="mais">+</button></div>
    <div class="step"><span>${t("cons")}</span><button data-act="g" data-v="kmpl,-0.5" aria-label="menos">−</button><b>${cons(S.g.kmpl)}</b><button data-act="g" data-v="kmpl,0.5" aria-label="mais">+</button></div>
    <p class="muted" style="font-size:13px">${t("usable", dist(usable()))}</p>`;
  }
  if (S.tab === "settings"){
    const prev = {dark:["#0D1117","#F5A524"],light:["#F6F7F9","#E08A00"],desert:["#1E140D","#E07A2E"],coast:["#0B1E24","#2EC4B6"]};
    const tg = (key, lab, sub) => `<button class="tg" data-act="toggle" data-v="${key}" aria-pressed="${S.set[key]}"><span>${t(lab)}${sub?`<small>${t(sub)}</small>`:""}</span><i></i></button>`;
    body = `<p class="h1">${t("settings")}</p><p class="sub">${t("sSub")}</p>
    <p class="sec">${t("lang")}</p><div class="seg">${[["pt","Português"],["en","English"],["es","Español"]].map(([k,l])=>`<button data-act="lang" data-v="${k}" aria-pressed="${S.set.lang===k}">${l}</button>`).join("")}</div>
    <p class="sec">${t("theme")}</p>${tg("vt","vt","vtSub")}
    <div class="themes" style="margin-top:8px">${Object.entries(prev).map(([k,[a,b]])=>{ const acc = S.set.vt ? accentFrom(S.g.color, k==="light").acc : b; return `<button data-act="theme" data-v="${k}" aria-pressed="${S.set.theme===k && !S.set.auto}" style="background:linear-gradient(135deg,${a} 45%,${acc});${k==="light"?"color:#1F2328":""}">${t(k)}</button>`; }).join("")}</div>
    <p class="sec">${t("nav")}</p>${tg("voice","voice")}${tg("sunset","sunsetW")}${tg("dirt","dirt")}${tg("auto","auto")}
    <p class="sec">${t("units")}</p><div class="seg"><button data-act="units" data-v="km" aria-pressed="${S.set.units==="km"}">km · L</button><button data-act="units" data-v="mi" aria-pressed="${S.set.units==="mi"}">mi · gal</button></div>
    <p class="sec">${t("yourName")}</p><input class="field" id="name-input" value="${esc(S.set.name)}" autocomplete="off">`;
  }
  const tabs = [["trips","🧭"],["route","🗺"],["garage","🏍"],["settings","⚙"]];
  return `<div class="statusbar"><span>${sb}</span><span>▮▮▮ 100%</span></div><div class="scr" id="scr">${body}</div>
  <nav class="tabbar">${tabs.map(([k,ic])=>`<button data-act="tab" data-v="${k}" ${S.tab===k?'aria-current="page"':""}><span class="ic">${ic}</span>${t(k)}</button>`).join("")}</nav>${modalHTML()}`;
}
function modalHTML(){
  const m = S.modal; if (!m) return "";
  if (m.type === "restart") return `<div class="modal"><div class="sheet"><h3>${t("restartQ")}</h3><div class="row-btns"><button class="btn" data-act="close">${t("cancel")}</button><button class="btn pri" data-act="doRestart">${t("restart")}</button></div></div></div>`;
  if (m.type === "menu"){ const st = S.trip.dias[S.shownDay].paradas[m.j]; return `<div class="modal" data-act="close"><div class="sheet"><h3>${emoji(st)} ${esc(st.nome)}</h3>${st.obs?`<p class="muted" style="margin:0">${esc(st.obs)}</p>`:""}<div class="row-btns"><button class="btn" data-act="editStop" data-v="${m.j}">${t("edit")}</button><button class="btn pri" data-act="setCur" data-v="${m.j}">${t("setCur")}</button></div></div></div>`; }
  if (m.type === "edit"){
    const st = m.j == null ? {nome:"",hora:"12:00",km:"",tipo:"parada"} : S.trip.dias[m.day].paradas[m.j];
    const kinds = [["abastecer","tFuel"],["almoco_abastecer","tMeal"],["abastecer_opcional","tOpt"],["pernoite","tNight"],["chegada","tArr"],["parada","tUser"]];
    const curT = m.tipo ?? (kindOf(st.tipo)==="USER" ? "parada" : st.tipo);
    return `<div class="modal"><form class="sheet" id="stop-form"><h3>${t(m.j==null?"newStop":"editStop")}</h3>
      <label>${t("name")}<input class="field" id="f-name" value="${esc(st.nome)}" required></label>
      <label>${t("time")}<input class="field" id="f-time" value="${esc(st.hora)}" inputmode="numeric"></label>
      <label>${t("km")}<input class="field" id="f-km" value="${esc(st.km)}" inputmode="decimal"></label>
      <div><span class="muted" style="font-size:12px">${t("type")}</span><div class="chips" style="margin:6px 0 0">${kinds.map(([v,k])=>`<button type="button" class="chip" data-act="kind" data-v="${v}" aria-pressed="${curT===v}">${t(k)}</button>`).join("")}</div></div>
      ${m.err?`<div class="err">${t("invalid")}</div>`:""}
      <div class="row-btns">${m.j!=null?`<button type="button" class="btn" style="color:var(--warn)" data-act="delStop">${t("del")}</button>`:""}<button type="button" class="btn" data-act="close">${t("cancel")}</button><button type="submit" class="btn pri">${t("save")}</button></div></form></div>`;
  }
  return "";
}
function renderPhone(){
  const scr = document.getElementById("scr"), top = scr ? scr.scrollTop : 0;
  const focused = document.activeElement?.id;
  if (disposeViewer){ disposeViewer(); disposeViewer = null; }
  app.dataset.t = appTheme();
  applyAccent();
  app.innerHTML = phoneHTML();
  const ns = document.getElementById("scr"); if (ns) ns.scrollTop = top;
  const v = document.getElementById("viewer");
  if (v && S.gview === "3d" && Moto3D) disposeViewer = Moto3D.mountViewer(v, S.g.model, S.g.color);
  if (focused) document.getElementById(focused)?.focus();
}

/* ---------------- Android Auto ---------------- */
const carui = document.getElementById("carui");
let mapOK = false;
/* Mapa offline: mapa.json (tiles do OpenStreetMap de Salvador, fontes e ícones) servido por um protocolo próprio. */
async function loadMapPack(){
  try {
    const res = await fetch("mapa.json"); if (!res.ok) throw new Error("mapa.json " + res.status);
    const pack = await res.json();
    const bin = atob(pack.data), buf = new Uint8Array(bin.length).buffer, u8 = new Uint8Array(buf);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const idx = pack.index, base = 0;
    const get = async path => {
      const e = idx[path]; if (!e) return null;
      const bytes = buf.slice(base + e[0], base + e[0] + e[1]);
      return e[2] ? await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer() : bytes;
    };
    maplibregl.addProtocol("pack", async params => {
      const path = decodeURIComponent(params.url.replace("pack://", ""));
      const data = await get(path);
      if (!data){ if (path.startsWith("tiles/")) return { data: new ArrayBuffer(0) }; throw new Error("sem " + path); }
      if (params.type === "json") return { data: JSON.parse(new TextDecoder().decode(data)) };
      return { data };
    });
    return JSON.parse(document.getElementById("mapstyle").textContent);
  } catch (e) { console.warn("mapa offline indisponível:", e); return null; }
}
let navBuilt = false;
function dayChanged(){ setNavRoute(); }
function stopMarkers(){
  const d = day(); if (!d) return [];
  return d.paradas.map((s, j) => ({ pos: posOf(s, d), color: (j < S.p.s || S.p.done) ? "#2EA043" : kindHex(kindOf(s.tipo)), label: `${emoji(s)} ${s.nome}`, reached: j < S.p.s || S.p.done, current: j === S.p.s && !S.p.done }));
}
function setNavRoute(){ if (!mapOK || !day()) return; Nav.setRoute(routeOf(S.p.d), stopMarkers()); }
function refreshSprites(){ if (!mapOK) return; Nav.setSprites(vehImg("chase", 256, 256), vehImg("top", 256, 256)); }

function carHTML(){
  const d = day();
  if (S.carScreen === "stages" && d){
    return `<div class="lt"><div class="hd"><button data-act="car" data-v="back" aria-label="Voltar">←</button>${esc(city(d.de))} → ${esc(city(d.para))}</div><ul>
    ${d.paradas.map((st,j)=>{ const st8 = S.p.done||j<S.p.s ? "✓ " : j===S.p.s ? "▶ " : ""; return `<li class="${j===S.p.s&&!S.p.done?"cur":""}"><button data-act="carJump" data-v="${j}"><span class="a">${st8}${emoji(st)} ${esc(st.nome)}</span><span class="b">${st.hora} · ${dist(st.km)}</span></button></li>`; }).join("")}</ul></div>`;
  }
  if (S.carScreen === "nav" && d && !S.p.done) return navShell();
  const h = Math.floor(clockAt(d || S.trip.dias[0], curKm())/60);
  const greet = t(h>=5&&h<12?"gm":h<18?"ga":"ge", esc(S.set.name));
  const tg = target();
  return `<div class="pane"><img src="${vehImg("hero", 900, 560)}" alt=""><div>
    <h2>${greet}</h2><p class="s1">${esc(t(modelInfo()[1]))} · ${esc(colorName())} · ${t("ready")}</p>
    ${S.p.done || !d ? `<div class="box"><div class="t">${t("done")}</div></div><div class="acts"><button class="pri" data-act="reset">${t("restart")}</button></div>` :
    `<div class="box"><div class="e">${t("cont", S.p.d+1, S.trip.dias.length)}</div><div class="t">${esc(city(d.de))} → ${esc(city(d.para))}</div><div class="d">${esc(t("next", dist(d.km), tg.nome, dist(Math.max(0,tg.km-curKm()))))}</div></div>
    <div class="acts"><button class="pri" data-act="car" data-v="nav">${t("follow")}</button><button data-act="car" data-v="stages">${t("stages")}</button></div>`}
  </div></div>${toastHTML()}`;
}
function toastHTML(){ return S.toast ? `<div class="toast" role="status">${esc(S.toast)}</div>` : ""; }
/* Estrutura fixa da navegação; os textos são atualizados por id (sem recriar botões). */
function navShell(){
  if (!mapOK) return `<div class="nomap">${t("mapNo")}</div><div class="strip"><button data-act="skip">${t("skip")}</button><button data-act="car" data-v="stages">${t("stages")}</button></div>${toastHTML()}`;
  return `<div class="route-card"><span id="n-arrow"></span><div class="dist" id="n-dist"></div><div class="cue" id="n-cue"></div><div class="then" id="n-then"></div></div>
  <div class="strip"><button data-act="skip">${t("skip")}</button><button data-act="car" data-v="stages">${t("stages")}</button></div>
  <div class="mapbtns"><button data-act="follow" id="n-follow"></button><button data-act="tilt" id="n-tilt"></button></div>
  <div class="panel">
    <div class="pc"><div class="e">${t("autonomy")}</div><div class="t" id="n-range"></div><div class="bar"><i id="n-bar"></i></div><div class="d" id="n-fuel"></div></div>
    <div class="pc"><div class="e" id="n-stagelbl"></div><div class="t" id="n-stage"></div><div class="d" id="n-stagedet"></div></div>
    <div class="pc"><div class="e">${t("dest")}</div><div class="t" id="n-dest"></div><div class="d" id="n-destdet"></div></div>
  </div>
  <div class="nchips"><span id="n-eta"></span><span class="road" id="n-road"></span><span><i class="lv"></i>${t("offline")}</span></div>
  <span class="attr">© OpenStreetMap</span>
  <div id="n-toast">${toastHTML()}</div>`;
}
const setText = (id, v) => { const el = document.getElementById(id); if (el && el.textContent !== v) el.textContent = v; };
function updateNav(){
  if (S.carScreen !== "nav" || !mapOK || !day() || S.p.done) return;
  const d = day(), tg = target(), ck = curKm();
  Nav.update(S.rm, S.speed);
  const st = Nav.nextStep(S.rm);
  const arrowEl = document.getElementById("n-arrow"); if (!arrowEl) return;
  const key = st ? (st.t + st.m) : "none"; if (arrowEl.dataset.k !== key){ arrowEl.innerHTML = arrowSVG(st); arrowEl.dataset.k = key; }
  setText("n-dist", st ? distShort(st.dist) : distShort((kmToRm(tg.km) - S.rm)));
  setText("n-cue", st ? instruction(st) : tg.nome);
  setText("n-then", st && st.after && st.after.t !== "arrive" ? t("then", instruction(st.after)) : `${emoji(tg)} ${tg.nome}`);
  setText("n-follow", Nav.follow ? t("overview") : t("followBtn"));
  setText("n-tilt", Nav.tilt ? "2D" : "3D");
  const left = rangeLeft(), frac = Math.min(1, left/usable());
  setText("n-range", t("left", dist(left)));
  const bar = document.getElementById("n-bar"); bar.style.width = (frac*100).toFixed(1)+"%"; bar.style.background = frac>.5?"#2EA043":frac>.25?"#F5A524":"#E5534B";
  const nf = nextFuel(); setText("n-fuel", nf ? t("nextFuel", dist(Math.max(0,nf.km-ck)), (nf.km-ck)<=left ? t("ok") : t("low")) : t("noFuel"));
  setText("n-stagelbl", t("nextStage", S.p.s+1, d.paradas.length));
  setText("n-stage", `${emoji(tg)} ${tg.nome}`);
  setText("n-stagedet", `${t("arr", toHM(clockAt(d, tg.km)))} · ${dist(Math.max(0, tg.km-ck))}`);
  const dest = d.paradas[d.paradas.length-1], ss = sunsetOf(d);
  setText("n-dest", `${emoji(dest)} ${dest.nome}`);
  setText("n-destdet", t("arr", dest.hora) + (ss ? " · " + t("sunset", ss) : ""));
  setText("n-eta", t("eta", dest.hora, dist(Math.max(0, d.km-ck)), city(d.para)));
  setText("n-road", Nav.roadAt(S.rm) || city(d.de));
  const tb = document.getElementById("n-toast"); if (tb && tb.dataset.v !== (S.toast||"")){ tb.innerHTML = toastHTML(); tb.dataset.v = S.toast || ""; }
}
function renderCar(){
  const wasNav = navBuilt;
  carui.innerHTML = carHTML();
  navBuilt = S.carScreen === "nav";
  document.getElementById("mapwrap").style.visibility = navBuilt ? "visible" : "hidden";
  if (navBuilt){ if (!wasNav){ Nav.resize(); } updateNav(); }
  renderSim();
}
function renderSim(){
  const d = day() || S.trip.dias[S.trip.dias.length-1];
  document.getElementById("clk").textContent = toHM(clockAt(d, curKm()));
  document.getElementById("simkm").textContent = S.p.done ? t("done") : `${t("day")} ${S.p.d+1} · km ${Math.round(curKm())} / ${d.km}`;
  document.getElementById("drivebtn").textContent = S.driving ? "⏸ Pausar" : "▶ Simular direção";
}
function renderAll(){ renderPhone(); refreshSprites(); if (mapOK && day()) Nav.updateStops(stopMarkers()); renderCar(); }

/* ---------------- avisos ---------------- */
let toastTimer = null, sunsetWarned = -1, voiceUnlocked = false;
function toast(msg){ S.toast = msg; clearTimeout(toastTimer); toastTimer = setTimeout(()=>{ S.toast = null; if (S.carScreen === "nav") updateNav(); else renderCar(); }, 3400); speak(msg); }
function speak(msg){ try { if (S.set.voice && window.speechSynthesis && voiceUnlocked){ const u = new SpeechSynthesisUtterance(msg); u.lang = {pt:"pt-BR",en:"en-US",es:"es-ES"}[S.set.lang]; speechSynthesis.cancel(); speechSynthesis.speak(u); } } catch(e){} }

/* ---------------- simulação da estrada ---------------- */
// 1× ≈ 220 m/s de simulação (a viagem do dia passa em ~45 min); 5× e 20× para avançar rápido.
const MPS = 15; // 1× ≈ 54 km/h (velocidade real de bairro); 5×, 20× e 100× para avançar rápido
let raf = 0, lastT = 0, lastUi = 0;
function frameLoop(now){
  if (!S.driving){ raf = 0; return; }
  const dt = Math.min(0.1, (now - (lastT || now)) / 1000); lastT = now;
  const tg = target(); if (!tg){ stopDrive(); return; }
  const endRm = kmToRm(tg.km);
  S.rm = Math.min(endRm, S.rm + MPS * S.speed * dt);
  S.km = rmToKm(S.rm);
  const d = day();
  const ss = sunsetOf(d);
  if (S.set.sunset && ss && sunsetWarned !== S.p.d){ const left = toMin(ss) - clockAt(d, S.km); if (left > 0 && left <= 60){ sunsetWarned = S.p.d; toast(t("sunWarn", ss, dist(d.km - S.km), city(d.para))); } }
  if (S.rm >= endRm - 0.5){
    const lastOfDay = S.p.s === d.paradas.length - 1;
    toast(lastOfDay ? t("dayDone", tg.nome) : t("arrived", tg.nome));
    advance();
    if (lastOfDay){ stopDrive(); S.carScreen = "welcome"; S.shownDay = S.p.d; renderAll(); return; }
    S.shownDay = S.p.d; renderPhone(); Nav.updateStops(stopMarkers());
  }
  updateNav();
  if (now - lastUi > 250){ lastUi = now; renderSim(); }
  raf = requestAnimationFrame(frameLoop);
}
function startDrive(){ if (S.p.done) return; if (S.carScreen !== "nav"){ S.carScreen = "nav"; renderCar(); } S.driving = true; lastT = 0; raf = requestAnimationFrame(frameLoop); renderSim(); }
function stopDrive(){ S.driving = false; cancelAnimationFrame(raf); raf = 0; renderSim(); }

/* ---------------- interação ---------------- */
document.addEventListener("click", e => {
  const el = e.target.closest("[data-act]"); if (!el) return;
  if (el.classList.contains("modal") && e.target !== el) return;
  voiceUnlocked = true;
  const a = el.dataset.act, v = el.dataset.v;
  switch (a){
    case "show": document.getElementById("stage").dataset.show = v; document.querySelectorAll('[data-act="show"]').forEach(b=>b.setAttribute("aria-pressed", b.dataset.v===v)); requestAnimationFrame(() => { Nav.resize(); updateNav(); }); return;
    case "tab": S.tab = v; S.modal = null; if (v==="route") S.shownDay = Math.min(S.p.d, S.trip.dias.length-1); renderPhone(); document.getElementById("scr").scrollTop = 0; return;
    case "day": S.shownDay += Number(v); renderPhone(); return;
    case "back": back(); S.shownDay = S.p.d; break;
    case "adv": advance(); S.shownDay = Math.min(S.p.d, S.trip.dias.length-1); break;
    case "askRestart": S.modal = {type:"restart"}; renderPhone(); return;
    case "doRestart": case "reset": stopDrive(); jump(0,0); S.shownDay = 0; S.modal = null; S.carScreen = "welcome"; sunsetWarned = -1; break;
    case "close": S.modal = null; renderPhone(); return;
    case "stopMenu": S.modal = {type:"menu", j:Number(v)}; renderPhone(); return;
    case "setCur": jump(S.shownDay, Number(v)); S.modal = null; break;
    case "editStop": S.modal = {type:"edit", day:S.shownDay, j:Number(v)}; renderPhone(); return;
    case "editCur": S.modal = {type:"edit", day:S.shownDay, j: S.p.d===S.shownDay ? Math.min(S.p.s, S.trip.dias[S.shownDay].paradas.length-1) : 0}; renderPhone(); return;
    case "addStop": S.modal = {type:"edit", day:S.shownDay, j:null}; renderPhone(); return;
    case "kind": { const f = readForm(); S.modal = {...S.modal, tipo:v}; renderPhone(); fillForm(f); return; }
    case "delStop": { const ps = S.trip.dias[S.modal.day].paradas; if (ps.length > 1){ ps.splice(S.modal.j,1); if (S.p.d===S.modal.day) S.p.s = Math.min(S.p.s, ps.length-1); syncRm(); } S.modal = null; break; }
    case "trip": { stopDrive(); const x = TRIPS.find(z => z.id === v); if (x){ S.trip = JSON.parse(JSON.stringify(x)); S.p = {d:0, s:0, done:false}; S.shownDay = 0; S.carScreen = "welcome"; sunsetWarned = -1; syncRm(); setNavRoute(); } break; }
    case "model": S.g.model = v; break;
    case "color": S.g.color = v; break;
    case "gview": S.gview = v; renderPhone(); return;
    case "g": { const [key, dlt] = v.split(","); const lim = {range:[50,1500], margin:[0,60], kmpl:[3,60]}[key]; S.g[key] = Math.min(lim[1], Math.max(lim[0], +(S.g[key] + Number(dlt)).toFixed(1))); break; }
    case "lang": S.set.lang = v; break;
    case "theme": S.set.theme = v; S.set.auto = false; break;
    case "toggle": S.set[v] = !S.set[v]; break;
    case "units": S.set.units = v; break;
    case "car":
      if (v === "stages"){ S.prevNav = S.carScreen === "nav"; S.carScreen = "stages"; }
      else if (v === "back") S.carScreen = S.prevNav ? "nav" : "welcome";
      else S.carScreen = v;
      renderCar(); return;
    case "carJump": jump(S.p.d, Number(v)); S.carScreen = S.prevNav ? "nav" : "welcome"; S.shownDay = S.p.d; break;
    case "skip": { const tg = target(); if (tg){ const lastOfDay = S.p.s === day().paradas.length-1; toast(lastOfDay ? t("dayDone", tg.nome) : t("arrived", tg.nome)); advance(); if (lastOfDay){ stopDrive(); S.carScreen = "welcome"; } S.shownDay = S.p.d; } break; }
    case "follow": Nav.setFollow(!Nav.follow, S.rm); updateNav(); return;
    case "tilt": Nav.setTilt(!Nav.tilt); updateNav(); return;
    case "drive": S.driving ? stopDrive() : startDrive(); return;
    case "speed": S.speed = S.speed === 1 ? 5 : S.speed === 5 ? 20 : S.speed === 20 ? 100 : 1; el.textContent = `Velocidade ${S.speed}×`; return;
  }
  renderAll();
});
function readForm(){ const g = id => document.getElementById(id)?.value ?? ""; return {nome:g("f-name"), hora:g("f-time"), km:g("f-km")}; }
function fillForm(f){ if (!f) return; const s = (id,v)=>{ const el = document.getElementById(id); if (el) el.value = v; }; s("f-name",f.nome); s("f-time",f.hora); s("f-km",f.km); }
document.addEventListener("submit", e => {
  if (e.target.id !== "stop-form") return; e.preventDefault();
  const f = readForm(), km = parseFloat(String(f.km).replace(",", ".")), okT = /^([01]\d|2[0-3]):[0-5]\d$/.test(f.hora.trim());
  if (!f.nome.trim() || isNaN(km) || km < 0 || !okT){ S.modal = {...S.modal, err:true}; renderPhone(); fillForm(f); return; }
  const m = S.modal, ps = S.trip.dias[m.day].paradas;
  const tipo = m.tipo ?? (m.j != null ? ps[m.j].tipo : "parada");
  const st = {...(m.j != null ? ps[m.j] : {}), nome:f.nome.trim(), hora:f.hora.trim(), km, tipo};
  if (m.j != null) ps[m.j] = st; else ps.push(st);
  ps.sort((a,b)=>a.km-b.km);
  if (S.p.d === m.day) S.p.s = Math.min(S.p.s, ps.length-1);
  syncRm();
  S.modal = null; renderAll();
});
document.addEventListener("input", e => { if (e.target.id === "name-input" && e.target.value.trim()){ S.set.name = e.target.value.trim(); renderCar(); } });

/* ---------------- início ---------------- */
syncRm();
renderAll();
loadMapPack().then(style => {
  mapOK = Nav.init(document.getElementById("mapwrap"), style);
  setNavRoute(); refreshSprites(); applyAccent(); renderCar();
});
