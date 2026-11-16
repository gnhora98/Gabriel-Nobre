package com.viagemestrada.core

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.sin

/** Manobra da rota (formato OSRM compactado): distância do início do dia, tipo, direção, via. */
@Serializable
data class RouteStep(
    @SerialName("d") val atMeters: Double,
    @SerialName("t") val type: String,
    @SerialName("m") val modifier: String? = null,
    @SerialName("n") val road: String = "",
    @SerialName("x") val exit: Int? = null,
)

/** Rota real de um dia: geometria [lng, lat], comprimento de cada perna (entre paradas) e manobras. */
@Serializable
data class DayRoute(
    val line: List<List<Double>>,
    val legs: List<Double>,
    val steps: List<RouteStep>,
) {
    companion object {
        private val json = Json { ignoreUnknownKeys = true }
        fun listFromJson(text: String): List<DayRoute> = json.decodeFromString(ListSerializer(serializer()), text)
    }
}

/** Próxima manobra e a distância até ela. */
data class UpcomingStep(val step: RouteStep, val distanceMeters: Double, val after: RouteStep?)

/**
 * Trilho de um dia: permite andar pela rota por distância (simulação), saber a
 * direção da via, projetar o GPS sobre a rota e achar a próxima manobra.
 */
class RouteTrack(val route: DayRoute) {
    private val pts: List<LatLng> = route.line.map { LatLng(it[1], it[0]) }
    private val cum: DoubleArray = DoubleArray(pts.size).also { c ->
        for (i in 1 until pts.size) c[i] = c[i - 1] + Geo.distanceKm(pts[i - 1], pts[i]) * 1000
    }
    val totalMeters: Double = cum.lastOrNull() ?: 0.0

    // As pernas e manobras do OSRM somam ~ o total da linha simplificada: normaliza.
    private val scale: Double = route.legs.sum().let { if (it > 0) totalMeters / it else 1.0 }

    /** Fim de cada perna (m), na mesma escala da linha. */
    val legEnds: List<Double> = route.legs.runningReduce { a, b -> a + b }.map { it * scale }
    private val stepAt: List<Double> = route.steps.map { it.atMeters * scale }

    val points: List<LatLng> get() = pts

    fun pointAt(meters: Double): LatLng {
        if (pts.isEmpty()) return LatLng(0.0, 0.0)
        val s = meters.coerceIn(0.0, totalMeters)
        var lo = 0; var hi = cum.size - 1
        while (hi - lo > 1) { val m = (lo + hi) ushr 1; if (cum[m] <= s) lo = m else hi = m }
        val seg = (cum[hi] - cum[lo]).takeIf { it > 0 } ?: 1.0
        val f = (s - cum[lo]) / seg
        val a = pts[lo]; val b = pts[hi]
        return LatLng(a.lat + (b.lat - a.lat) * f, a.lng + (b.lng - a.lng) * f)
    }

    /** Direção (graus, 0 = norte) da via em [meters], olhando [ahead] metros à frente. */
    fun bearingAt(meters: Double, ahead: Double = 40.0): Double {
        val a = pointAt(meters)
        val b = pointAt((meters + ahead).coerceAtMost(totalMeters))
        val from = if (meters + ahead > totalMeters) pointAt((meters - ahead).coerceAtLeast(0.0)) else a
        val to = if (meters + ahead > totalMeters) a else b
        return bearing(from, to)
    }

    /**
     * Projeta uma posição de GPS sobre a rota, procurando perto de [hintMeters]
     * (evita "pular" para outro trecho que passa perto). Retorna a distância ao
     * longo da rota e o afastamento lateral em metros.
     */
    fun project(position: LatLng, hintMeters: Double = 0.0, window: Double = 3000.0): Pair<Double, Double> {
        var best = hintMeters; var bestDist = Double.MAX_VALUE
        val k = cos(Math.toRadians(position.lat)) * 111_320.0
        for (i in 1 until pts.size) {
            if (cum[i] < hintMeters - 200 || cum[i - 1] > hintMeters + window) continue
            val ax = (pts[i - 1].lng - position.lng) * k; val ay = (pts[i - 1].lat - position.lat) * 111_320.0
            val bx = (pts[i].lng - position.lng) * k; val by = (pts[i].lat - position.lat) * 111_320.0
            val dx = bx - ax; val dy = by - ay; val len2 = dx * dx + dy * dy
            val t = if (len2 == 0.0) 0.0 else (-(ax * dx + ay * dy) / len2).coerceIn(0.0, 1.0)
            val x = ax + t * dx; val y = ay + t * dy
            val d = kotlin.math.sqrt(x * x + y * y)
            if (d < bestDist) { bestDist = d; best = cum[i - 1] + t * (cum[i] - cum[i - 1]) }
        }
        return best to bestDist
    }

    /** Próxima manobra depois de [meters] (ignora a saída). */
    fun nextStep(meters: Double): UpcomingStep? {
        for (i in route.steps.indices) {
            val st = route.steps[i]
            if (st.type == "depart") continue
            if (stepAt[i] > meters + 4) return UpcomingStep(st, stepAt[i] - meters, route.steps.getOrNull(i + 1))
        }
        return null
    }

    /** Nome da via atual. */
    fun roadAt(meters: Double): String {
        var name = ""
        for (i in route.steps.indices) {
            if (stepAt[i] <= meters) { if (route.steps[i].road.isNotBlank()) name = route.steps[i].road } else break
        }
        return name
    }

    companion object {
        fun bearing(a: LatLng, b: LatLng): Double {
            val y = sin(Math.toRadians(b.lng - a.lng)) * cos(Math.toRadians(b.lat))
            val x = cos(Math.toRadians(a.lat)) * sin(Math.toRadians(b.lat)) -
                sin(Math.toRadians(a.lat)) * cos(Math.toRadians(b.lat)) * cos(Math.toRadians(b.lng - a.lng))
            return (Math.toDegrees(atan2(y, x)) + 360) % 360
        }
    }
}
