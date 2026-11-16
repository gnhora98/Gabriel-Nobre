package com.viagemestrada.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.viagemestrada.app.R
import com.viagemestrada.app.data.AppState
import com.viagemestrada.app.data.Settings
import com.viagemestrada.app.data.ThemeId
import com.viagemestrada.app.data.TripRepository
import com.viagemestrada.app.data.Units
import com.viagemestrada.app.ui.LocalTripColors
import com.viagemestrada.app.ui.ScreenHeader
import com.viagemestrada.app.ui.SectionLabel
import com.viagemestrada.app.ui.Segmented
import com.viagemestrada.app.ui.themePreview

/** Ajustes: idioma, tema, navegação e unidades. */
@Composable
fun SettingsScreen(state: AppState, repository: TripRepository, onLanguage: (String) -> Unit) {
    val s = state.settings
    fun set(transform: (Settings) -> Settings) = repository.updateSettings(transform)
    var name by remember(s.riderName) { mutableStateOf(s.riderName) }

    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
    ) {
        ScreenHeader(stringResource(R.string.tab_settings), stringResource(R.string.settings_subtitle))

        SectionLabel(stringResource(R.string.language))
        Segmented(listOf("pt" to "Português", "en" to "English", "es" to "Español"), s.language, onLanguage)

        SectionLabel(stringResource(R.string.theme))
        Toggle(stringResource(R.string.vehicle_theme), s.vehicleTheme) { v -> set { it.copy(vehicleTheme = v) } }
        Text(stringResource(R.string.vehicle_theme_hint), color = LocalTripColors.current.muted, fontSize = 12.sp, modifier = Modifier.padding(bottom = 8.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            ThemeId.entries.forEach { id ->
                ThemeTile(id, selected = s.theme == id && !s.autoTheme, Modifier.weight(1f)) {
                    set { it.copy(theme = id, autoTheme = false) }
                }
            }
        }

        SectionLabel(stringResource(R.string.navigation))
        Toggle(stringResource(R.string.voice), s.voice) { v -> set { it.copy(voice = v) } }
        Toggle(stringResource(R.string.sunset_warning), s.sunsetWarning) { v -> set { it.copy(sunsetWarning = v) } }
        Toggle(stringResource(R.string.avoid_dirt), s.avoidDirt) { v -> set { it.copy(avoidDirt = v) } }
        Toggle(stringResource(R.string.auto_theme), s.autoTheme) { v -> set { it.copy(autoTheme = v) } }

        SectionLabel(stringResource(R.string.units))
        Segmented(listOf(Units.KM to "km · L", Units.MI to "mi · gal"), s.units) { u -> set { it.copy(units = u) } }

        SectionLabel(stringResource(R.string.rider_name))
        OutlinedTextField(
            value = name,
            onValueChange = { name = it; if (it.isNotBlank()) set { s2 -> s2.copy(riderName = it.trim()) } },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

@Composable
private fun ThemeTile(id: ThemeId, selected: Boolean, modifier: Modifier, onClick: () -> Unit) {
    val colors = LocalTripColors.current
    val (bg, accent) = themePreview(id)
    val label = stringResource(
        when (id) {
            ThemeId.DARK -> R.string.theme_dark
            ThemeId.LIGHT -> R.string.theme_light
            ThemeId.DESERT -> R.string.theme_desert
            ThemeId.COAST -> R.string.theme_coast
        },
    )
    Box(
        modifier
            .height(64.dp)
            .clip(RoundedCornerShape(10.dp))
            .background(Brush.linearGradient(listOf(bg, accent.copy(alpha = 0.55f))))
            .border(if (selected) 2.dp else 0.dp, if (selected) colors.accent else Color.Transparent, RoundedCornerShape(10.dp))
            .clickable(onClick = onClick)
            .padding(8.dp),
        contentAlignment = Alignment.BottomStart,
    ) {
        Text(
            label, fontSize = 12.sp, fontWeight = FontWeight.Bold,
            color = if (id == ThemeId.LIGHT) Color(0xFF1F2328) else Color.White,
        )
    }
}

@Composable
private fun Toggle(label: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    val colors = LocalTripColors.current
    Row(
        Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp)
            .clip(RoundedCornerShape(10.dp))
            .background(colors.card)
            .clickable { onChange(!checked) }
            .padding(horizontal = 14.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label, Modifier.weight(1f), color = MaterialTheme.colorScheme.onBackground)
        Switch(
            checked = checked, onCheckedChange = onChange,
            colors = SwitchDefaults.colors(checkedTrackColor = colors.done, checkedThumbColor = Color.White),
        )
    }
}
