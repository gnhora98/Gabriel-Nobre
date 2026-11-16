package com.viagemestrada.app.nav

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import androidx.compose.ui.graphics.toArgb
import com.viagemestrada.app.data.AppState
import com.viagemestrada.app.ui.accentFromVehicle
import com.viagemestrada.core.RouteTrack
import com.viagemestrada.core.StopKind
import org.maplibre.android.camera.CameraPosition
import org.maplibre.android.camera.CameraUpdateFactory
import org.maplibre.android.geometry.LatLng
import org.maplibre.android.geometry.LatLngBounds
import org.maplibre.android.maps.MapLibreMap
import org.maplibre.android.maps.Style
import org.maplibre.android.style.expressions.Expression
import org.maplibre.android.style.layers.CircleLayer
import org.maplibre.android.style.layers.LineLayer
import org.maplibre.android.style.layers.Property
import org.maplibre.android.style.layers.PropertyFactory
import org.maplibre.android.style.layers.SymbolLayer
import org.maplibre.android.style.sources.GeoJsonOptions
import org.maplibre.android.style.sources.GeoJsonSource
import org.maplibre.geojson.Feature
import org.maplibre.geojson.FeatureCollection
import org.maplibre.geojson.LineString
import org.maplibre.geojson.Point

/**
 * Mapa de navegação (MapLibre, offline): estilo noturno com as ruas do
 * OpenStreetMap, rota do dia na cor da moto, paradas e o veículo. A câmera
 * segue o veículo inclinada e gira com a via, como nos navegadores comuns.
 */
class NavMap(private val map: MapLibreMap, private val density: Float) {

    private var style: Style? = null
    private var routeKey: String? = null
    private var accent = 0xFFF5A524.toInt()
    private var vehicleKey: Any? = null
    var follow = true
    var tilt = true
    private var heading = 0.0
    /** Áreas da tela cobertas por cartões (px): esquerda, topo, direita, baixo. */
    var insets = doubleArrayOf(0.0, 0.0, 0.0, 0.0)

    fun load(onReady: () -> Unit) {
        map.uiSettings.apply {
            isRotateGesturesEnabled = false; isTiltGesturesEnabled = false
            isCompassEnabled = false; isLogoEnabled = false; isAttributionEnabled = false
        }
        map.setStyle(Style.Builder().fromUri(STYLE_URI)) { st ->
            style = st
            st.addSource(GeoJsonSource(SRC_ROUTE, GeoJsonOptions().withLineMetrics(true)))
            st.addSource(GeoJsonSource(SRC_STOPS))
            st.addSource(GeoJsonSource(SRC_VEHICLE))
            val width = { a: Float, b: Float ->
                Expression.interpolate(Expression.exponential(1.6f), Expression.zoom(),
                    Expression.stop(10, a), Expression.stop(18, b))
            }
            st.addLayer(LineLayer(L_CASING, SRC_ROUTE).withProperties(
                PropertyFactory.lineColor("#0d1117"), PropertyFactory.lineWidth(width(5f, 26f)),
                PropertyFactory.lineCap(Property.LINE_CAP_ROUND), PropertyFactory.lineJoin(Property.LINE_JOIN_ROUND)))
            st.addLayer(LineLayer(L_ROUTE, SRC_ROUTE).withProperties(
                PropertyFactory.lineWidth(width(3f, 17f)), PropertyFactory.lineGradient(gradient(0.0)),
                PropertyFactory.lineCap(Property.LINE_CAP_ROUND), PropertyFactory.lineJoin(Property.LINE_JOIN_ROUND)))
            st.addLayer(CircleLayer(L_STOPS, SRC_STOPS).withProperties(
                PropertyFactory.circleColor(Expression.get("c")), PropertyFactory.circleRadius(9f),
                PropertyFactory.circleStrokeColor("#0d1117"), PropertyFactory.circleStrokeWidth(3f),
                PropertyFactory.circlePitchAlignment(Property.CIRCLE_PITCH_ALIGNMENT_MAP)))
            st.addLayer(SymbolLayer(L_STOP_LABELS, SRC_STOPS).withProperties(
                PropertyFactory.textField(Expression.get("nome")), PropertyFactory.textFont(arrayOf("NotoSans-Regular")),
                PropertyFactory.textSize(14f), PropertyFactory.textColor("#ffffff"),
                PropertyFactory.textHaloColor("#0d1117"), PropertyFactory.textHaloWidth(2f),
                PropertyFactory.textOffset(arrayOf(0f, -1.6f)), PropertyFactory.textAllowOverlap(true)))
            st.addLayer(SymbolLayer(L_VEHICLE, SRC_VEHICLE).withProperties(
                PropertyFactory.iconImage(IMG_VEHICLE), PropertyFactory.iconRotate(Expression.get("b")),
                PropertyFactory.iconRotationAlignment(Property.ICON_ROTATION_ALIGNMENT_MAP),
                PropertyFactory.iconPitchAlignment(Property.ICON_PITCH_ALIGNMENT_MAP),
                PropertyFactory.iconAllowOverlap(true), PropertyFactory.iconIgnorePlacement(true)))
            onReady()
        }
    }

