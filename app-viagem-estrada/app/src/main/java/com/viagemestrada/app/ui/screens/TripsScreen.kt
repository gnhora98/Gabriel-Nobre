package com.viagemestrada.app.ui.screens

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.viagemestrada.app.R
import com.viagemestrada.app.data.AppState
import com.viagemestrada.app.data.TripRepository
import com.viagemestrada.app.ui.Card
import com.viagemestrada.app.ui.Format
import com.viagemestrada.app.ui.LocalTripColors
import com.viagemestrada.app.ui.ScreenHeader
import com.viagemestrada.app.ui.SectionLabel
import com.viagemestrada.app.ui.VehicleArt
import com.viagemestrada.app.ui.VehicleArt.argb

/** Viagens: a viagem atual com o atalho para continuar de onde parou. */
@Composable
fun TripsScreen(state: AppState, repository: TripRepository, onOpenRoute: () -> Unit) {
    val colors = LocalTripColors.current
    val trip = state.trip
    val nav = state.navigator
    val p = state.progress
    val day = nav.day(p)
    var confirmRestart by remember { mutableStateOf(false) }
    val units = state.settings.units

    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
    ) {
        ScreenHeader(stringResource(R.string.tab_trips))

        val art = remember(state.garage.model, state.garage.colorArgb) {
            VehicleArt.bitmap(state.garage.model, state.garage.colorArgb.argb(), 720, 400).asImageBitmap()
        }
        Image(art, contentDescription = null, modifier = Modifier.fillMaxWidth().height(180.dp))

        Card {
            Text(trip.name, fontSize = 20.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onBackground)
            Text(
                stringResource(R.string.trip_summary, trip.days.size, Format.distance(trip.totalKm, units)),
                color = colors.muted,
            )
            Spacer(Modifier.height(12.dp))
            if (p.done || day == null) {
                Text(stringResource(R.string.trip_done), color = colors.done, fontWeight = FontWeight.Bold)
            } else {
                Text(
                    stringResource(R.string.continue_trip_day, p.dayIndex + 1, trip.days.size),
                    fontSize = 12.sp, letterSpacing = 1.sp, color = colors.muted,
                )
                Text(
                    "${Format.city(day.from)} → ${Format.city(day.to)}",
                    fontSize = 18.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onBackground,
                )
                nav.target(p)?.let { stop ->
                    val toGo = (stop.km - nav.reachedKm(p)).coerceAtLeast(0.0)
                    Text(
                        stringResource(
                            R.string.next_stop_summary,
                            Format.distance(day.km, units), stop.name, Format.distance(toGo, units),
                        ),
                        color = colors.muted,
                    )
                }
            }
            Spacer(Modifier.height(14.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Button(
                    onClick = onOpenRoute,
                    colors = ButtonDefaults.buttonColors(containerColor = colors.accent, contentColor = colors.onAccent),
                ) { Text(stringResource(R.string.open_route), fontWeight = FontWeight.Bold) }
                OutlinedButton(onClick = { confirmRestart = true }) {
                    Text(stringResource(R.string.restart_trip), color = MaterialTheme.colorScheme.onBackground)
                }
            }
        }

        SectionLabel(stringResource(R.string.android_auto))
        Card {
            Text(stringResource(R.string.android_auto_hint), color = colors.muted, fontSize = 14.sp)
        }
    }

    if (confirmRestart) {
        AlertDialog(
            onDismissRequest = { confirmRestart = false },
            title = { Text(stringResource(R.string.restart_confirm)) },
            confirmButton = {
                TextButton(onClick = { repository.restart(); confirmRestart = false }) {
                    Text(stringResource(R.string.restart_trip))
                }
            },
            dismissButton = {
                TextButton(onClick = { confirmRestart = false }) { Text(stringResource(R.string.cancel)) }
            },
        )
    }
}
