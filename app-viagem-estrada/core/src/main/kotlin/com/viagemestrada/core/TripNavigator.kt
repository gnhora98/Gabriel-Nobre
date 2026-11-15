package com.viagemestrada.core

import kotlinx.serialization.Serializable

/**
 * Onde o usuário está na viagem. É salvo no aparelho para retomar no dia
 * seguinte. [stopIndex] aponta para a PRÓXIMA parada (o alvo); as paradas
 * anteriores a ele no mesmo dia já foram alcançadas.
 */
@Serializable
data class TripProgress(
    val dayIndex: Int = 0,
    val stopIndex: Int = 0,
    val done: Boolean = false,
)

/** Regras de navegação entre etapas (avançar, voltar, pular, retomar). */
class TripNavigator(val trip: Trip) {

    val usableRangeKm: Double get() = trip.vehicle.usableRangeKm

    fun day(p: TripProgress): Day? = trip.days.getOrNull(p.dayIndex)

    /** Parada alvo (próxima etapa), ou null se a viagem terminou. */
    fun target(p: TripProgress): Stop? =
        if (p.done) null else day(p)?.stops?.getOrNull(p.stopIndex)

    /** Avança para a próxima parada; troca de dia quando o dia acaba. */
    fun advance(p: TripProgress): TripProgress {
        if (p.done) return p
        val day = day(p) ?: return p.copy(done = true)
        return when {
            p.stopIndex + 1 < day.stops.size -> p.copy(stopIndex = p.stopIndex + 1)
            p.dayIndex + 1 < trip.days.size -> TripProgress(dayIndex = p.dayIndex + 1)
            else -> p.copy(done = true)
        }
    }

    /** Volta uma parada; no início do dia, volta para a última do dia anterior. */
    fun back(p: TripProgress): TripProgress {
        if (p.done) return p.copy(done = false)
        return when {
            p.stopIndex > 0 -> p.copy(stopIndex = p.stopIndex - 1)
            p.dayIndex > 0 -> {
                val prev = trip.days[p.dayIndex - 1]
                TripProgress(dayIndex = p.dayIndex - 1, stopIndex = prev.stops.lastIndex)
            }
            else -> p
        }
    }

    /** Vai direto para uma parada (escolhida na lista de etapas). */
    fun jumpTo(dayIndex: Int, stopIndex: Int): TripProgress {
        val day = trip.days.getOrNull(dayIndex) ?: return TripProgress()
        return TripProgress(dayIndex, stopIndex.coerceIn(0, day.stops.lastIndex))
    }

    /** Km do dia já percorridos (até a última parada alcançada). */
    fun reachedKm(p: TripProgress): Double {
        val day = day(p) ?: return 0.0
        if (p.done) return day.km
        return day.stops.getOrNull(p.stopIndex - 1)?.km ?: 0.0
    }

    /** Km do último abastecimento no dia (0 = saída com tanque cheio). */
    fun lastFuelKm(p: TripProgress): Double {
        val day = day(p) ?: return 0.0
        val reached = if (p.done) day.stops else day.stops.take(p.stopIndex)
        return reached.lastOrNull { it.isFuel }?.km ?: 0.0
    }

    /** Autonomia útil restante, considerando a posição atual no dia. */
    fun remainingRangeKm(p: TripProgress, currentKm: Double = reachedKm(p)): Double =
        (usableRangeKm - (currentKm - lastFuelKm(p))).coerceAtLeast(0.0)

    /** Próximo posto a partir da etapa atual (inclusive). */
    fun nextFuelStop(p: TripProgress): Stop? {
        val day = day(p) ?: return null
        if (p.done) return null
        return day.stops.drop(p.stopIndex).firstOrNull { it.isFuel }
    }

    /** Km que faltam para terminar o dia. */
    fun remainingDayKm(p: TripProgress, currentKm: Double = reachedKm(p)): Double =
        ((day(p)?.km ?: 0.0) - currentKm).coerceAtLeast(0.0)

    /** Destino do dia: a última parada (pernoite ou chegada). */
    fun dayDestination(p: TripProgress): Stop? = day(p)?.stops?.lastOrNull()

    /** Chegou na parada alvo? (dentro de [radiusKm] dela). */
    fun hasArrived(p: TripProgress, position: LatLng, radiusKm: Double = 0.3): Boolean {
        val stop = target(p) ?: return false
        if (!stop.hasLocation) return false
        return Geo.distanceKm(position, LatLng(stop.lat!!, stop.lng!!)) <= radiusKm
    }
}
