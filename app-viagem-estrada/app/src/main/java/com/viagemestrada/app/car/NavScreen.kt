package com.viagemestrada.app.car

import android.Manifest
import android.annotation.SuppressLint
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.graphics.Rect
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.net.ConnectivityManager
import android.os.Looper
import android.speech.tts.TextToSpeech
import androidx.car.app.AppManager
import androidx.car.app.CarContext
import androidx.car.app.CarToast
import androidx.car.app.Screen
import androidx.car.app.SurfaceCallback
import androidx.car.app.SurfaceContainer
import androidx.car.app.model.Action
import androidx.car.app.model.ActionStrip
import androidx.car.app.model.CarIcon
import androidx.car.app.model.DateTimeWithZone
import androidx.car.app.model.Distance
import androidx.car.app.model.Template
import androidx.car.app.navigation.NavigationManager
import androidx.car.app.navigation.NavigationManagerCallback
import androidx.car.app.navigation.model.Maneuver
import androidx.car.app.navigation.model.NavigationTemplate
import androidx.car.app.navigation.model.RoutingInfo
import androidx.car.app.navigation.model.Step
import androidx.car.app.navigation.model.TravelEstimate
import androidx.core.content.ContextCompat
import androidx.core.graphics.drawable.IconCompat
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.lifecycleScope
import com.viagemestrada.app.R
import com.viagemestrada.app.data.Units
import com.viagemestrada.app.data.TripRepository
import com.viagemestrada.app.ui.Format
import com.viagemestrada.app.ui.VehicleArt
import com.viagemestrada.app.ui.VehicleArt.argb
import com.viagemestrada.core.Geo
import com.viagemestrada.core.LatLng
import kotlinx.coroutines.flow.drop
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.ZonedDateTime
import java.util.Locale

/**
 * Navegação: mapa desenhado pelo app (rota + veículo + painel), cartão de
 * manobra e ações "Pular etapa" / "Etapas". Avança sozinho ao chegar em cada
 * parada (GPS) e avisa por voz.
 */
class NavScreen(carContext: CarContext) : Screen(carContext), DefaultLifecycleObserver {

    private val repository = TripRepository.get(carContext)
    private val renderer = MapRenderer(carContext.resources.displayMetrics.density)
    private var surface: SurfaceContainer? = null
    private var visibleArea = Rect()
    private var position: LatLng? = null
    private var tts: TextToSpeech? = null
    private var sunsetWarnedOn: LocalDate? = null

    private val surfaceCallback = object : SurfaceCallback {
        override fun onSurfaceAvailable(container: SurfaceContainer) {
            surface = container
            if (visibleArea.isEmpty) visibleArea = Rect(0, 0, container.width, container.height)
            render()
        }
        override fun onVisibleAreaChanged(area: Rect) { visibleArea = area; render() }
        override fun onStableAreaChanged(area: Rect) = Unit
        override fun onSurfaceDestroyed(container: SurfaceContainer) { surface = null }
    }

    private val locationListener = LocationListener { loc: Location -> onLocation(LatLng(loc.latitude, loc.longitude)) }

    private val navigationManager: NavigationManager =
        carContext.getCarService(NavigationManager::class.java)

    init {
        lifecycle.addObserver(this)
        lifecycleScope.launch {
            repository.state.drop(1).collect { state ->
                if (state.progress.done) {
                    // Viagem concluída: volta para a tela inicial.
                    CarToast.makeText(carContext, R.string.trip_done, CarToast.LENGTH_LONG).show()
                    screenManager.pop()
                } else {
                    render(); invalidate()
                }
            }
        }
    }

    override fun onCreate(owner: LifecycleOwner) {
        renderer.labels = MapRenderer.Labels(
            carContext.getString(R.string.car_autonomy), carContext.getString(R.string.car_day_destination),
        )
        carContext.getCarService(AppManager::class.java).setSurfaceCallback(surfaceCallback)
        navigationManager.setNavigationManagerCallback(object : NavigationManagerCallback {
            override fun onStopNavigation() { screenManager.pop() }
        })
        navigationManager.navigationStarted()
        tts = TextToSpeech(carContext) { status ->
            if (status == TextToSpeech.SUCCESS) tts?.language = Locale.getDefault()
        }
        startLocation()
    }

    override fun onDestroy(owner: LifecycleOwner) {
        stopLocation()
        navigationManager.navigationEnded()
        navigationManager.clearNavigationManagerCallback()
        carContext.getCarService(AppManager::class.java).setSurfaceCallback(null)
        tts?.shutdown()
    }

    // ---- GPS e chegada ----

