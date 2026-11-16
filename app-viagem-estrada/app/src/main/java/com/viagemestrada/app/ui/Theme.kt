package com.viagemestrada.app.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.core.graphics.ColorUtils
import com.viagemestrada.app.data.Settings
import com.viagemestrada.app.data.ThemeId
import java.time.LocalTime

/** Cores do app além do Material: as da linha do tempo do roteiro. */
@Immutable
data class TripColors(
    val accent: Color,
    val onAccent: Color,
    val card: Color,
    val muted: Color,
    val fuel: Color = Color(0xFFF5A524),
    val user: Color = Color(0xFF3B8BEB),
    val overnight: Color = Color(0xFFA371F7),
    val done: Color = Color(0xFF2EA043),
    val warning: Color = Color(0xFFE5534B),
)

val LocalTripColors = staticCompositionLocalOf {
    TripColors(Color(0xFFF5A524), Color(0xFF1A1300), Color(0xFF161B22), Color(0xFF8B949E))
}

private data class Palette(val bg: Color, val card: Color, val text: Color, val muted: Color, val accent: Color, val onAccent: Color, val dark: Boolean)

private fun palette(id: ThemeId) = when (id) {
    ThemeId.DARK -> Palette(Color(0xFF0D1117), Color(0xFF161B22), Color(0xFFE6EDF3), Color(0xFF8B949E), Color(0xFFF5A524), Color(0xFF1A1300), true)
    ThemeId.LIGHT -> Palette(Color(0xFFF6F7F9), Color(0xFFFFFFFF), Color(0xFF1F2328), Color(0xFF59636E), Color(0xFFE08A00), Color(0xFFFFFFFF), false)
    ThemeId.DESERT -> Palette(Color(0xFF1E140D), Color(0xFF2E2016), Color(0xFFF3E6D6), Color(0xFFB59C84), Color(0xFFE07A2E), Color(0xFF1E140D), true)
    ThemeId.COAST -> Palette(Color(0xFF0B1E24), Color(0xFF12303A), Color(0xFFE2F3F5), Color(0xFF8FB5BC), Color(0xFF2EC4B6), Color(0xFF062026), true)
}

/** Tema efetivo: o escolhido, ou claro de dia / escuro à noite no modo automático. */
fun effectiveTheme(settings: Settings, now: LocalTime = LocalTime.now()): ThemeId =
    if (settings.autoTheme) {
        if (now.hour in 6..17) ThemeId.LIGHT else ThemeId.DARK
    } else settings.theme

/**
 * Cor de destaque a partir da cor da moto: mantém o tom e ajusta a luminosidade
 * para ficar legível no fundo. Cores neutras (preto/branco) viram prata/grafite.
 */
fun accentFromVehicle(argb: Long, lightBg: Boolean): Pair<Color, Color> {
    val hsl = FloatArray(3)
    ColorUtils.colorToHSL((argb and 0xFFFFFFFF).toInt(), hsl)
    val (h, s, l) = Triple(hsl[0], hsl[1], hsl[2])
    val accent = if (s < 0.14f) {
        Color(if (lightBg) 0xFF4B5563 else if (l < 0.5f) 0xFFC9CFD8 else 0xFFEEF0F3)
    } else {
        val light = if (lightBg) 0.42f else (l + 0.14f).coerceIn(0.52f, 0.62f)
        Color(ColorUtils.HSLToColor(floatArrayOf(h, maxOf(s, 0.62f), light)))
    }
    val onAccent = if (ColorUtils.calculateLuminance(accent.toArgb()) > 0.4) Color(0xFF14171C) else Color.White
    return accent to onAccent
}

@Composable
fun ViagemTheme(themeId: ThemeId, vehicleColor: Long? = null, content: @Composable () -> Unit) {
    val base = palette(themeId)
    val p = if (vehicleColor == null) base else accentFromVehicle(vehicleColor, !base.dark)
        .let { (a, on) -> base.copy(accent = a, onAccent = on) }
    val scheme = if (p.dark) {
        darkColorScheme(
            primary = p.accent, onPrimary = p.onAccent, background = p.bg, onBackground = p.text,
            surface = p.bg, onSurface = p.text, surfaceVariant = p.card, onSurfaceVariant = p.muted,
            surfaceContainer = p.card, secondaryContainer = p.card, onSecondaryContainer = p.text,
        )
    } else {
        lightColorScheme(
            primary = p.accent, onPrimary = p.onAccent, background = p.bg, onBackground = p.text,
            surface = p.bg, onSurface = p.text, surfaceVariant = p.card, onSurfaceVariant = p.muted,
            surfaceContainer = p.card, secondaryContainer = Color(0xFFEDEFF2), onSecondaryContainer = p.text,
        )
    }
    CompositionLocalProvider(LocalTripColors provides TripColors(p.accent, p.onAccent, p.card, p.muted)) {
        MaterialTheme(colorScheme = scheme, content = content)
    }
}

/** Cores de visualização dos temas (miniaturas na tela de Ajustes). */
fun themePreview(id: ThemeId): Pair<Color, Color> = palette(id).let { it.bg to it.accent }
