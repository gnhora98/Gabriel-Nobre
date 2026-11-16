package com.viagemestrada.app.car

import android.app.Presentation
import android.content.Context
import android.graphics.Canvas
import android.graphics.Rect
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.net.ConnectivityManager
import android.view.View
import android.widget.FrameLayout
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
import androidx.core.graphics.drawable.IconCompat
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.lifecycleScope
import com.viagemestrada.app.R
import com.viagemestrada.app.data.TripRepository
import com.viagemestrada.app.data.Units
import com.viagemestrada.app.nav.Maneuvers
import com.viagemestrada.app.nav.NavMap
import com.viagemestrada.app.nav.NavigationController
import com.viagemestrada.core.RouteStep
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.launch
import org.maplibre.android.maps.MapLibreMapOptions
import org.maplibre.android.maps.MapView
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.ZonedDateTime

/**
 * Navegação no Android Auto: mapa MapLibre offline (ruas do OpenStreetMap)
 * desenhado na Surface do carro através de uma tela virtual, com a câmera
 * seguindo o veículo. Cartão de manobra e ações vêm do template do Android Auto;
 * o painel lateral (autonomia, próxima etapa, destino) é desenhado por cima.
 */
class NavScreen(carContext: CarContext) : Screen(carContext), DefaultLifecycleObserver {

    private val repository = TripRepository.get(carContext)
    private val nav = NavigationController.get(carContext)
    private val navigationManager = carContext.getCarService(NavigationManager::class.java)
    private val renderer = MapRenderer(carContext.resources.displayMetrics.density)

    private var virtualDisplay: VirtualDisplay? = null
    private var presentation: Presentation? = null
    private var mapView: MapView? = null
    private var navMap: NavMap? = null
    private var overlay: OverlayView? = null
    private var visibleArea = Rect()
    private var lastStepKey: String? = null
    private var gpsHeld = false

    private val surfaceCallback = object : SurfaceCallback {
        override fun onSurfaceAvailable(container: SurfaceContainer) = showMap(container)
        override fun onVisibleAreaChanged(area: Rect) { visibleArea = area; applyInsets(); overlay?.invalidate() }
        override fun onStableAreaChanged(area: Rect) = Unit
        override fun onSurfaceDestroyed(container: SurfaceContainer) = hideMap()
    }

    init {
        lifecycle.addObserver(this)
        lifecycleScope.launch {
            combine(repository.state, nav.state) { s, n -> s to n }.collect { (s, n) ->
                if (s.progress.done) {
                    CarToast.makeText(carContext, R.string.trip_done, CarToast.LENGTH_LONG).show()
                    screenManager.pop(); return@collect
                }
                val track = nav.track(s)
                navMap?.bind(s, track)
                if (track != null) navMap?.update(track, n.meters, n.speed)
                overlay?.invalidate()
                // O template (cartão de manobra) só muda quando a manobra/distância arredondada muda.
                val up = track?.nextStep(n.meters)
                val key = "${up?.step?.atMeters}/${up?.let { Maneuvers.distance(it.distanceMeters, s.settings.units) }}/${n.simulating}/${n.speed}/${navMap?.follow}"
                if (key != lastStepKey) { lastStepKey = key; invalidate() }
            }
        }
        lifecycleScope.launch {
            nav.events.collect { CarToast.makeText(carContext, it, CarToast.LENGTH_LONG).show() }
        }
    }

    override fun onCreate(owner: LifecycleOwner) {
        renderer.labels = MapRenderer.Labels(carContext.getString(R.string.car_autonomy), carContext.getString(R.string.car_day_destination))
        carContext.getCarService(AppManager::class.java).setSurfaceCallback(surfaceCallback)
        navigationManager.setNavigationManagerCallback(object : NavigationManagerCallback {
            override fun onStopNavigation() { screenManager.pop() }
        })
        navigationManager.navigationStarted()
        gpsHeld = true; nav.acquireGps()
    }

    override fun onDestroy(owner: LifecycleOwner) {
        if (gpsHeld) nav.releaseGps()
        hideMap()
        navigationManager.navigationEnded()
        navigationManager.clearNavigationManagerCallback()
        carContext.getCarService(AppManager::class.java).setSurfaceCallback(null)
    }

    // ---------- mapa na Surface do carro ----------

