"""Ajuste harmonico de mare a partir do nivel do mar horario (Open-Meteo Marine).

Uso: python3 scripts/tide_fit.py historico.json saida.json
Gera constantes (amplitude/fase por constituinte) usadas pelo app pra prever mare offline.
"""
import json, math, sys
from datetime import datetime, timezone
import numpy as np

SPEEDS = {  # graus/hora
    "M2": 28.9841042, "S2": 30.0, "N2": 28.4397295, "K2": 30.0821373,
    "K1": 15.0410686, "O1": 13.9430356, "P1": 14.9589314, "Q1": 13.3986609,
    "M4": 57.9682084, "MS4": 58.9841042, "MN4": 57.4238337, "M6": 86.9523127,
    "2N2": 27.8953548, "MU2": 27.9682084, "NU2": 28.5125831, "L2": 29.5284789,
    "T2": 29.9589333, "J1": 15.5854433, "OO1": 16.1391017, "M3": 43.4761563,
    "MK3": 44.0251729, "2Q1": 12.8542862, "Mf": 1.0980331, "Mm": 0.5443747,
    "Ssa": 0.0821373, "Sa": 0.0410686,
}
EPOCH = datetime(2026, 1, 1, tzinfo=timezone.utc)


def node_deg(t_hours):
    """Longitude do nodo lunar (graus) para horas desde EPOCH."""
    jd = 2461041.5 + t_hours / 24.0  # JD de 2026-01-01 00:00 UTC
    T = (jd - 2451545.0) / 36525.0
    return 125.04452 - 1934.136261 * T


def nodal(name, N):
    n = math.radians(N)
    c, s = math.cos, math.sin
    fm2 = 1.0004 - 0.0373 * c(n) + 0.0002 * c(2 * n)
    um2 = -2.14 * s(n)
    if name in ("M2", "N2", "2N2", "MU2", "NU2", "L2"):
        return fm2, um2
    if name == "K2":
        return 1.0241 + 0.2863 * c(n) + 0.0083 * c(2 * n) - 0.0015 * c(3 * n), -17.74 * s(n) + 0.68 * s(2 * n) - 0.04 * s(3 * n)
    if name == "K1":
        return 1.0060 + 0.1150 * c(n) - 0.0088 * c(2 * n) + 0.0006 * c(3 * n), -8.86 * s(n) + 0.68 * s(2 * n) - 0.07 * s(3 * n)
    if name in ("O1", "Q1", "2Q1"):
        return 1.0089 + 0.1871 * c(n) - 0.0147 * c(2 * n) + 0.0014 * c(3 * n), 10.80 * s(n) - 1.34 * s(2 * n) + 0.19 * s(3 * n)
    if name == "J1":
        return 1.0129 + 0.1676 * c(n) - 0.0170 * c(2 * n) + 0.0016 * c(3 * n), -12.94 * s(n) + 1.34 * s(2 * n) - 0.19 * s(3 * n)
    if name == "OO1":
        return 1.1027 + 0.6504 * c(n) + 0.0317 * c(2 * n) - 0.0014 * c(3 * n), -36.68 * s(n) + 4.02 * s(2 * n) - 0.57 * s(3 * n)
    if name in ("M4", "MN4"):
        return fm2 ** 2, 2 * um2
    if name == "MS4":
        return fm2, um2
    if name == "M6":
        return fm2 ** 3, 3 * um2
    if name == "M3":
        return fm2 ** 1.5, 1.5 * um2
    if name == "MK3":
        fk1, uk1 = nodal("K1", N)
        return fm2 * fk1, um2 + uk1
    if name == "Mf":
        return 1.043 + 0.414 * c(n), -23.7 * s(n) + 2.7 * s(2 * n) - 0.4 * s(3 * n)
    if name == "Mm":
        return 1.0 - 0.130 * c(n), 0.0
    return 1.0, 0.0


def design(t, names):
    N = node_deg(t)
    cols = [np.ones_like(t)]
    for k in names:
        f, u = np.vectorize(lambda x: nodal(k, x))(N)
        arg = np.radians(SPEEDS[k] * t + u)
        cols += [f * np.cos(arg), f * np.sin(arg)]
    return np.column_stack(cols)


def load_uhslc(path, since):
    """CSV horario da UHSLC (ano,mes,dia,hora,mm), UTC; -32767 = sem dado."""
    t, h = [], []
    for line in open(path):
        y, mo, d, hr, v = (int(x) for x in line.strip().split(","))
        if v == -32767:
            continue
        dt = datetime(y, mo, d, hr, tzinfo=timezone.utc)
        if dt < since:
            continue
        t.append((dt - EPOCH).total_seconds() / 3600.0)
        h.append(v / 1000.0)
    return np.array(t), np.array(h)


def load(path):
    if path.endswith(".csv"):
        return load_uhslc(path, datetime(2023, 9, 1, tzinfo=timezone.utc))
    d = json.load(open(path))
    times = d["hourly"]["time"]
    vals = d["hourly"]["sea_level_height_msl"]
    t, h = [], []
    for ts, v in zip(times, vals):
        if v is None:
            continue
        dt = datetime.fromisoformat(ts).replace(tzinfo=timezone.utc)
        t.append((dt - EPOCH).total_seconds() / 3600.0)
        h.append(v)
    return np.array(t), np.array(h)


def main(src, out):
    t, h = load(src)
    names = list(SPEEDS)
    A = design(t, names)
    coef, *_ = np.linalg.lstsq(A, h, rcond=None)
    resid = h - A @ coef
    cons = {}
    for i, k in enumerate(names):
        a, b = coef[1 + 2 * i], coef[2 + 2 * i]
        cons[k] = {"amp": round(float(math.hypot(a, b)), 4), "phase": round(float(math.degrees(math.atan2(b, a)) % 360), 2), "speed": SPEEDS[k]}
    # Nivel de reducao (NR) da DHN: Z0 = 133,5 cm abaixo do nivel medio (ficha F-41, estacao 40141 Capitania dos Portos)
    datum = 1.335
    res = {
        "station": "Salvador - Capitania dos Portos (EMSAL / UHSLC 708)",
        "epoch": EPOCH.isoformat(),
        "z0": round(float(coef[0]), 4),
        "datumOffset": round(datum, 3),
        "rmsResidual": round(float(np.sqrt(np.mean(resid ** 2))), 4),
        "hours": int(len(t)),
        "constituents": cons,
    }
    json.dump(res, open(out, "w"), indent=1)
    print(json.dumps({k: res[k] for k in ("z0", "datumOffset", "rmsResidual", "hours")}))
    for k in sorted(cons, key=lambda k: -cons[k]["amp"])[:8]:
        print(k, cons[k]["amp"], cons[k]["phase"])


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
