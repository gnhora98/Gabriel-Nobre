package com.viagemestrada.app.nav

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Looper
import android.speech.tts.TextToSpeech
import androidx.core.content.ContextCompat
import com.viagemestrada.app.R
import com.viagemestrada.app.data.AppState
import com.viagemestrada.app.data.TripRepository
import com.viagemestrada.core.Geo
import com.viagemestrada.core.LatLng
import com.viagemestrada.core.RouteTrack
import com.viagemestrada.core.Stop
import com.viagemestrada.core.TripProgress
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.util.Locale

/** Posição na rota do dia e modo de navegação (GPS real ou simulação). */
data class NavState(
    val meters: Double = 0.0,
    val simulating: Boolean = false,
    val speed: Int = 1,
    val gps: Boolean = false,
    val offRouteMeters: Double = 0.0,
)

/**
 * Cérebro da navegação, compartilhado pelo celular e pelo Android Auto:
 * acompanha a posição na rota real (GPS projetado na rota, ou simulação),
 * converte metros da rota ⇄ km do roteiro, detecta a chegada em cada parada,
 * avança a etapa e avisa por voz.
 */
class NavigationController private constructor(private val context: Context) {

    private val repository = TripRepository.get(context)
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    private val _state = MutableStateFlow(NavState())
    val state: StateFlow<NavState> = _state.asStateFlow()

    /** Avisos para a tela ("Chegamos em …"). */
    private val _events = MutableSharedFlow<String>(extraBufferCapacity = 4)
    val events: SharedFlow<String> = _events

    private var lastProgress: TripProgress? = null
    private var lastTripId: String? = null
    private var simJob: Job? = null
    private var tts: TextToSpeech? = null
    private var gpsUsers = 0
    private val tracks = mutableMapOf<Pair<String, Int>, RouteTrack>()

    init {
        scope.launch {
            repository.state.collect { s ->
                // Progresso mudou por fora (celular, lista de etapas): reposiciona na rota.
                if (s.progress != lastProgress || s.trip.id != lastTripId) {
                    lastProgress = s.progress; lastTripId = s.trip.id
                    syncToProgress(s)
                }
            }
        }
    }

    // ---------- rota do dia ----------

    fun track(s: AppState = repository.current): RouteTrack? =
        repository.routes(s.trip.id).getOrNull(s.progress.dayIndex)?.let { tracks.getOrPut(s.trip.id to s.progress.dayIndex) { RouteTrack(it) } }

    /** Pares (km do roteiro, metros da rota) do dia atual, para converter um no outro. */
    private fun kmPairs(s: AppState): List<Pair<Double, Double>> {
        val day = s.navigator.day(s.progress) ?: return listOf(0.0 to 0.0)
        val t = track(s) ?: return listOf(0.0 to 0.0, day.km to day.km * 1000)
        return if (t.legEnds.size == day.stops.size) listOf(0.0 to 0.0) + day.stops.mapIndexed { i, st -> st.km to t.legEnds[i] }
        else listOf(0.0 to 0.0, day.km to t.totalMeters)
    }

    private fun interp(pairs: List<Pair<Double, Double>>, x: Double, fromKm: Boolean): Double {
        for (i in 1 until pairs.size) {
            val (a0, b0) = if (fromKm) pairs[i - 1] else pairs[i - 1].second to pairs[i - 1].first
            val (a1, b1) = if (fromKm) pairs[i] else pairs[i].second to pairs[i].first
            if (x <= a1 || i == pairs.lastIndex) {
                val f = ((x - a0) / (a1 - a0).coerceAtLeast(1e-6)).coerceIn(0.0, 1.0)
                return b0 + (b1 - b0) * f
            }
        }
        return x
    }

    fun metersForKm(km: Double, s: AppState = repository.current) = interp(kmPairs(s), km, fromKm = true)
    fun kmForMeters(m: Double, s: AppState = repository.current) = interp(kmPairs(s), m, fromKm = false)

    /** Km atual no dia (para autonomia e distâncias do painel). */
    fun currentKm(s: AppState = repository.current): Double =
        maxOf(kmForMeters(_state.value.meters, s), s.navigator.reachedKm(s.progress))

    /** Metros onde termina a etapa atual (chegada na parada alvo). */
    fun targetMeters(s: AppState = repository.current): Double {
        val target = s.navigator.target(s.progress) ?: return track(s)?.totalMeters ?: 0.0
        return metersForKm(target.km, s)
    }

    private fun syncToProgress(s: AppState) {
        _state.value = _state.value.copy(meters = metersForKm(s.navigator.reachedKm(s.progress), s))
    }

    // ---------- simulação ----------

    fun toggleSimulation() = if (_state.value.simulating) stopSimulation() else startSimulation()

