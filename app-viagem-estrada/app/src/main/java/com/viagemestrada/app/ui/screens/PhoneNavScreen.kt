package com.viagemestrada.app.ui.screens

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.viagemestrada.app.R
import com.viagemestrada.app.data.AppState
import com.viagemestrada.app.data.TripRepository
import com.viagemestrada.app.nav.Maneuvers
import com.viagemestrada.app.nav.NavMap
import com.viagemestrada.app.nav.NavigationController
import com.viagemestrada.app.ui.Format
import com.viagemestrada.app.ui.LocalTripColors
import com.viagemestrada.core.RouteStep
import kotlinx.coroutines.delay
import org.maplibre.android.maps.MapView

/**
 * Navegação no celular: o mesmo mapa e a mesma lógica do Android Auto, para
 * testar a viagem sem a multimídia (com GPS real ou em simulação).
 */
@Composable
fun PhoneNavScreen(state: AppState, repository: TripRepository, onClose: () -> Unit) {
    val context = LocalContext.current
    val nav = remember { NavigationController.get(context) }
    val navState by nav.state.collectAsStateWithLifecycle()
    val colors = LocalTripColors.current
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    val density = LocalDensity.current.density
    var navMap by remember { mutableStateOf<NavMap?>(null) }
    var follow by remember { mutableStateOf(true) }
    var toast by remember { mutableStateOf<String?>(null) }

    val mapView = remember {
        MapView(context).apply { onCreate(null); keepScreenOn = true; getMapAsync { m -> NavMap(m, density).also { nm -> nm.load { navMap = nm } } } }
    }
    DisposableEffect(lifecycle) {
        val obs = LifecycleEventObserver { _, e ->
            when (e) {
                Lifecycle.Event.ON_START -> mapView.onStart(); Lifecycle.Event.ON_RESUME -> mapView.onResume()
                Lifecycle.Event.ON_PAUSE -> mapView.onPause(); Lifecycle.Event.ON_STOP -> mapView.onStop()
                else -> Unit
            }
        }
        lifecycle.addObserver(obs)
        if (lifecycle.currentState.isAtLeast(Lifecycle.State.STARTED)) mapView.onStart()
        if (lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED)) mapView.onResume()
        nav.acquireGps()
        onDispose { lifecycle.removeObserver(obs); nav.releaseGps(); mapView.onPause(); mapView.onStop(); mapView.onDestroy() }
    }
    LaunchedEffect(Unit) { nav.events.collect { toast = it; delay(3500); toast = null } }

    val track = nav.track(state)
    LaunchedEffect(navMap, state, navState, follow) {
        val nm = navMap ?: return@LaunchedEffect
        nm.insets = doubleArrayOf(0.0, 160.0 * density, 0.0, 190.0 * density)
        nm.follow = follow
        nm.bind(state, track)
        if (track != null) nm.update(track, navState.meters, navState.speed)
    }

    Box(Modifier.fillMaxSize().background(Color(0xFF141A21))) {
        AndroidView({ mapView }, Modifier.fillMaxSize())

        val units = state.settings.units
        val target = state.navigator.target(state.progress)
        val up = track?.nextStep(navState.meters)
        val st = up?.step ?: target?.let { RouteStep(0.0, "arrive", null, it.name) }
        val dist = up?.distanceMeters ?: (nav.targetMeters(state) - navState.meters).coerceAtLeast(0.0)

        // Cartão de manobra
        if (st != null) {
            Row(
                Modifier.statusBarsPadding().padding(12.dp).fillMaxWidth().clip(RoundedCornerShape(16.dp))
                    .background(Color(0xFF1B5E3A)).padding(14.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                val arrow = remember(st.type, st.modifier) { Maneuvers.arrow(st, 128).asImageBitmap() }
                Image(arrow, null, Modifier.size(56.dp))
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(Maneuvers.distance(dist, units), color = Color.White, fontSize = 30.sp, fontWeight = FontWeight.Bold)
                    Text(Maneuvers.instruction(context, st), color = Color.White, fontSize = 15.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
                }
            }
        }

        toast?.let {
            Text(
                it, Modifier.align(Alignment.Center).clip(RoundedCornerShape(12.dp)).background(Color(0xFFE6EDF3)).padding(horizontal = 18.dp, vertical = 12.dp),
                color = Color(0xFF0D1117), fontWeight = FontWeight.Bold,
            )
        }

        // Painel de baixo
        Column(
            Modifier.align(Alignment.BottomCenter).fillMaxWidth().navigationBarsPadding()
                .padding(12.dp).clip(RoundedCornerShape(18.dp)).background(Color(0xF0161B22)).padding(14.dp),
        ) {
            val km = nav.currentKm(state)
            val day = state.navigator.day(state.progress)
            if (target != null && day != null) {
                Text("${Format.stopEmoji(target)} ${target.name}", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 17.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                val road = track?.roadAt(navState.meters).orEmpty()
                Text(
                    listOfNotNull(
                        Maneuvers.distance(nav.targetMeters(state) - navState.meters, units),
                        stringResource(R.string.car_next_stage, state.progress.stopIndex + 1, day.stops.size),
                        road.ifBlank { null },
                    ).joinToString(" · "),
                    color = Color(0xFF9AA4B0), fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis,
                )
                Text(
                    stringResource(R.string.car_km_left, Format.distance(state.navigator.remainingRangeKm(state.progress, km), units)) +
                        " · " + (if (navState.simulating) stringResource(R.string.sim_on) else stringResource(R.string.gps_on)),
                    color = Color(0xFF9AA4B0), fontSize = 13.sp,
                )
            } else {
                Text(stringResource(R.string.trip_done), color = Color.White, fontWeight = FontWeight.Bold)
            }
            Spacer(Modifier.height(10.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                NavButton(stringResource(if (navState.simulating) R.string.pause else R.string.simulate), colors.accent, colors.onAccent, Modifier.weight(1.2f)) { nav.toggleSimulation() }
                NavButton(stringResource(R.string.speed_x, navState.speed), Color(0xFF262E38), Color.White, Modifier.weight(0.7f)) { nav.cycleSpeed() }
                NavButton(stringResource(R.string.car_skip), Color(0xFF262E38), Color.White, Modifier.weight(1f)) { nav.skip() }
            }
            Spacer(Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                NavButton(stringResource(if (follow) R.string.overview else R.string.follow_map), Color(0xFF262E38), Color.White, Modifier.weight(1f)) {
                    follow = !follow
                    if (!follow) track?.let { navMap?.overview(it) }
                }
                NavButton(stringResource(R.string.close), Color(0xFF262E38), Color.White, Modifier.weight(1f)) { nav.stopSimulation(); onClose() }
            }
        }
    }
}

@Composable
private fun NavButton(label: String, bg: Color, fg: Color, modifier: Modifier, onClick: () -> Unit) {
    Text(
        label,
        modifier.clip(RoundedCornerShape(10.dp)).background(bg).clickable(onClick = onClick).padding(vertical = 12.dp),
        color = fg, fontWeight = FontWeight.Bold, textAlign = androidx.compose.ui.text.style.TextAlign.Center, maxLines = 1,
    )
}