    private fun gradient(f: Double): Expression = Expression.step(
        Expression.lineProgress(), Expression.color(0xFF76808C.toInt()),
        Expression.stop(f.coerceIn(0.00001, 0.99999), Expression.color(accent)),
    )

    /** Atualiza rota, paradas e cor quando a viagem/dia/etapa/cor mudam. */
    fun bind(s: AppState, track: RouteTrack?) {
        val st = style ?: return
        accent = if (s.settings.vehicleTheme) accentFromVehicle(s.garage.colorArgb, false).first.toArgb() else 0xFF2F8CFF.toInt()
        val key = "${s.trip.id}/${s.progress.dayIndex}/${track?.totalMeters}"
        if (key != routeKey && track != null) {
            routeKey = key
            st.getSourceAs<GeoJsonSource>(SRC_ROUTE)?.setGeoJson(
                Feature.fromGeometry(LineString.fromLngLats(track.points.map { Point.fromLngLat(it.lng, it.lat) })))
        }
        val day = s.navigator.day(s.progress)
        val stops = day?.stops.orEmpty().mapIndexedNotNull { i, stop ->
            if (!stop.hasLocation) return@mapIndexedNotNull null
            val reached = s.progress.done || i < s.progress.stopIndex
            Feature.fromGeometry(Point.fromLngLat(stop.lng!!, stop.lat!!)).apply {
                addStringProperty("c", if (reached) "#2EA043" else kindColor(stop.kind))
                addStringProperty("nome", if (reached) "" else stop.name)
            }
        }
        st.getSourceAs<GeoJsonSource>(SRC_STOPS)?.setGeoJson(FeatureCollection.fromFeatures(stops))
        val vKey = s.garage.colorArgb to accent
        if (vKey != vehicleKey) { vehicleKey = vKey; st.addImage(IMG_VEHICLE, vehicleIcon(s.garage.colorArgb.toInt(), (88 * density).toInt())) }
    }

    /** Move câmera e veículo para [meters] ao longo da rota. */
    fun update(track: RouteTrack, meters: Double, speed: Int) {
        val st = style ?: return
        val p = track.pointAt(meters)
        val target = track.bearingAt(meters, 60.0)
        val diff = ((target - heading + 540) % 360) - 180
        heading = (heading + diff * 0.25 + 360) % 360
        st.getSourceAs<GeoJsonSource>(SRC_VEHICLE)?.setGeoJson(
            Feature.fromGeometry(Point.fromLngLat(p.lng, p.lat)).apply { addNumberProperty("b", heading) })
        st.getLayer(L_ROUTE)?.setProperties(PropertyFactory.lineGradient(gradient(meters / track.totalMeters.coerceAtLeast(1.0))))
        if (follow) {
            val zoom = when { speed >= 20 -> 15.4; speed >= 5 -> 16.2; else -> 17.0 }
            // Veículo no terço de baixo da área livre.
            val h = map.height.toDouble()
            map.moveCamera(CameraUpdateFactory.newCameraPosition(
                CameraPosition.Builder().target(LatLng(p.lat, p.lng)).zoom(zoom)
                    .tilt(if (tilt) 60.0 else 0.0).bearing(heading)
                    .padding(insets[0], insets[1] + h * 0.35, insets[2], insets[3])
                    .build()))
        }
    }

