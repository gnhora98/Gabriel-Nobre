package com.viagemestrada.core

/** Trecho de um dia que passa da autonomia útil sem posto no meio. */
data class FuelGap(val fromKm: Double, val toKm: Double) {
    val legKm: Double get() = toKm - fromKm
}

/** Planejamento de abastecimento com base na autonomia útil. */
object FuelPlanner {

    /**
     * Postos cadastrados no dia cobrem o trajeto? Assume tanque cheio na
     * saída do dia. Retorna os trechos que passam da autonomia útil.
     */
    fun gaps(day: Day, usableRangeKm: Double): List<FuelGap> {
        val marks = buildList {
            add(0.0)
            day.stops.filter { it.isFuel }.forEach { add(it.km) }
            add(day.km)
        }.distinct().sorted()
        return marks.zipWithNext()
            .filter { (a, b) -> b - a > usableRangeKm }
            .map { (a, b) -> FuelGap(a, b) }
    }

    /**
     * Próximo posto: o mais distante ainda alcançável com a autonomia útil
     * e que não passa do fim do trecho. Null se nenhum for alcançável.
     */
    fun nextFuelStop(
        candidates: List<Stop>,
        currentKm: Double,
        usableRangeKm: Double,
        endKm: Double = Double.MAX_VALUE,
    ): Stop? = candidates
        .filter { it.km > currentKm && it.km - currentKm <= usableRangeKm && it.km <= endKm }
        .maxByOrNull { it.km }

    /**
     * Sugere paradas de combustível para ir de [startKm] a [endKm], na ordem
     * do percurso. Para quando não há posto alcançável (o caller avisa o
     * usuário que o trecho está descoberto).
     */
    fun suggest(
        candidates: List<Stop>,
        startKm: Double,
        endKm: Double,
        usableRangeKm: Double,
    ): List<Stop> {
        val picks = mutableListOf<Stop>()
        var current = startKm
        while (endKm - current > usableRangeKm) {
            val stop = nextFuelStop(candidates, current, usableRangeKm, endKm) ?: break
            picks += stop
            current = stop.km
        }
        return picks
    }
}
