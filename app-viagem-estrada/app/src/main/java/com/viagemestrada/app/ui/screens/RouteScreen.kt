package com.viagemestrada.app.ui.screens

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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.viagemestrada.app.R
import com.viagemestrada.app.data.AppState
import com.viagemestrada.app.data.TripRepository
import com.viagemestrada.app.ui.Card
import com.viagemestrada.app.ui.Format
import com.viagemestrada.app.ui.LocalTripColors
import com.viagemestrada.app.ui.ScreenHeader
import com.viagemestrada.app.ui.TripColors
import com.viagemestrada.core.FuelPlanner
import com.viagemestrada.core.Stop
import com.viagemestrada.core.StopKind

/**
 * Roteiro: linha do tempo do dia com postos (laranja), paradas do usuário
 * (azul) e pernoite (roxo). Voltar / Editar / Avançar mexem na etapa atual.
 */
@Composable
fun RouteScreen(state: AppState, repository: TripRepository) {
    val colors = LocalTripColors.current
    val trip = state.trip
    val nav = state.navigator
    val p = state.progress
    val units = state.settings.units

    // Dia exibido: começa no dia atual da viagem, mas dá para navegar.
    var shownDay by rememberSaveable { mutableIntStateOf(p.dayIndex.coerceIn(0, trip.days.lastIndex)) }
    LaunchedEffect(p.dayIndex) { shownDay = p.dayIndex.coerceIn(0, trip.days.lastIndex) }
    val day = trip.days[shownDay]

    var editing by remember { mutableStateOf<EditTarget?>(null) }
    var actionsFor by remember { mutableStateOf<Int?>(null) }

    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
    ) {
        ScreenHeader(
            stringResource(R.string.tab_route),
            stringResource(
                R.string.route_subtitle, trip.name, pluralStringResource(R.plurals.days_count, trip.days.size, trip.days.size), Format.distance(trip.totalKm, units),
            ),
        )

        // Seletor de dia.
        Row(verticalAlignment = Alignment.CenterVertically) {
            DayArrow("◀", enabled = shownDay > 0) { shownDay-- }
            Text(
                stringResource(
                    R.string.day_header, shownDay + 1, Format.dayLabel(day),
                    Format.city(day.from), Format.city(day.to),
                ),
                modifier = Modifier.weight(1f),
                color = colors.accent, fontWeight = FontWeight.Bold, fontSize = 13.sp,
                textAlign = TextAlign.Center,
            )
            DayArrow("▶", enabled = shownDay < trip.days.lastIndex) { shownDay++ }
        }
        Text(
            stringResource(
                R.string.day_times, day.departure, day.arrival, Format.distance(day.km, units),
            ),
            color = colors.muted, fontSize = 13.sp,
            modifier = Modifier.fillMaxWidth().padding(top = 2.dp, bottom = 8.dp),
            textAlign = TextAlign.Center,
        )

        // Aviso: trecho sem posto dentro da autonomia útil.
        val range = state.garage.usableRangeKm
        FuelPlanner.gaps(day, range).forEach { gap ->
            Text(
                "⚠ " + stringResource(
                    R.string.gap_warning,
                    Format.distance(gap.fromKm, units), Format.distance(gap.toKm, units),
                    Format.distance(gap.legKm, units), Format.distance(range, units),
                ),
                color = colors.warning, fontSize = 13.sp,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 8.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(colors.warning.copy(alpha = 0.12f))
                    .padding(10.dp),
            )
        }

        // Linha do tempo.
        Card {
            Row(Modifier.padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                Dot(colors.done)
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(stringResource(R.string.departure_from, Format.city(day.from)), color = MaterialTheme.colorScheme.onBackground)
                    Text(day.departure, color = colors.muted, fontSize = 12.sp)
                }
            }
            day.stops.forEachIndexed { i, stop ->
                HorizontalDivider(color = colors.muted.copy(alpha = 0.15f))
                val isCurrent = !p.done && p.dayIndex == shownDay && p.stopIndex == i
                val reached = p.done || shownDay < p.dayIndex || (shownDay == p.dayIndex && i < p.stopIndex)
                StopRow(stop, colors, isCurrent, reached, units = state.settings.units) { actionsFor = i }
            }
        }

        Spacer(Modifier.height(12.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            ActionButton(stringResource(R.string.back), Modifier.weight(1f)) { repository.back() }
            ActionButton(stringResource(R.string.edit), Modifier.weight(1f)) {
                val idx = if (p.dayIndex == shownDay) p.stopIndex else 0
                editing = EditTarget(shownDay, idx.coerceIn(0, day.stops.lastIndex))
            }
            ActionButton(stringResource(R.string.advance), Modifier.weight(1f), primary = true) { repository.advance() }
        }
        Spacer(Modifier.height(8.dp))
        ActionButton(stringResource(R.string.add_stop), Modifier.fillMaxWidth()) {
            editing = EditTarget(shownDay, null)
        }

        Spacer(Modifier.height(12.dp))
        Card {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(stringResource(R.string.offline_maps), Modifier.weight(1f), color = MaterialTheme.colorScheme.onBackground)
                Text(stringResource(R.string.offline_maps_pending), color = colors.muted, fontSize = 13.sp)
            }
            Text(stringResource(R.string.offline_data_ready), color = colors.done, fontSize = 13.sp, modifier = Modifier.padding(top = 4.dp))
        }
    }

    actionsFor?.let { i ->
        StopActionsDialog(
            stop = day.stops[i],
            onDismiss = { actionsFor = null },
            onSetCurrent = { repository.jumpTo(shownDay, i); actionsFor = null },
            onEdit = { editing = EditTarget(shownDay, i); actionsFor = null },
        )
    }

    editing?.let { target ->
        val original = target.stopIndex?.let { trip.days[target.dayIndex].stops.getOrNull(it) }
        StopEditDialog(
            original = original,
            onDismiss = { editing = null },
            onSave = { repository.saveStop(target.dayIndex, target.stopIndex, it); editing = null },
            onDelete = target.stopIndex?.let { idx -> { repository.deleteStop(target.dayIndex, idx); editing = null } },
        )
    }
}

