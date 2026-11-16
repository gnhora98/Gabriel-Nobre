package com.viagemestrada.app.ui.screens

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.viagemestrada.app.R
import com.viagemestrada.app.data.AppState
import com.viagemestrada.app.data.TripRepository
import com.viagemestrada.app.data.VehicleModel
import com.viagemestrada.app.ui.Chip
import com.viagemestrada.app.ui.Format
import com.viagemestrada.app.ui.LocalTripColors
import com.viagemestrada.app.ui.ScreenHeader
import com.viagemestrada.app.ui.VehicleArt
import com.viagemestrada.app.ui.VehicleArt.argb

/** Garagem: veículo (arrastar para girar), modelo, cor e dados de autonomia. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun GarageScreen(state: AppState, repository: TripRepository) {
    val colors = LocalTripColors.current
    val garage = state.garage
    val units = state.settings.units
    var rotation by remember { mutableFloatStateOf(0f) }

    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
    ) {
        ScreenHeader(stringResource(R.string.tab_garage), stringResource(R.string.garage_subtitle))

        // Visualizador: arrastar na horizontal gira o veículo.
        Box(
            Modifier
                .fillMaxWidth()
                .height(220.dp)
                .clip(RoundedCornerShape(16.dp))
                .background(colors.card)
                .pointerInput(Unit) {
                    detectHorizontalDragGestures { _, dx -> rotation = (rotation + dx * 0.6f) % 360f }
                },
            contentAlignment = Alignment.Center,
        ) {
            val art = remember(garage.model, garage.colorArgb, rotation.toInt() / 3) {
                VehicleArt.bitmap(garage.model, garage.colorArgb.argb(), 720, 400, rotation).asImageBitmap()
            }
            Image(art, contentDescription = null, modifier = Modifier.fillMaxSize().padding(12.dp))
            Text(
                stringResource(R.string.drag_to_rotate),
                color = colors.muted, fontSize = 12.sp,
                modifier = Modifier.align(Alignment.BottomCenter).padding(8.dp),
            )
        }

        FlowRow(
            Modifier.padding(top = 14.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            VehicleModel.entries.forEach { m ->
                Chip(stringResource(modelLabel(m)), selected = m == garage.model) {
                    repository.updateGarage { it.copy(model = m) }
                }
            }
        }

        Row(Modifier.padding(vertical = 16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            VehicleArt.palette.forEach { c ->
                val selected = c == garage.colorArgb
                Box(
                    Modifier
                        .size(30.dp)
                        .clip(CircleShape)
                        .background(Color(c.argb()))
                        .border(if (selected) 3.dp else 1.dp, if (selected) colors.accent else colors.muted.copy(alpha = 0.4f), CircleShape)
                        .clickable { repository.updateGarage { it.copy(colorArgb = c) } },
                )
            }
        }

        Stepper(
            stringResource(R.string.range), Format.distance(garage.rangeKm, units),
            onMinus = { repository.updateGarage { it.copy(rangeKm = (it.rangeKm - 10).coerceAtLeast(50.0)) } },
            onPlus = { repository.updateGarage { it.copy(rangeKm = (it.rangeKm + 10).coerceAtMost(1500.0)) } },
        )
        Stepper(
            stringResource(R.string.margin), "%.0f%%".format(garage.marginPct),
            onMinus = { repository.updateGarage { it.copy(marginPct = (it.marginPct - 5).coerceAtLeast(0.0)) } },
            onPlus = { repository.updateGarage { it.copy(marginPct = (it.marginPct + 5).coerceAtMost(60.0)) } },
        )
        Stepper(
            stringResource(R.string.consumption), Format.consumption(garage.kmPerLiter, units),
            onMinus = { repository.updateGarage { it.copy(kmPerLiter = (it.kmPerLiter - 0.5).coerceAtLeast(3.0)) } },
            onPlus = { repository.updateGarage { it.copy(kmPerLiter = (it.kmPerLiter + 0.5).coerceAtMost(60.0)) } },
        )
        Text(
            stringResource(R.string.usable_range_hint, Format.distance(garage.usableRangeKm, units)),
            color = colors.muted, fontSize = 13.sp, modifier = Modifier.padding(top = 8.dp),
        )
    }
}

fun modelLabel(m: VehicleModel): Int = when (m) {
    VehicleModel.METEOR -> R.string.vehicle_meteor
    VehicleModel.CUSTOM -> R.string.vehicle_custom
    VehicleModel.TRAIL -> R.string.vehicle_trail
    VehicleModel.HATCH -> R.string.vehicle_hatch
    VehicleModel.SEDAN -> R.string.vehicle_sedan
    VehicleModel.SUV -> R.string.vehicle_suv
}

@Composable
private fun Stepper(label: String, value: String, onMinus: () -> Unit, onPlus: () -> Unit) {
    val colors = LocalTripColors.current
    Row(
        Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp)
            .clip(RoundedCornerShape(10.dp))
            .background(colors.card)
            .padding(horizontal = 14.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label, Modifier.weight(1f), color = MaterialTheme.colorScheme.onBackground)
        StepButton("−", onMinus)
        Text(value, color = colors.accent, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 10.dp))
        StepButton("+", onPlus)
    }
}

@Composable
private fun StepButton(symbol: String, onClick: () -> Unit) {
    Text(
        symbol,
        modifier = Modifier
            .clip(CircleShape)
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 6.dp),
        color = MaterialTheme.colorScheme.onBackground,
        fontSize = 20.sp,
    )
}
