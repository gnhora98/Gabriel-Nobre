// Planejamento da viagem: autonomia, margem de segurança e postos.
import { timeToMinutes } from "./geo.js";

// Autonomia útil = autonomia × (1 − margem). Ex.: 200 km com 30% → 140 km.
export function usableRangeKm(vehicle) {
  return vehicle.autonomia_km * (1 - vehicle.margem_seguranca_pct / 100);
}

// Normaliza o JSON da viagem: calcula km acumulado e minutos de cada parada.
export function normalizeTrip(raw) {
  return {
    nome: raw.nome,
    veiculo: raw.veiculo,
    regras: raw.regras,
    rangeKm: usableRangeKm(raw.veiculo),
    days: raw.dias.map((day, dayIndex) => ({
      ...day,
      dayIndex,
      stops: day.paradas.map((stop, stopIndex) => ({
        ...stop,
        dayIndex,
        stopIndex,
        minutes: timeToMinutes(stop.hora),
        isFuel: stop.tipo.includes("abastecer"),
        isOptional: stop.tipo === "abastecer_opcional",
      })),
    })),
  };
}

// Dado o km atual e os postos candidatos, escolhe o próximo abastecimento
// de forma gulosa: o posto mais distante que ainda é alcançável com a
// autonomia útil (sem ultrapassar o km final do trecho).
// Retorna null se não houver posto alcançável (trecho sem combustível).
export function nextFuelStop(candidates, currentKm, rangeKm, endKm = Infinity) {
  let best = null;
  for (const c of candidates) {
    if (c.km <= currentKm) continue;
    if (c.km - currentKm > rangeKm) continue;
    if (c.km > endKm) continue;
    if (!best || c.km > best.km) best = c;
  }
  return best;
}

// Verifica, para um dia, se os postos cadastrados cobrem o trajeto sem
// ultrapassar a autonomia útil. Retorna os trechos que ficam sem posto.
export function checkDayCoverage(day, rangeKm) {
  const fuelKms = [0, ...day.stops.filter((s) => s.isFuel).map((s) => s.km)];
  const endKm = day.km;
  fuelKms.push(endKm);
  const gaps = [];
  for (let i = 1; i < fuelKms.length; i++) {
    const legKm = fuelKms[i] - fuelKms[i - 1];
    if (legKm > rangeKm) {
      gaps.push({ fromKm: fuelKms[i - 1], toKm: fuelKms[i], legKm });
    }
  }
  return { ok: gaps.length === 0, gaps };
}

// Sugere paradas de combustível para um trecho usando os postos cadastrados.
// Usado quando o usuário adiciona um destino novo ou quando o roteiro muda.
export function suggestFuelStops(candidates, startKm, endKm, rangeKm) {
  const suggestions = [];
  let current = startKm;
  while (endKm - current > rangeKm) {
    const stop = nextFuelStop(candidates, current, rangeKm, endKm);
    if (!stop) break; // sem posto alcançável: o caller decide o que fazer
    suggestions.push(stop);
    current = stop.km;
  }
  return suggestions;
}

// Estado de progresso da viagem, salvo para retomar no dia seguinte.
export function startProgress(trip) {
  return { dayIndex: 0, stopIndex: 0, kmSinceFuel: 0 };
}

// Próxima parada a partir do progresso atual, ou null se a viagem acabou.
export function currentStop(trip, progress) {
  const day = trip.days[progress.dayIndex];
  if (!day) return null;
  return day.stops[progress.stopIndex] ?? null;
}

// Avança para a próxima parada. Pula para o próximo dia quando o dia acaba.
export function advance(trip, progress) {
  const day = trip.days[progress.dayIndex];
  if (!day) return progress;
  if (progress.stopIndex + 1 < day.stops.length) {
    return { ...progress, stopIndex: progress.stopIndex + 1 };
  }
  if (progress.dayIndex + 1 < trip.days.length) {
    return { dayIndex: progress.dayIndex + 1, stopIndex: 0, kmSinceFuel: 0 };
  }
  return { ...progress, done: true };
}

// Autonomia restante (km) a partir do último abastecimento.
export function fuelRemainingKm(trip, progress) {
  return Math.max(0, trip.rangeKm - progress.kmSinceFuel);
}