    @SuppressLint("MissingPermission")
    private fun startLocation() {
        val granted = ContextCompat.checkSelfPermission(carContext, Manifest.permission.ACCESS_FINE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED
        if (!granted) {
            CarToast.makeText(carContext, R.string.car_no_location, CarToast.LENGTH_LONG).show()
            return
        }
        val lm = carContext.getSystemService(LocationManager::class.java) ?: return
        runCatching {
            lm.requestLocationUpdates(LocationManager.GPS_PROVIDER, 2000L, 10f, locationListener, Looper.getMainLooper())
        }
    }

    private fun stopLocation() {
        carContext.getSystemService(LocationManager::class.java)?.removeUpdates(locationListener)
    }

    private fun onLocation(pos: LatLng) {
        position = pos
        val s = repository.current
        val nav = s.navigator
        if (nav.hasArrived(s.progress, pos)) {
            nav.target(s.progress)?.let { arrived(it.name) }
            repository.advance()
        }
        checkSunset()
        render()
        invalidate()
    }

    private fun arrived(name: String) {
        val msg = carContext.getString(R.string.car_arrived, name)
        CarToast.makeText(carContext, msg, CarToast.LENGTH_LONG).show()
        speak(msg)
    }

    /** Avisa uma vez por dia quando falta menos de 1 h para o pôr do sol e o dia não acabou. */
    private fun checkSunset() {
        val s = repository.current
        if (!s.settings.sunsetWarning) return
        val day = s.navigator.day(s.progress) ?: return
        val sunset = Format.sunset(day) ?: return
        val today = LocalDate.now()
        if (sunsetWarnedOn == today) return
        val minutesLeft = Geo.timeToMinutes(sunset) - LocalTime.now().let { it.hour * 60 + it.minute }
        if (minutesLeft in 1..60) {
            val snap = NavSnapshot.build(carContext, s, position) ?: return
            val msg = carContext.getString(
                R.string.car_sunset_warning, sunset,
                Format.distance(snap.dayRemainingKm, s.settings.units), Format.city(day.to),
            )
            CarToast.makeText(carContext, msg, CarToast.LENGTH_LONG).show()
            speak(msg)
            sunsetWarnedOn = today
        }
    }

    private fun speak(text: String) {
        if (repository.current.settings.voice) {
            tts?.speak(text, TextToSpeech.QUEUE_ADD, null, text.hashCode().toString())
        }
    }

    // ---- Desenho do mapa ----

    private fun isOffline(): Boolean {
        val cm = carContext.getSystemService(ConnectivityManager::class.java) ?: return true
        return cm.activeNetwork == null
    }

    private fun render() {
        val container = surface ?: return
        val s = repository.current
        val snap = NavSnapshot.build(carContext, s, position)
        renderer.routeColor = if (s.settings.vehicleTheme) WelcomeScreen.accentFor(s) else 0xFF2F8CFF.toInt()
        if (renderer.vehicleIcon == null || iconKey != s.garage.model to s.garage.colorArgb) {
            iconKey = s.garage.model to s.garage.colorArgb
            renderer.vehicleIcon = VehicleArt.bitmap(s.garage.model, s.garage.colorArgb.argb(), 160, 100)
        }
        val canvas = runCatching { container.surface?.lockCanvas(null) }.getOrNull() ?: return
        try {
            val offline = isOffline()
            renderer.draw(
                canvas, container.width, container.height, visibleArea, snap, carContext.isDarkMode,
                offline,
                carContext.getString(if (offline) R.string.car_offline else R.string.car_online),
                carContext.getString(R.string.car_route_schematic),
            )
        } finally {
            container.surface?.unlockCanvasAndPost(canvas)
        }
    }

    private var iconKey: Pair<Any, Long>? = null

    // ---- Template ----

    override fun onGetTemplate(): Template {
        val s = repository.current
        val snap = NavSnapshot.build(carContext, s, position)

        val actions = ActionStrip.Builder()
            .addAction(
                Action.Builder()
                    .setTitle(carContext.getString(R.string.car_skip))
                    .setOnClickListener {
                        repository.current.navigator.target(repository.current.progress)?.let { arrived(it.name) }
                        repository.advance()
                    }
                    .build(),
            )
            .addAction(
                Action.Builder()
                    .setTitle(carContext.getString(R.string.stages))
                    .setOnClickListener { screenManager.push(StagesScreen(carContext)) }
                    .build(),
            )
            .build()

        val builder = NavigationTemplate.Builder().setActionStrip(actions)

        if (snap != null) {
            val step = Step.Builder(snap.cue)
                .setManeuver(
                    Maneuver.Builder(Maneuver.TYPE_STRAIGHT)
                        .setIcon(CarIcon.Builder(IconCompat.createWithBitmap(arrowIcon())).build())
                        .build(),
                )
                .build()
            builder.setNavigationInfo(
                RoutingInfo.Builder()
                    .setCurrentStep(step, distance(snap.distanceToTargetKm, snap.units))
                    .build(),
            )
            val day = s.navigator.day(s.progress)
            val arrival = day?.let { arrivalTime(it.date, it.arrival) }
            if (arrival != null) {
                builder.setDestinationTravelEstimate(
                    TravelEstimate.Builder(distance(snap.dayRemainingKm, snap.units), DateTimeWithZone.create(arrival))
                        .build(),
                )
            }
        }
        return builder.build()
    }

    private fun distance(km: Double, units: Units): Distance = when (units) {
        Units.KM -> if (km < 1) Distance.create(km * 1000, Distance.UNIT_METERS)
        else Distance.create(km, Distance.UNIT_KILOMETERS)
        Units.MI -> Distance.create(km / 1.609344, Distance.UNIT_MILES)
    }

    private fun arrivalTime(date: String, time: String): ZonedDateTime? = runCatching {
        ZonedDateTime.of(LocalDate.parse(date), LocalTime.parse(time), ZoneId.of("America/Bahia"))
    }.getOrNull()

    private fun arrowIcon(): Bitmap {
        val size = 128
        val bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        val c = Canvas(bmp)
        val p = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xFFFFFFFF.toInt() }
        c.drawPath(Path().apply {
            moveTo(64f, 8f); lineTo(112f, 64f); lineTo(80f, 64f); lineTo(80f, 120f)
            lineTo(48f, 120f); lineTo(48f, 64f); lineTo(16f, 64f); close()
        }, p)
        return bmp
    }
}