    fun startSimulation() {
        if (repository.current.progress.done) return
        _state.value = _state.value.copy(simulating = true)
        simJob?.cancel()
        simJob = scope.launch {
            var last = System.nanoTime()
            while (isActive) {
                delay(50)
                val now = System.nanoTime(); val dt = (now - last) / 1e9; last = now
                // 1× ≈ 54 km/h (velocidade real de bairro); 5× e 20× para testar rápido.
                val next = _state.value.meters + SIM_MPS * _state.value.speed * dt
                moveTo(next, fromGps = false)
                if (repository.current.progress.done) { stopSimulation(); break }
            }
        }
    }

    fun stopSimulation() {
        simJob?.cancel(); simJob = null
        _state.value = _state.value.copy(simulating = false)
    }

    fun cycleSpeed() {
        val next = when (_state.value.speed) { 1 -> 5; 5 -> 20; else -> 1 }
        _state.value = _state.value.copy(speed = next)
    }

    /** Pula a etapa atual (como se tivesse chegado). */
    fun skip() {
        val s = repository.current
        s.navigator.target(s.progress)?.let { arrived(it, s) }
    }

    // ---------- GPS ----------

    private val listener = LocationListener { loc: Location -> onLocation(LatLng(loc.latitude, loc.longitude)) }

    @SuppressLint("MissingPermission")
    fun acquireGps(): Boolean {
        gpsUsers++
        if (gpsUsers > 1) return _state.value.gps
        val ok = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        if (!ok) return false
        val lm = context.getSystemService(LocationManager::class.java) ?: return false
        return runCatching {
            lm.requestLocationUpdates(LocationManager.GPS_PROVIDER, 1000L, 3f, listener, Looper.getMainLooper())
            true
        }.getOrDefault(false)
    }

    fun releaseGps() {
        gpsUsers = (gpsUsers - 1).coerceAtLeast(0)
        if (gpsUsers == 0) {
            context.getSystemService(LocationManager::class.java)?.removeUpdates(listener)
            _state.value = _state.value.copy(gps = false)
        }
    }

    private fun onLocation(pos: LatLng) {
        if (_state.value.simulating) return
        val s = repository.current
        val t = track(s) ?: return
        val (m, off) = t.project(pos, hintMeters = _state.value.meters)
        _state.value = _state.value.copy(gps = true, offRouteMeters = off)
        // Fora da rota (> 80 m): mantém a posição, só marca o afastamento.
        if (off <= 80) moveTo(maxOf(m, metersForKm(s.navigator.reachedKm(s.progress), s)), fromGps = true, gpsPos = pos)
    }

    // ---------- movimento e chegada ----------

    private fun moveTo(meters: Double, fromGps: Boolean, gpsPos: LatLng? = null) {
        val s = repository.current
        val target = s.navigator.target(s.progress) ?: return
        val end = targetMeters(s)
        val clamped = meters.coerceAtMost(end)
        _state.value = _state.value.copy(meters = clamped)
        val nearStop = gpsPos != null && target.hasLocation &&
            Geo.distanceKm(gpsPos, LatLng(target.lat!!, target.lng!!)) * 1000 <= ARRIVE_RADIUS_M
        if (clamped >= end - (if (fromGps) 25.0 else 0.5) || nearStop) arrived(target, s)
    }

    private fun arrived(stop: Stop, s: AppState) {
        val lastOfDay = s.progress.stopIndex == (s.navigator.day(s.progress)?.stops?.lastIndex ?: 0)
        val msg = context.getString(if (lastOfDay) R.string.car_day_done else R.string.car_arrived, stop.name)
        _events.tryEmit(msg)
        speak(msg)
        repository.advance()
        if (lastOfDay) stopSimulation()
    }

    // ---------- voz ----------

    private fun speak(text: String) {
        if (!repository.current.settings.voice) return
        val engine = tts ?: TextToSpeech(context) { status ->
            if (status == TextToSpeech.SUCCESS) {
                tts?.language = Locale.forLanguageTag(languageTag())
                tts?.speak(text, TextToSpeech.QUEUE_ADD, null, text.hashCode().toString())
            }
        }.also { tts = it; return }
        engine.language = Locale.forLanguageTag(languageTag())
        engine.speak(text, TextToSpeech.QUEUE_ADD, null, text.hashCode().toString())
    }

    fun announce(text: String) { _events.tryEmit(text); speak(text) }

    private fun languageTag() = when (repository.current.settings.language) { "en" -> "en-US"; "es" -> "es-ES"; else -> "pt-BR" }

    companion object {
        const val SIM_MPS = 15.0
        const val ARRIVE_RADIUS_M = 40.0

        @Volatile private var instance: NavigationController? = null
        fun get(context: Context): NavigationController = instance ?: synchronized(this) {
            instance ?: NavigationController(context.applicationContext).also { instance = it }
        }
    }
}
