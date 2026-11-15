package com.viagemestrada.app

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Rect
import android.graphics.RectF
import android.graphics.Typeface
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import androidx.test.core.app.ApplicationProvider
import com.github.takahirom.roborazzi.captureRoboImage
import com.viagemestrada.app.car.MapRenderer
import com.viagemestrada.app.car.NavSnapshot
import com.viagemestrada.app.data.TripRepository
import com.viagemestrada.app.ui.PhoneApp
import com.viagemestrada.app.ui.Tab
import com.viagemestrada.app.ui.VehicleArt
import com.viagemestrada.app.ui.VehicleArt.argb
import com.viagemestrada.core.Geo
import com.viagemestrada.core.LatLng
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * Renderiza as telas na JVM e salva as capturas em docs/telas/ para validar
 * o visual sem aparelho. Usa o Dia 4 (Fortaleza → Pipa), como no mockup.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "pt-rBR-w400dp-h860dp-xxhdpi")
class ScreensTest {

    @get:Rule val compose = createComposeRule()

    private val context: Context = ApplicationProvider.getApplicationContext()
    private val dir = File(System.getProperty("screens.dir") ?: "build/telas").apply { mkdirs() }

    private fun repository(stop: Int = 1): TripRepository =
        TripRepository.get(context).apply { jumpTo(day = 3, stop = stop) }

    private fun capturePhone(tab: Tab, name: String) {
        val repo = repository()
        compose.setContent { PhoneApp(repo, onLanguage = {}, initialTab = tab) }
        compose.waitForIdle()
        compose.onRoot().captureRoboImage(File(dir, name).path)
        assertTrue(File(dir, name).length() > 0)
    }

    @Test fun celularViagens() = capturePhone(Tab.TRIPS, "celular-1-viagens.png")
    @Test fun celularRoteiro() = capturePhone(Tab.ROUTE, "celular-2-roteiro.png")
    @Test fun celularGaragem() = capturePhone(Tab.GARAGE, "celular-3-garagem.png")
    @Test fun celularAjustes() = capturePhone(Tab.SETTINGS, "celular-4-ajustes.png")

    /**
     * Tela de navegação do carro. O mapa e o painel são desenhados pelo app;
     * o cartão de manobra e os botões do topo são do Android Auto e aqui
     * aparecem só como ilustração.
     */
    @Test fun carroNavegacao() {
        val repo = repository(stop = 0) // alvo: Dunorte (km 150)
        val day = repo.current.trip.days[3]
        val target = day.stops[0]
        // Posição a 38 km (em linha reta) do primeiro posto, vindo de Fortaleza.
        val fortaleza = LatLng(-3.7319, -38.5267)
        val dunorte = LatLng(target.lat!!, target.lng!!)
        val f = 38.0 / Geo.distanceKm(dunorte, fortaleza)
        val pos = LatLng(
            dunorte.lat + (fortaleza.lat - dunorte.lat) * f,
            dunorte.lng + (fortaleza.lng - dunorte.lng) * f,
        )
        val snap = NavSnapshot.build(context, repo.current, pos)
        assertNotNull(snap)

        val density = 1.5f
        val w = 1600; val h = 760
        val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
        val c = Canvas(bmp)
        val renderer = MapRenderer(density).apply {
            labels = MapRenderer.Labels(context.getString(R.string.car_autonomy), context.getString(R.string.car_day_destination))
            vehicleIcon = VehicleArt.bitmap(repo.current.garage.model, repo.current.garage.colorArgb.argb(), 160, 100)
        }
        // Área visível: à direita do cartão de manobra e abaixo dos botões.
        val visible = Rect((380 * density).toInt(), (64 * density).toInt(), w, h)
        renderer.draw(c, w, h, visible, snap, dark = true, offline = true, offlineLabel = "Offline", routeLabel = context.getString(R.string.car_route_schematic))
        drawHostOverlay(c, density, snap!!.cue, "%.0f km".format(snap.distanceToTargetKm), w)

        File(dir, "carro-2-navegacao.png").outputStream().use { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }

    /** Ilustração do que o Android Auto desenha por cima (cartão de manobra e ações). */
    private fun drawHostOverlay(c: Canvas, d: Float, cue: String, dist: String, w: Int) {
        val card = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xFF1B5E3A.toInt() }
        val r = RectF(16 * d, 16 * d, 360 * d, 130 * d)
        c.drawRoundRect(r, 14 * d, 14 * d, card)
        val big = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xFFFFFFFF.toInt(); textSize = 34 * d; typeface = Typeface.DEFAULT_BOLD }
        val small = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xFFE6EDF3.toInt(); textSize = 16 * d }
        c.drawText("↑ $dist", r.left + 18 * d, r.top + 52 * d, big)
        c.drawText(if (cue.length > 34) cue.take(33) + "…" else cue, r.left + 18 * d, r.top + 90 * d, small)
        val btn = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xFF2B333D.toInt() }
        val label = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xFFFFFFFF.toInt(); textSize = 15 * d; typeface = Typeface.DEFAULT_BOLD }
        var x = w - 16 * d
        listOf(context.getString(R.string.stages), context.getString(R.string.car_skip)).forEach { t ->
            val bw = label.measureText(t) + 28 * d
            val b = RectF(x - bw, 14 * d, x, 54 * d)
            c.drawRoundRect(b, 20 * d, 20 * d, btn)
            c.drawText(t, b.left + 14 * d, b.top + 26 * d, label)
            x -= bw + 8 * d
        }
    }

    /** Ilustração da tela "ao conectar" (o Android Auto monta o layout do PaneTemplate). */
    @Test fun carroBoasVindas() {
        val repo = repository(stop = 0)
        val s = repo.current
        val d = 1.5f
        val w = 1600; val h = 760
        val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
        val c = Canvas(bmp)
        c.drawColor(0xFF0D1117.toInt())
        VehicleArt.draw(c.also { it.save(); it.translate(60 * d, 120 * d) }, s.garage.model, s.garage.colorArgb.argb(), 440 * d, 300 * d)
        c.restore()
        val title = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xFFE6EDF3.toInt(); textSize = 32 * d; typeface = Typeface.DEFAULT_BOLD }
        val text = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xFF8B949E.toInt(); textSize = 17 * d }
        val strong = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xFFE6EDF3.toInt(); textSize = 20 * d; typeface = Typeface.DEFAULT_BOLD }
        val x = 560 * d
        c.drawText(com.viagemestrada.app.ui.Format.greeting(context, s.settings.riderName, 7), x, 150 * d, title)
        c.drawText(context.getString(R.string.continue_trip_day, 4, s.trip.days.size), x, 210 * d, text)
        c.drawText("Fortaleza → Pipa", x, 245 * d, strong)
        val target = s.navigator.target(s.progress)!!
        c.drawText(
            context.getString(R.string.next_stop_summary, "600 km", target.name, "150 km").let { if (it.length > 52) it.take(51) + "…" else it },
            x, 280 * d, text,
        )
        val btn = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xFFF5A524.toInt() }
        c.drawRoundRect(RectF(x, 320 * d, x + 220 * d, 372 * d), 12 * d, 12 * d, btn)
        c.drawText(context.getString(R.string.follow_trip), x + 22 * d, 354 * d, Paint(strong).apply { color = 0xFF1A1300.toInt() })
        c.drawRoundRect(RectF(x + 236 * d, 320 * d, x + 360 * d, 372 * d), 12 * d, 12 * d, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xFF2B333D.toInt() })
        c.drawText(context.getString(R.string.stages), x + 262 * d, 354 * d, strong)
        File(dir, "carro-1-boas-vindas.png").outputStream().use { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }
}