    private fun showMap(container: SurfaceContainer) {
        val surface = container.surface ?: return
        hideMap()
        if (visibleArea.isEmpty) visibleArea = Rect(0, 0, container.width, container.height)
        val dm = carContext.getSystemService(DisplayManager::class.java)
        val vd = dm.createVirtualDisplay("viagem-mapa", container.width, container.height, container.dpi, surface,
            DisplayManager.VIRTUAL_DISPLAY_FLAG_OWN_CONTENT_ONLY)
        virtualDisplay = vd
        val pres = Presentation(carContext, vd.display)
        val ctx = pres.context
        val mv = MapView(ctx, MapLibreMapOptions.createFromAttributes(ctx).textureMode(true))
        val ov = OverlayView(ctx)
        pres.setContentView(FrameLayout(ctx).apply {
            addView(mv, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))
            addView(ov, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))
        })
        runCatching { pres.show() }.onFailure { return }
        presentation = pres; mapView = mv; overlay = ov
        mv.onCreate(null); mv.onStart(); mv.onResume()
        mv.getMapAsync { map ->
            val nm = NavMap(map, ctx.resources.displayMetrics.density)
            nm.load {
                navMap = nm; applyInsets()
                val s = repository.current
                val track = nav.track(s)
                nm.bind(s, track)
                if (track != null) nm.update(track, nav.state.value.meters, nav.state.value.speed)
            }
        }
    }

    private fun hideMap() {
        mapView?.let { it.onPause(); it.onStop(); it.onDestroy() }
        presentation?.dismiss(); virtualDisplay?.release()
        mapView = null; presentation = null; virtualDisplay = null; navMap = null; overlay = null
    }

    /** O veículo fica centralizado na área livre (fora do cartão de manobra e do painel). */
    private fun applyInsets() {
        val v = mapView ?: return
        val w = v.width.takeIf { it > 0 } ?: visibleArea.right
        val panel = minOf(300 * carContext.resources.displayMetrics.density, visibleArea.width() * 0.34f)
        navMap?.insets = doubleArrayOf(visibleArea.left.toDouble(), visibleArea.top.toDouble(),
            (w - visibleArea.right + panel).toDouble(), (v.height - visibleArea.bottom).coerceAtLeast(0).toDouble())
    }

    /** Painel lateral e chips por cima do mapa. */
    private inner class OverlayView(ctx: Context) : View(ctx) {
        override fun onDraw(canvas: Canvas) {
            val s = repository.current
            val snap = NavSnapshot.build(carContext, s, null, nav.currentKm(s)) ?: return
            val area = if (visibleArea.isEmpty) Rect(0, 0, width, height) else visibleArea
            val road = nav.track(s)?.roadAt(nav.state.value.meters).orEmpty().ifBlank { carContext.getString(R.string.map_attrib) }
            val offline = carContext.getSystemService(ConnectivityManager::class.java)?.activeNetwork == null
            renderer.drawOverlay(canvas, area, snap, offline,
                carContext.getString(if (offline) R.string.car_offline else R.string.car_online), road)
        }
    }

    // ---------- template ----------

    override fun onGetTemplate(): Template {
        val s = repository.current
        val n = nav.state.value
        val track = nav.track(s)
        val actions = ActionStrip.Builder()
            .addAction(Action.Builder().setTitle(carContext.getString(if (n.simulating) R.string.pause else R.string.simulate))
                .setOnClickListener { nav.toggleSimulation() }.build())
            .addAction(Action.Builder().setTitle(carContext.getString(R.string.speed_x, n.speed))
                .setOnClickListener { nav.cycleSpeed() }.build())
            .addAction(Action.Builder().setTitle(carContext.getString(R.string.car_skip))
                .setOnClickListener { nav.skip() }.build())
            .addAction(Action.Builder().setTitle(carContext.getString(R.string.stages))
                .setOnClickListener { screenManager.push(StagesScreen(carContext)) }.build())
            .build()
        val builder = NavigationTemplate.Builder().setActionStrip(actions)
        val target = s.navigator.target(s.progress)
        if (track != null && target != null) {
            val up = track.nextStep(n.meters)
            val st: RouteStep = up?.step ?: RouteStep(0.0, "arrive", null, target.name)
            val dist = up?.distanceMeters ?: (nav.targetMeters(s) - n.meters).coerceAtLeast(0.0)
            val icon = CarIcon.Builder(IconCompat.createWithBitmap(Maneuvers.arrow(st, 128))).build()
            val maneuver = Maneuver.Builder(Maneuvers.carType(st)).setIcon(icon)
                .apply { if (Maneuvers.carType(st) == Maneuver.TYPE_ROUNDABOUT_ENTER_AND_EXIT_CCW) setRoundaboutExitNumber(st.exit ?: 1) }
                .build()
            val step = Step.Builder(Maneuvers.instruction(carContext, st)).setManeuver(maneuver).build()
            builder.setNavigationInfo(RoutingInfo.Builder().setCurrentStep(step, distance(dist, s.settings.units)).build())
            val day = s.navigator.day(s.progress)
            val remaining = ((track.totalMeters) - n.meters).coerceAtLeast(0.0)
            arrival(day?.date, day?.arrival)?.let {
                builder.setDestinationTravelEstimate(TravelEstimate.Builder(distance(remaining, s.settings.units), DateTimeWithZone.create(it)).build())
            }
        }
        return builder.build()
    }

    private fun distance(m: Double, units: Units): Distance = when (units) {
        Units.KM -> if (m < 1000) Distance.create(m, Distance.UNIT_METERS) else Distance.create(m / 1000, Distance.UNIT_KILOMETERS)
        Units.MI -> Distance.create(m / 1609.344, Distance.UNIT_MILES)
    }

    private fun arrival(date: String?, time: String?): ZonedDateTime? = runCatching {
        ZonedDateTime.of(LocalDate.parse(date), LocalTime.parse(time), ZoneId.of("America/Bahia"))
    }.getOrNull()
}
