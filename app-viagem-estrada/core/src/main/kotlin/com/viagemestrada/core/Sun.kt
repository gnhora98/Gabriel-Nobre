package com.viagemestrada.core

import java.time.LocalDate
import kotlin.math.acos
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.tan

/**
 * Horário do pôr do sol, calculado no aparelho (funciona offline).
 * Algoritmo da NOAA (equação do tempo + declinação solar), precisão ~1 min.
 */
object Sun {

    /**
     * Pôr do sol em minutos desde 00:00 no fuso [utcOffsetHours]
     * (Nordeste do Brasil = −3, sem horário de verão). Null em dias sem
     * pôr do sol (regiões polares).
     */
    fun sunsetMinutes(date: LocalDate, lat: Double, lng: Double, utcOffsetHours: Double = -3.0): Int? {
        val gamma = 2 * Math.PI / 365 * (date.dayOfYear - 1)
        val eqTime = 229.18 * (0.000075 + 0.001868 * cos(gamma) - 0.032077 * sin(gamma) -
            0.014615 * cos(2 * gamma) - 0.040849 * sin(2 * gamma))
        val decl = 0.006918 - 0.399912 * cos(gamma) + 0.070257 * sin(gamma) -
            0.006758 * cos(2 * gamma) + 0.000907 * sin(2 * gamma) -
            0.002697 * cos(3 * gamma) + 0.00148 * sin(3 * gamma)
        val latRad = Math.toRadians(lat)
        val cosHa = cos(Math.toRadians(90.833)) / (cos(latRad) * cos(decl)) - tan(latRad) * tan(decl)
        if (cosHa < -1 || cosHa > 1) return null
        val ha = Math.toDegrees(acos(cosHa))
        val sunsetUtc = 720 - 4 * (lng - ha) - eqTime
        return Math.round(sunsetUtc + utcOffsetHours * 60).toInt()
    }
}