private data class EditTarget(val dayIndex: Int, val stopIndex: Int?)

fun kindColor(kind: StopKind, colors: TripColors): Color = when (kind) {
    StopKind.FUEL, StopKind.FUEL_OPTIONAL -> colors.fuel
    StopKind.MEAL_FUEL, StopKind.USER -> colors.user
    StopKind.OVERNIGHT, StopKind.ARRIVAL -> colors.overnight
}

@Composable
private fun StopRow(
    stop: Stop,
    colors: TripColors,
    isCurrent: Boolean,
    reached: Boolean,
    units: com.viagemestrada.app.data.Units,
    onClick: () -> Unit,
) {
    val km = Format.distance(stop.km, units)
    val subtitle = when (stop.kind) {
        StopKind.FUEL, StopKind.FUEL_OPTIONAL -> stringResource(R.string.stop_suggested, km)
        StopKind.MEAL_FUEL, StopKind.USER -> stringResource(R.string.stop_user, km)
        StopKind.OVERNIGHT -> stringResource(R.string.stop_overnight, km)
        StopKind.ARRIVAL -> stringResource(R.string.stop_arrival, km)
    }
    Row(
        Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Dot(if (reached) colors.done else kindColor(stop.kind, colors))
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(
                "${Format.stopEmoji(stop)} ${stop.name}",
                color = MaterialTheme.colorScheme.onBackground,
                fontWeight = if (isCurrent) FontWeight.Bold else FontWeight.Normal,
                fontSize = 15.sp,
            )
            Text("$subtitle · ${stop.time}", color = colors.muted, fontSize = 12.sp)
        }
        when {
            isCurrent -> Text(stringResource(R.string.stop_current), color = colors.accent, fontSize = 12.sp, fontWeight = FontWeight.Bold)
            reached -> Text("✓", color = colors.done)
            else -> Text("⋮", color = colors.muted)
        }
    }
}

@Composable
private fun Dot(color: Color) {
    Box(Modifier.size(14.dp).clip(CircleShape).background(color))
}

@Composable
private fun DayArrow(symbol: String, enabled: Boolean, onClick: () -> Unit) {
    val colors = LocalTripColors.current
    Text(
        symbol,
        modifier = Modifier
            .clip(CircleShape)
            .clickable(enabled = enabled, onClick = onClick)
            .padding(12.dp),
        color = if (enabled) colors.accent else colors.muted.copy(alpha = 0.3f),
    )
}

@Composable
fun ActionButton(label: String, modifier: Modifier = Modifier, primary: Boolean = false, onClick: () -> Unit) {
    val colors = LocalTripColors.current
    Text(
        label,
        modifier = modifier
            .clip(RoundedCornerShape(10.dp))
            .background(if (primary) colors.accent else colors.card)
            .clickable(onClick = onClick)
            .padding(vertical = 12.dp),
        color = if (primary) colors.onAccent else MaterialTheme.colorScheme.onBackground,
        fontWeight = FontWeight.Bold,
        textAlign = TextAlign.Center,
    )
}
