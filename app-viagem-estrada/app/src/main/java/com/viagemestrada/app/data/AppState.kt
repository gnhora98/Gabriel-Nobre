package com.viagemestrada.app.data

import com.viagemestrada.core.Trip
import com.viagemestrada.core.TripNavigator
import com.viagemestrada.core.TripProgress
import kotlinx.serialization.Serializable

/** Veículos da garagem. Modelos genéricos + a Meteor 650 do Gabriel. */
enum class VehicleModel(val isMoto: Boolean) {
    METEOR(true), CUSTOM(true), TRAIL(true), HATCH(false), SEDAN(false), SUV(false)
}

enum class ThemeId { DARK, LIGHT, DESERT, COAST }
enum class Units { KM, MI }

@Serializable
data class Garage(
    val model: VehicleModel = VehicleModel.METEOR,
    val colorArgb: Long = 0xFFB3261E,
    val rangeKm: Double = 200.0,
    val marginPct: Double = 30.0,
    val kmPerLiter: Double = 21.5,
) {
    val usableRangeKm: Double get() = rangeKm * (1 - marginPct / 100.0)
}

@Serializable
data class Settings(
    val language: String = "pt",
    val theme: ThemeId = ThemeId.DARK,
    val voice: Boolean = true,
    val sunsetWarning: Boolean = true,
    val avoidDirt: Boolean = true,
    val autoTheme: Boolean = false,
    val units: Units = Units.KM,
    val riderName: String = "Gabriel",
)

/** Tudo que o app guarda no aparelho. Celular e carro leem o mesmo estado. */
@Serializable
data class AppState(
    val trip: Trip,
    val progress: TripProgress = TripProgress(),
    val garage: Garage = Garage(),
    val settings: Settings = Settings(),
) {
    /** A viagem com autonomia/margem da garagem aplicadas. */
    val effectiveTrip: Trip
        get() = trip.copy(
            vehicle = trip.vehicle.copy(
                rangeKm = garage.rangeKm,
                safetyMarginPct = garage.marginPct,
                kmPerLiter = garage.kmPerLiter,
            ),
        )

    val navigator: TripNavigator get() = TripNavigator(effectiveTrip)
}
