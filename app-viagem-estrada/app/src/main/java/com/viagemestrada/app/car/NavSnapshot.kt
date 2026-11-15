package com.viagemestrada.app.car

import android.content.Context
import com.viagemestrada.app.R
import com.viagemestrada.app.data.AppState
import com.viagemestrada.app.data.Units
import com.viagemestrada.app.ui.Format
import com.viagemestrada.core.Geo
import com.viagemestrada.core.LatLng
import com.viagemestrada.core.StopKind

/** Ponto do roteiro do dia, já com status, para desenhar no mapa. */
data class MapPoint(val pos: LatLng, val kind: StopKind, val reached: Boolean, val isTarget: Boolean)

/**
 * Tudo que a tela de navegação mostra, calculado a partir do estado do app
 * e da posição atual (GPS, se houver). Separado do desenho para ficar simples.
 */
data class NavSnapshot(
    val points: List<MapPoint>,
    val vehiclePos: LatLng?,
    val rangeLeftKm: Double,
    val rangeTotalKm: Double,
    val rangeText: String,
    val nextFuelText: String,
    val stageLabel: String,
    val stageName: String,
    val stageDetail: String,
    val destinationName: String,
    val destinationDetail: String,
    val chipRemaining: String,
    val cue: String,
    val distanceToTargetKm: Double,
    val dayRemainingKm: Double,
    val units: Units,
) {
    val rangeFraction: Float get() = if (rangeTotalKm <= 0) 0f else (rangeLeftKm / rangeTotalKm).toFloat().coerceIn(0f, 1f)

    companion object {
        fun build(context: Context, s: AppState, position: LatLng?): NavSnapshot? {
            val nav = s.navigator
            val p = s.progress
            val day = nav.day(p) ?: return null
            val target = nav.target(p) ?: return null
            val units = s.settings.units

            // Km atual: pela distância até o alvo (GPS) ou pela última parada alcançada.
            val reached = nav.reachedKm(p)
            val gpsKm = if (position != null && target.hasLocation) {
                target.km - Geo.distanceKm(position, LatLng(target.lat!!, target.lng!!))
            } else null
            val currentKm = (gpsKm ?: reached).coerceIn(reached, target.km)

            val rangeLeft = nav.remainingRangeKm(p, currentKm)
            val nextFuel = nav.nextFuelStop(p)
            val nextFuelText = if (nextFuel != null) {
                val d = (nextFuel.km - currentKm).coerceAtLeast(0.0)
                val ok = d <= rangeLeft
                context.getString(
                    R.string.car_next_fuel, Format.distance(d, units),
                    context.getString(if (ok) R.string.car_margin_ok else R.string.car_low_range),
                )
            } else context.getString(R.string.car_no_fuel)

            // Pontos do mapa: saída (última parada do dia anterior) + paradas do dia.
            // Só usa a chegada do dia anterior se ela tiver coordenadas; outra parada
            // qualquer daria um ponto de saída errado.
            val start = s.trip.days.getOrNull(p.dayIndex - 1)?.stops?.lastOrNull()?.takeIf { it.hasLocation }
            val points = buildList {
                start?.let { add(MapPoint(LatLng(it.lat!!, it.lng!!), StopKind.USER, reached = true, isTarget = false)) }
                day.stops.forEachIndexed { i, st ->
                    if (st.hasLocation) add(MapPoint(LatLng(st.lat!!, st.lng!!), st.kind, i < p.stopIndex, i == p.stopIndex))
                }
            }

            // Veículo: GPS real, ou interpolado entre a última parada e o alvo.
            val vehicle = position ?: run {
                val from = day.stops.getOrNull(p.stopIndex - 1)?.takeIf { it.hasLocation } ?: start
                if (from != null && target.hasLocation) LatLng(from.lat!!, from.lng!!) else null
            }

            val dest = day.stops.last()
            val sunset = Format.sunset(day)
            val destDetail = buildString {
                append(context.getString(R.string.car_arrival_at, dest.time))
                if (sunset != null) append(" · ").append(context.getString(R.string.car_sunset, sunset))
            }

            return NavSnapshot(
                points = points,
                vehiclePos = vehicle,
                rangeLeftKm = rangeLeft,
                rangeTotalKm = nav.usableRangeKm,
                rangeText = context.getString(R.string.car_km_left, Format.distance(rangeLeft, units)),
                nextFuelText = nextFuelText,
                stageLabel = context.getString(R.string.car_next_stage, p.stopIndex + 1, day.stops.size),
                stageName = "${Format.stopEmoji(target)} ${target.name}",
                stageDetail = context.getString(R.string.car_arrival_at, target.time),
                destinationName = "${Format.stopEmoji(dest)} ${dest.name}",
                destinationDetail = destDetail,
                chipRemaining = context.getString(R.string.car_until, Format.distance(day.km - currentKm, units), Format.city(day.to)),
                cue = context.getString(R.string.car_head_to, target.name),
                distanceToTargetKm = (target.km - currentKm).coerceAtLeast(0.0),
                dayRemainingKm = (day.km - currentKm).coerceAtLeast(0.0),
                units = units,
            )
        }
    }
}
