package com.viagemestrada.core

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/** Viagem completa, no formato de `dados/viagem-exemplo.json`. */
@Serializable
data class Trip(
    val id: String = "",
    @SerialName("nome") val name: String,
    @SerialName("veiculo") val vehicle: Vehicle,
    @SerialName("regras") val rules: Rules = Rules(),
    @SerialName("dias") val days: List<Day>,
) {
    val totalKm: Double get() = days.sumOf { it.km }

    companion object {
        private val json = Json { ignoreUnknownKeys = true }
        fun fromJson(text: String): Trip = json.decodeFromString(serializer(), text)
    }
}

@Serializable
data class Vehicle(
    @SerialName("modelo") val model: String,
    @SerialName("cor") val color: String = "",
    @SerialName("autonomia_km") val rangeKm: Double,
    @SerialName("margem_seguranca_pct") val safetyMarginPct: Double,
    @SerialName("consumo_km_l") val kmPerLiter: Double? = null,
    @SerialName("garupa") val pillion: Boolean = false,
) {
    /** Autonomia útil = autonomia × (1 − margem). Ex.: 200 km e 30% → 140 km. */
    val usableRangeKm: Double get() = rangeKm * (1 - safetyMarginPct / 100.0)
}

@Serializable
data class Rules(
    @SerialName("nao_rodar_apos") val noRidingAfter: String? = null,
    @SerialName("intervalo_abastecimento_km") val fuelIntervalKm: Double? = null,
)

@Serializable
data class Day(
    @SerialName("data") val date: String,
    @SerialName("de") val from: String,
    @SerialName("para") val to: String,
    val km: Double,
    @SerialName("saida") val departure: String,
    @SerialName("chegada") val arrival: String,
    @SerialName("tipo_dia") val dayType: String = "",
    @SerialName("paradas") val stops: List<Stop>,
)

@Serializable
data class Stop(
    @SerialName("hora") val time: String,
    val km: Double,
    @SerialName("nome") val name: String,
    @SerialName("tipo") val type: String,
    val lat: Double? = null,
    val lng: Double? = null,
    val obs: String? = null,
) {
    val kind: StopKind get() = StopKind.fromType(type)
    val isFuel: Boolean get() = kind.refuels
    val hasLocation: Boolean get() = lat != null && lng != null
}

/** Tipo de parada. Define cor na linha do tempo e se reabastece. */
enum class StopKind(val refuels: Boolean) {
    FUEL(true),
    MEAL_FUEL(true),
    FUEL_OPTIONAL(true),
    OVERNIGHT(false),
    ARRIVAL(false),
    USER(false);

    companion object {
        fun fromType(type: String): StopKind = when (type) {
            "abastecer" -> FUEL
            "almoco_abastecer" -> MEAL_FUEL
            "abastecer_opcional" -> FUEL_OPTIONAL
            "pernoite" -> OVERNIGHT
            "chegada", "chegada_casa" -> ARRIVAL
            else -> USER
        }
    }
}
