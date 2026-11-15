package com.viagemestrada.app.ui

import androidx.annotation.StringRes
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.viagemestrada.app.R
import com.viagemestrada.app.data.TripRepository
import com.viagemestrada.app.ui.screens.GarageScreen
import com.viagemestrada.app.ui.screens.RouteScreen
import com.viagemestrada.app.ui.screens.SettingsScreen
import com.viagemestrada.app.ui.screens.TripsScreen

enum class Tab(@param:StringRes val label: Int, val icon: String) {
    TRIPS(R.string.tab_trips, "🧭"),
    ROUTE(R.string.tab_route, "🗺"),
    GARAGE(R.string.tab_garage, "🏍"),
    SETTINGS(R.string.tab_settings, "⚙"),
}

/** App do celular: abas Viagens · Roteiro · Garagem · Ajustes. */
@Composable
fun PhoneApp(repository: TripRepository, onLanguage: (String) -> Unit, initialTab: Tab = Tab.TRIPS) {
    val state by repository.state.collectAsStateWithLifecycle()
    var tab by rememberSaveable { mutableStateOf(initialTab) }

    ViagemTheme(effectiveTheme(state.settings)) {
        Column(
            Modifier
                .fillMaxSize()
                .background(MaterialTheme.colorScheme.background)
                .statusBarsPadding()
                .navigationBarsPadding(),
        ) {
            Box(Modifier.weight(1f).fillMaxWidth()) {
                when (tab) {
                    Tab.TRIPS -> TripsScreen(state, repository, onOpenRoute = { tab = Tab.ROUTE })
                    Tab.ROUTE -> RouteScreen(state, repository)
                    Tab.GARAGE -> GarageScreen(state, repository)
                    Tab.SETTINGS -> SettingsScreen(state, repository, onLanguage)
                }
            }
            BottomBar(tab) { tab = it }
        }
    }
}

@Composable
private fun BottomBar(selected: Tab, onSelect: (Tab) -> Unit) {
    val colors = LocalTripColors.current
    Row(
        Modifier
            .fillMaxWidth()
            .background(colors.card)
            .padding(vertical = 8.dp),
    ) {
        Tab.entries.forEach { tab ->
            val active = tab == selected
            Column(
                Modifier
                    .weight(1f)
                    .clickable { onSelect(tab) }
                    .padding(vertical = 4.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(tab.icon, fontSize = 20.sp)
                Text(
                    stringResource(tab.label),
                    fontSize = 12.sp,
                    color = if (active) colors.accent else colors.muted,
                    fontWeight = if (active) FontWeight.Bold else FontWeight.Normal,
                )
            }
        }
    }
}
