package com.viagemestrada.app.car

import androidx.car.app.CarContext
import androidx.car.app.Screen
import androidx.car.app.model.Action
import androidx.car.app.model.CarColor
import androidx.car.app.model.CarIcon
import androidx.car.app.model.Pane
import androidx.car.app.model.PaneTemplate
import androidx.car.app.model.Row
import androidx.car.app.model.Template
import androidx.compose.ui.graphics.toArgb
import androidx.core.graphics.drawable.IconCompat
import androidx.lifecycle.lifecycleScope
import com.viagemestrada.app.R
import com.viagemestrada.app.data.TripRepository
import com.viagemestrada.app.ui.Format
import com.viagemestrada.app.ui.VehicleArt
import com.viagemestrada.app.ui.VehicleArt.argb
import kotlinx.coroutines.flow.drop
import kotlinx.coroutines.launch
import java.time.LocalTime

/**
 * Tela ao conectar: foto do veículo, saudação e um botão só —
 * "▶ Seguir viagem" retoma de onde parou.
 */
class WelcomeScreen(carContext: CarContext) : Screen(carContext) {

    private val repository = TripRepository.get(carContext)

    init {
        lifecycleScope.launch { repository.state.drop(1).collect { invalidate() } }
    }

    // setTitle/setHeaderAction: obsoletos na 1.7, mas funcionam em multimídias antigas.
    @Suppress("DEPRECATION")
    override fun onGetTemplate(): Template {
        val s = repository.current
        val nav = s.navigator
        val p = s.progress
        val day = nav.day(p)
        val units = s.settings.units
        val pane = Pane.Builder()

        if (p.done || day == null) {
            pane.addRow(Row.Builder().setTitle(carContext.getString(R.string.trip_done)).build())
            pane.addAction(
                Action.Builder()
                    .setTitle(carContext.getString(R.string.restart_trip))
                    .setOnClickListener { repository.restart() }
                    .build(),
            )
        } else {
            pane.addRow(
                Row.Builder()
                    .setTitle(carContext.getString(R.string.continue_trip_day, p.dayIndex + 1, s.trip.days.size))
                    .addText("${Format.city(day.from)} → ${Format.city(day.to)}")
                    .build(),
            )
            nav.target(p)?.let { stop ->
                val toGo = (stop.km - nav.reachedKm(p)).coerceAtLeast(0.0)
                pane.addRow(
                    Row.Builder()
                        .setTitle(
                            carContext.getString(
                                R.string.next_stop_summary,
                                Format.distance(day.km, units), stop.name, Format.distance(toGo, units),
                            ),
                        )
                        .build(),
                )
            }
            val follow = Action.Builder()
                .setTitle(carContext.getString(R.string.follow_trip))
                .setBackgroundColor(accentFor(s).let { CarColor.createCustom(it, it) })
                .setOnClickListener { screenManager.push(NavScreen(carContext)) }
            if (carContext.carAppApiLevel >= 4) follow.setFlags(Action.FLAG_PRIMARY)
            pane.addAction(follow.build())
            pane.addAction(
                Action.Builder()
                    .setTitle(carContext.getString(R.string.stages))
                    .setOnClickListener { screenManager.push(StagesScreen(carContext)) }
                    .build(),
            )
        }

        // Imagem do veículo escolhido na garagem (Car API 4+).
        if (carContext.carAppApiLevel >= 4) {
            val bmp = VehicleArt.bitmap(s.garage.model, s.garage.colorArgb.argb(), 640, 400)
            pane.setImage(CarIcon.Builder(IconCompat.createWithBitmap(bmp)).build())
        }

        return PaneTemplate.Builder(pane.build())
            .setHeaderAction(Action.APP_ICON)
            .setTitle(Format.greeting(carContext, s.settings.riderName, LocalTime.now().hour))
            .build()
    }

    companion object {
        const val ACCENT = 0xFFF5A524.toInt()

        /** Destaque do Android Auto: cor da moto (se ativado nos Ajustes) ou laranja padrão. */
        fun accentFor(s: com.viagemestrada.app.data.AppState): Int =
            if (s.settings.vehicleTheme) {
                com.viagemestrada.app.ui.accentFromVehicle(s.garage.colorArgb, lightBg = false).first.toArgb()
            } else ACCENT
    }
}
