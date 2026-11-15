import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { haversineKm, timeToMinutes } from "../core/geo.js";
import {
  usableRangeKm,
  normalizeTrip,
  nextFuelStop,
  checkDayCoverage,
  suggestFuelStops,
  currentStop,
  advance,
  fuelRemainingKm,
} from "../core/planner.js";

const here = dirname(fileURLToPath(import.meta.url));
const raw = JSON.parse(
  readFileSync(join(here, "../dados/viagem-exemplo.json"), "utf8"),
);
const trip = normalizeTrip(raw);

test("autonomia útil = autonomia × (1 − margem)", () => {
  assert.equal(usableRangeKm({ autonomia_km: 200, margem_seguranca_pct: 30 }), 140);
  // Bate com regras.intervalo_abastecimento_km do JSON de teste.
  assert.equal(trip.rangeKm, raw.regras.intervalo_abastecimento_km);
});

test("haversine: Salvador → Fortaleza fica entre 1000 e 1050 km em linha reta", () => {
  const salvador = { lat: -12.9714, lng: -38.5014 };
  const fortaleza = { lat: -3.7319, lng: -38.5267 };
  const d = haversineKm(salvador, fortaleza);
  assert.ok(d > 1000 && d < 1050, `distância inesperada: ${d}`);
});

test("timeToMinutes converte HH:MM", () => {
  assert.equal(timeToMinutes("00:00"), 0);
  assert.equal(timeToMinutes("15:30"), 930);
});

test("normalizeTrip mantém os 8 dias e marca postos de abastecimento", () => {
  assert.equal(trip.days.length, 8);
  const day1 = trip.days[0];
  const fuel = day1.stops.filter((s) => s.isFuel).map((s) => s.km);
  assert.deepEqual(fuel, [115, 255, 415, 520]);
  assert.equal(day1.stops.find((s) => s.tipo === "abastecer_opcional").isOptional, true);
});

test("nextFuelStop escolhe o posto mais distante dentro da autonomia", () => {
  const candidates = [{ km: 100 }, { km: 130 }, { km: 200 }];
  assert.equal(nextFuelStop(candidates, 0, 140).km, 130);
});

test("nextFuelStop retorna null quando nenhum posto é alcançável", () => {
  assert.equal(nextFuelStop([{ km: 300 }], 0, 140), null);
});

test("nextFuelStop respeita o limite do trecho (endKm)", () => {
  const candidates = [{ km: 100 }, { km: 130 }];
  assert.equal(nextFuelStop(candidates, 0, 140, 110).km, 100);
});

test("checkDayCoverage: dia 1 (580 km, postos cadastrados) não tem trecho sem posto", () => {
  // Trechos: 0→115, 115→255 (140), 255→415 (160 → excede 140) ...
  const cov = checkDayCoverage(trip.days[0], trip.rangeKm);
  assert.equal(cov.ok, false);
  assert.deepEqual(cov.gaps, [{ fromKm: 255, toKm: 415, legKm: 160 }]);
});

test("checkDayCoverage: dia 2 (520 km) fica dentro da autonomia", () => {
  const cov = checkDayCoverage(trip.days[1], trip.rangeKm);
  assert.equal(cov.ok, true, JSON.stringify(cov.gaps));
});

test("suggestFuelStops cobre um trecho longo com postos candidatos", () => {
  const candidates = [{ km: 100 }, { km: 200 }, { km: 300 }, { km: 400 }];
  const picks = suggestFuelStops(candidates, 0, 500, 140).map((s) => s.km);
  assert.deepEqual(picks, [100, 200, 300, 400]); // ordem de percurso
});

test("suggestFuelStops sem candidatos suficientes para antes de travar", () => {
  const picks = suggestFuelStops([{ km: 300 }], 0, 500, 140);
  assert.deepEqual(picks, []);
});

test("progresso avança parada a parada e troca de dia ao acabar", () => {
  let p = { dayIndex: 0, stopIndex: 0, kmSinceFuel: 0 };
  assert.equal(currentStop(trip, p).nome, "Posto Linha Verde – Subaúma (BA-099)");
  p = advance(trip, p);
  assert.equal(p.stopIndex, 1);
  // Vai até a última parada do dia 1 e depois para o dia 2.
  for (let i = 0; i < trip.days[0].stops.length - 1; i++) p = advance(trip, p);
  assert.equal(p.dayIndex, 1);
  assert.equal(p.stopIndex, 0);
});

test("progresso termina na última parada da última viagem", () => {
  let p = { dayIndex: trip.days.length - 1, stopIndex: 0, kmSinceFuel: 0 };
  for (let i = 0; i < trip.days.at(-1).stops.length; i++) p = advance(trip, p);
  assert.equal(p.done, true);
  assert.equal(currentStop(trip, { dayIndex: 99, stopIndex: 0 }), null);
});

test("autonomia restante desconta o km rodado desde o último abastecimento", () => {
  assert.equal(fuelRemainingKm(trip, { kmSinceFuel: 0 }), 140);
  assert.equal(fuelRemainingKm(trip, { kmSinceFuel: 60 }), 80);
  assert.equal(fuelRemainingKm(trip, { kmSinceFuel: 999 }), 0);
});