    fun overview(track: RouteTrack) {
        val b = LatLngBounds.Builder().apply { track.points.forEach { include(LatLng(it.lat, it.lng)) } }.build()
        map.easeCamera(CameraUpdateFactory.newLatLngBounds(b, insets[0].toInt() + 60, insets[1].toInt() + 60, insets[2].toInt() + 60, insets[3].toInt() + 60), 600)
    }

    private fun kindColor(k: StopKind) = when (k) {
        StopKind.FUEL, StopKind.FUEL_OPTIONAL -> "#F5A524"
        StopKind.MEAL_FUEL, StopKind.USER -> "#3B8BEB"
        StopKind.OVERNIGHT, StopKind.ARRIVAL -> "#A371F7"
    }

    /** Ícone do veículo visto de cima (moto apontando para cima), na cor da garagem. */
    private fun vehicleIcon(color: Int, size: Int): Bitmap {
        val bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        val c = Canvas(bmp); val s = size.toFloat()
        val p = Paint(Paint.ANTI_ALIAS_FLAG)
        p.color = 0x55000000; c.drawCircle(s / 2, s / 2 + s * 0.03f, s * 0.46f, p)
        p.color = 0xFFFFFFFF.toInt(); c.drawCircle(s / 2, s / 2, s * 0.44f, p)
        p.color = accent; c.drawCircle(s / 2, s / 2, s * 0.39f, p)
        // moto de cima: pneus, tanque, banco, guidão
        p.color = 0xFF15171A.toInt()
        c.drawRoundRect(RectF(s * 0.455f, s * 0.13f, s * 0.545f, s * 0.33f), s * 0.04f, s * 0.04f, p)
        c.drawRoundRect(RectF(s * 0.45f, s * 0.66f, s * 0.55f, s * 0.88f), s * 0.04f, s * 0.04f, p)
        p.color = 0xFFD8DDE3.toInt(); c.drawRoundRect(RectF(s * 0.3f, s * 0.29f, s * 0.7f, s * 0.33f), s * 0.02f, s * 0.02f, p)
        p.color = color; c.drawOval(RectF(s * 0.4f, s * 0.32f, s * 0.6f, s * 0.52f), p)
        p.color = 0xFF2A1F1A.toInt(); c.drawRoundRect(RectF(s * 0.42f, s * 0.5f, s * 0.58f, s * 0.7f), s * 0.05f, s * 0.05f, p)
        p.color = 0xFFFFFFFF.toInt(); p.style = Paint.Style.STROKE; p.strokeWidth = s * 0.025f
        c.drawOval(RectF(s * 0.4f, s * 0.32f, s * 0.6f, s * 0.52f), p)
        return bmp
    }

    companion object {
        const val STYLE_URI = "asset://mapa/estilo-noite.json"
        private const val SRC_ROUTE = "rota"; private const val SRC_STOPS = "paradas"; private const val SRC_VEHICLE = "veiculo"
        private const val L_CASING = "rota-borda"; private const val L_ROUTE = "rota-linha"; private const val L_STOPS = "paradas-pontos"
        private const val L_STOP_LABELS = "paradas-nomes"; private const val L_VEHICLE = "veiculo-icone"; private const val IMG_VEHICLE = "veiculo"
    }
}
