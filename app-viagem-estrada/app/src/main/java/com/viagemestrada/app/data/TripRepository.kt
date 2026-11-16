package com.viagemestrada.app.data

import android.content.Context
import android.content.SharedPreferences
import androidx.core.content.edit
import com.viagemestrada.core.Day
import com.viagemestrada.core.DayRoute
import com.viagemestrada.core.Stop
import com.viagemestrada.core.Trip
import com.viagemestrada.core.TripProgress
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.json.Json

/**
 * Fonte única do estado do app (viagem, progresso, garagem, ajustes).
 * Tudo fica salvo no aparelho, então o app funciona offline e retoma de onde
 * parou. O celular e o Android Auto rodam no mesmo processo e observam o
 * mesmo [state].
 */
class TripRepository private constructor(context: Context) {

    private val prefs: SharedPreferences =
        context.getSharedPreferences("viagem", Context.MODE_PRIVATE)

    private val assets = context.assets

    /** Viagens disponíveis no aparelho (arquivo em assets → id). A primeira é a padrão. */
    val catalog: List<Trip> = CATALOG.map { file -> loadTrip(file) }

    private val routeCache = mutableMapOf<String, List<DayRoute>>()

    private val _state = MutableStateFlow(load(context))
    val state: StateFlow<AppState> = _state.asStateFlow()

    val current: AppState get() = _state.value

    private fun load(context: Context): AppState {
        prefs.getString(KEY_STATE, null)?.let { saved ->
            runCatching { return json.decodeFromString(AppState.serializer(), saved) }
        }
        val trip = catalog.first()
        // Primeira abertura: garagem começa com o veículo da viagem.
        val garage = Garage(
            rangeKm = trip.vehicle.rangeKm,
            marginPct = trip.vehicle.safetyMarginPct,
            kmPerLiter = trip.vehicle.kmPerLiter ?: 21.5,
        )
        return AppState(trip = trip, garage = garage)
    }

    fun update(transform: (AppState) -> AppState) {
        val next = transform(_state.value)
        _state.value = next
        prefs.edit { putString(KEY_STATE, json.encodeToString(AppState.serializer(), next)) }
    }

    private fun loadTrip(file: String): Trip {
        val trip = Trip.fromJson(assets.open(file).bufferedReader().use { it.readText() })
        return if (trip.id.isBlank()) trip.copy(id = file.removeSuffix(".json")) else trip
    }

    /** Rotas reais (uma por dia) da viagem, embutidas em assets/rotas/<id>.json. */
    fun routes(tripId: String = current.trip.id): List<DayRoute> = routeCache.getOrPut(tripId) {
        runCatching {
            DayRoute.listFromJson(assets.open("rotas/$tripId.json").bufferedReader().use { it.readText() })
        }.getOrDefault(emptyList())
    }

    /** Troca a viagem ativa e volta para o início dela. */
    fun selectTrip(id: String) {
        val trip = catalog.firstOrNull { it.id == id } ?: return
        update { it.copy(trip = trip, progress = TripProgress()) }
    }

    // ---- Progresso ----

    fun advance() = update { it.copy(progress = it.navigator.advance(it.progress)) }
    fun back() = update { it.copy(progress = it.navigator.back(it.progress)) }
    fun jumpTo(day: Int, stop: Int) = update { it.copy(progress = it.navigator.jumpTo(day, stop)) }
    fun restart() = update { it.copy(progress = TripProgress()) }

    // ---- Edição do roteiro ----

    fun saveStop(dayIndex: Int, stopIndex: Int?, stop: Stop) = updateDay(dayIndex) { day ->
        val stops = day.stops.toMutableList()
        if (stopIndex == null) stops += stop else stops[stopIndex] = stop
        day.copy(stops = stops.sortedBy { it.km })
    }

    fun deleteStop(dayIndex: Int, stopIndex: Int) = updateDay(dayIndex) { day ->
        if (day.stops.size <= 1) day // o dia precisa de ao menos um destino
        else day.copy(stops = day.stops.filterIndexed { i, _ -> i != stopIndex })
    }

    private fun updateDay(dayIndex: Int, transform: (Day) -> Day) = update { s ->
        val days = s.trip.days.toMutableList()
        days[dayIndex] = transform(days[dayIndex])
        val trip = s.trip.copy(days = days)
        // Mantém o progresso válido se o dia atual encolheu.
        val p = s.progress
        val progress = if (p.dayIndex == dayIndex) {
            p.copy(stopIndex = p.stopIndex.coerceIn(0, days[dayIndex].stops.lastIndex))
        } else p
        s.copy(trip = trip, progress = progress)
    }

    // ---- Garagem e ajustes ----

    fun updateGarage(transform: (Garage) -> Garage) = update { it.copy(garage = transform(it.garage)) }
    fun updateSettings(transform: (Settings) -> Settings) = update { it.copy(settings = transform(it.settings)) }

    companion object {
        private const val KEY_STATE = "state_v3"
        private val CATALOG = listOf("teste-stella-maris.json", "viagem-exemplo.json")
        private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }

        @Volatile private var instance: TripRepository? = null

        fun get(context: Context): TripRepository = instance ?: synchronized(this) {
            instance ?: TripRepository(context.applicationContext).also { instance = it }
        }
    }
}
