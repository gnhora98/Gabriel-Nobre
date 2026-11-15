package com.viagemestrada.app.car

import androidx.car.app.CarContext
import androidx.car.app.Screen
import androidx.car.app.model.Action
import androidx.car.app.model.ItemList
import androidx.car.app.model.ListTemplate
import androidx.car.app.model.Row
import androidx.car.app.model.Template
import com.viagemestrada.app.R
import com.viagemestrada.app.data.TripRepository
import com.viagemestrada.app.ui.Format

/** Etapas do dia atual. Tocar numa etapa a define como a próxima. */
class StagesScreen(carContext: CarContext) : Screen(carContext) {

    private val repository = TripRepository.get(carContext)

    // setTitle/setHeaderAction: obsoletos na 1.7, mas funcionam em multimídias antigas.
    @Suppress("DEPRECATION")
    override fun onGetTemplate(): Template {
        val s = repository.current
        val p = s.progress
        val day = s.navigator.day(p)
        val list = ItemList.Builder()
        day?.stops?.forEachIndexed { i, stop ->
            val status = when {
                p.done || i < p.stopIndex -> "✓ "
                i == p.stopIndex -> "▶ "
                else -> ""
            }
            list.addItem(
                Row.Builder()
                    .setTitle("$status${Format.stopEmoji(stop)} ${stop.name}")
                    .addText("${stop.time} · ${Format.distance(stop.km, s.settings.units)}")
                    .setOnClickListener {
                        repository.jumpTo(p.dayIndex, i)
                        screenManager.pop()
                    }
                    .build(),
            )
        }
        if (day == null) {
            list.setNoItemsMessage(carContext.getString(R.string.trip_done))
        }
        val title = day?.let { "${Format.city(it.from)} → ${Format.city(it.to)}" }
            ?: carContext.getString(R.string.stages)
        return ListTemplate.Builder()
            .setSingleList(list.build())
            .setTitle(title)
            .setHeaderAction(Action.BACK)
            .build()
    }
}
