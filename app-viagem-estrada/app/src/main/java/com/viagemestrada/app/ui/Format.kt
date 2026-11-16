package com.viagemestrada.app.ui

import android.content.Context
import com.viagemestrada.app.R
import com.viagemestrada.app.data.Units
import com.viagemestrada.core.Day
import com.viagemestrada.core.Stop
import com.viagemestrada.core.StopKind
import com.viagemestrada.core.Sun
import com.viagemestrada.core.Geo
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.roundToInt

/** Formatação compartilhada entre celular e carro. */
object Format {
    private const val KM_PER_MI = 1.609344

    fun distance(km: Double, units: Units): String {
        val v = if (units == Units.KM) km else km / KM_PER_MI
        val unit = if (units == Units.KM) "km" else "mi"
        return when {
            units == Units.KM && v < 1 -> "${(km * 1000 / 10).roundToInt() * 10} m"
            v < 10 -> String.format(Locale.forLanguageTag("pt-BR"), "%.1f %s", v, unit)
            else -> "%,d %s".format(Locale.getDefault(), v.roundToInt(), unit).replace(',', '.')
        }
    }

    fun consumption(kmPerLiter: Double, units: Units): String = when (units) {
        Units.KM -> "%.1f km/l".format(Locale.getDefault(), kmPerLiter)
        // mi/gal (US): 1 km/l = 2,352 mpg
        Units.MI -> "%.1f mpg".format(Locale.getDefault(), kmPerLiter * 2.352)
    }

    /** "TER 29/12" no idioma atual. */
    fun dayLabel(day: Day, locale: Locale = Locale.getDefault()): String =
        runCatching {
            LocalDate.parse(day.date)
                .format(DateTimeFormatter.ofPattern("EEE dd/MM", locale))
                .replace(".", "")
                .uppercase(locale)
        }.getOrDefault(day.date)

    /** Cidade sem o estado: "Fortaleza, CE" → "Fortaleza". */
    fun city(place: String): String = place.split(",").first().trim()

    /** Pôr do sol no destino do dia (usa a última parada com coordenadas). */
    fun sunset(day: Day): String? {
        val ref = day.stops.lastOrNull { it.hasLocation } ?: return null
        val date = runCatching { LocalDate.parse(day.date) }.getOrNull() ?: return null
        val min = Sun.sunsetMinutes(date, ref.lat!!, ref.lng!!) ?: return null
        return Geo.minutesToTime(min)
    }

    fun stopEmoji(stop: Stop): String = when (stop.kind) {
        StopKind.FUEL, StopKind.FUEL_OPTIONAL -> "⛽"
        StopKind.MEAL_FUEL -> "🍽"
        StopKind.OVERNIGHT -> "🛏"
        StopKind.ARRIVAL -> "🏁"
        StopKind.USER -> "📍"
    }

    fun stopKindLabel(context: Context, kind: StopKind): String = context.getString(
        when (kind) {
            StopKind.FUEL -> R.string.type_fuel
            StopKind.MEAL_FUEL -> R.string.type_meal_fuel
            StopKind.FUEL_OPTIONAL -> R.string.type_fuel_optional
            StopKind.OVERNIGHT -> R.string.type_overnight
            StopKind.ARRIVAL -> R.string.type_arrival
            StopKind.USER -> R.string.type_user
        },
    )

    /** Valor gravado no JSON para cada tipo (inverso de StopKind.fromType). */
    fun typeValue(kind: StopKind): String = when (kind) {
        StopKind.FUEL -> "abastecer"
        StopKind.MEAL_FUEL -> "almoco_abastecer"
        StopKind.FUEL_OPTIONAL -> "abastecer_opcional"
        StopKind.OVERNIGHT -> "pernoite"
        StopKind.ARRIVAL -> "chegada"
        StopKind.USER -> "parada"
    }

    fun greeting(context: Context, name: String, hour: Int): String = context.getString(
        when (hour) {
            in 5..11 -> R.string.greeting_morning
            in 12..17 -> R.string.greeting_afternoon
            else -> R.string.greeting_evening
        },
        name,
    )
}
