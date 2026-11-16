package com.viagemestrada.app.car

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.graphics.Rect
import android.graphics.RectF
import android.graphics.Typeface
import com.viagemestrada.core.LatLng
import com.viagemestrada.core.StopKind
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min

/**
 * Desenha a tela de navegação na Surface do carro: rota do dia (com as
 * coordenadas reais das paradas), ícone do veículo e o painel lateral
 * (autonomia, próxima etapa, destino do dia) + chips.
 *
 * Fase atual: fundo esquemático. Os tiles offline do MapLibre entram aqui
 * como camada de fundo na próxima fase.
 */
class MapRenderer(private val density: Float) {

    var vehicleIcon: Bitmap? = null

    /** Cor da rota à frente (cor da moto quando o tema da moto está ativo). */
    var routeColor: Int = 0xFF2F8CFF.toInt()

    private fun dp(v: Float) = v * density

    fun draw(c: Canvas, width: Int, height: Int, visible: Rect, snap: NavSnapshot?, dark: Boolean, offline: Boolean, offlineLabel: String, routeLabel: String) {
        val bg = if (dark) 0xFF111820.toInt() else 0xFFE9EEF2.toInt()
        val road = if (dark) 0xFF1D2733.toInt() else 0xFFD3DCE3.toInt()
        c.drawColor(bg)

        // Malha de "estradas" de fundo só para dar contexto visual.
        val grid = stroke(road, dp(10f))
        for (i in -2..6) {
            val x = width * i / 5f
            c.drawLine(x, 0f, x + width * 0.25f, height.toFloat(), grid)
        }
        c.drawLine(0f, height * 0.62f, width.toFloat(), height * 0.48f, grid)

        if (snap == null) return

        val panelW = min(dp(300f), visible.width() * 0.42f)
        val mapArea = RectF(
            visible.left + dp(40f), visible.top + dp(40f),
            visible.right - panelW - dp(40f), visible.bottom - dp(70f),
        )
        drawRoute(c, mapArea, snap)
        drawPanel(c, RectF(visible.right - panelW - dp(12f), visible.top + dp(12f), visible.right - dp(12f), visible.bottom - dp(12f)), snap, dark)
        drawChips(c, visible, snap, dark, offline, offlineLabel, routeLabel)
    }

    private fun drawRoute(c: Canvas, area: RectF, snap: NavSnapshot) {
        val pts = snap.points
        if (pts.isEmpty() || area.width() <= 0 || area.height() <= 0) return
        val all = pts.map { it.pos } + listOfNotNull(snap.vehiclePos)

        // Projeção equiretangular ajustada à área (mantém proporção).
        val minLat = all.minOf { it.lat }; val maxLat = all.maxOf { it.lat }
        val minLng = all.minOf { it.lng }; val maxLng = all.maxOf { it.lng }
        val k = cos(Math.toRadians((minLat + maxLat) / 2))
        val spanX = max((maxLng - minLng) * k, 1e-4)
        val spanY = max(maxLat - minLat, 1e-4)
        val scale = min(area.width() / spanX, area.height() / spanY).toFloat()
        val offX = area.left + (area.width() - spanX.toFloat() * scale) / 2
        val offY = area.top + (area.height() - spanY.toFloat() * scale) / 2
        fun project(p: LatLng) = Pair(
            offX + ((p.lng - minLng) * k).toFloat() * scale,
            offY + (maxLat - p.lat).toFloat() * scale,
        )

        val done = Path(); val ahead = Path()
        var lastReached = 0
        pts.forEachIndexed { i, mp -> if (mp.reached) lastReached = i }
        pts.forEachIndexed { i, mp ->
            val (x, y) = project(mp.pos)
            if (i <= lastReached) { if (i == 0) done.moveTo(x, y) else done.lineTo(x, y) }
            if (i >= lastReached) { if (i == lastReached) ahead.moveTo(x, y) else ahead.lineTo(x, y) }
        }
        c.drawPath(done, stroke(0xFF5B6B7C.toInt(), dp(8f)))
        c.drawPath(ahead, stroke(routeColor, dp(10f)))

        pts.forEach { mp ->
            val (x, y) = project(mp.pos)
            val color = when {
                mp.reached -> 0xFF2EA043.toInt()
                mp.kind == StopKind.OVERNIGHT || mp.kind == StopKind.ARRIVAL -> 0xFFA371F7.toInt()
                mp.kind.refuels -> 0xFFF5A524.toInt()
                else -> 0xFF3B8BEB.toInt()
            }
            val r = if (mp.isTarget) dp(11f) else dp(7f)
            c.drawCircle(x, y, r + dp(3f), fill(0xFF0D1117.toInt()))
            c.drawCircle(x, y, r, fill(color))
        }

        snap.vehiclePos?.let { pos ->
            val (x, y) = project(pos)
            val r = dp(26f)
            c.drawCircle(x, y, r, fill(0xFF1F5FAD.toInt()))
            c.drawCircle(x, y, r, stroke(0xFFFFFFFF.toInt(), dp(3f)))
            vehicleIcon?.let { icon ->
                c.drawBitmap(icon, null, RectF(x - r * 0.85f, y - r * 0.6f, x + r * 0.85f, y + r * 0.6f), Paint(Paint.FILTER_BITMAP_FLAG))
            }
        }
    }

    private fun drawPanel(c: Canvas, area: RectF, snap: NavSnapshot, dark: Boolean) {
        val cardBg = if (dark) 0xF0161B22.toInt() else 0xF0FFFFFF.toInt()
        val text = if (dark) 0xFFE6EDF3.toInt() else 0xFF1F2328.toInt()
        val muted = if (dark) 0xFF8B949E.toInt() else 0xFF59636E.toInt()
        val gap = dp(10f)
        val cardH = (area.height() - gap * 2) / 3f
        var top = area.top

        fun card(label: String, title: String, detail: String, extra: ((RectF) -> Unit)? = null) {
            val r = RectF(area.left, top, area.right, top + cardH)
            c.drawRoundRect(r, dp(14f), dp(14f), fill(cardBg))
            val pad = dp(14f)
            var y = r.top + pad + dp(12f)
            c.drawText(label.uppercase(), r.left + pad, y, textPaint(muted, dp(12f)))
            y += dp(26f)
            c.drawText(ellipsize(title, r.width() - pad * 2, dp(20f), bold = true), r.left + pad, y, textPaint(text, dp(20f), bold = true))
            if (extra != null) {
                extra(RectF(r.left + pad, y + dp(10f), r.right - pad, y + dp(18f)))
                y += dp(24f)
            }
            y += dp(22f)
            wrap(detail, r.width() - pad * 2, dp(14f), maxLines = 2).forEach { line ->
                c.drawText(line, r.left + pad, y, textPaint(muted, dp(14f)))
                y += dp(19f)
            }
            top += cardH + gap
        }

        card(labels.autonomy, snap.rangeText, snap.nextFuelText) { bar ->
            c.drawRoundRect(bar, dp(4f), dp(4f), fill(if (dark) 0xFF2B333D.toInt() else 0xFFD8DEE4.toInt()))
            val f = snap.rangeFraction
            val color = when {
                f > 0.5f -> 0xFF2EA043.toInt()
                f > 0.25f -> 0xFFF5A524.toInt()
                else -> 0xFFE5534B.toInt()
            }
            c.drawRoundRect(RectF(bar.left, bar.top, bar.left + bar.width() * f, bar.bottom), dp(4f), dp(4f), fill(color))
        }
        card(snap.stageLabel, snap.stageName, snap.stageDetail)
        card(labels.destination, snap.destinationName, snap.destinationDetail)
    }

    private fun drawChips(c: Canvas, visible: Rect, snap: NavSnapshot, dark: Boolean, offline: Boolean, offlineLabel: String, routeLabel: String) {
        val bgc = if (dark) 0xF0161B22.toInt() else 0xF0FFFFFF.toInt()
        val text = if (dark) 0xFFE6EDF3.toInt() else 0xFF1F2328.toInt()
        var x = visible.left + dp(16f)
        val y = visible.bottom - dp(56f)
        fun chip(label: String, dot: Int? = null) {
            val paint = textPaint(text, dp(15f), bold = true)
            val w = paint.measureText(label) + dp(28f) + (if (dot != null) dp(16f) else 0f)
            val r = RectF(x, y, x + w, y + dp(40f))
            c.drawRoundRect(r, dp(10f), dp(10f), fill(bgc))
            var tx = r.left + dp(14f)
            if (dot != null) { c.drawCircle(tx + dp(5f), r.centerY(), dp(5f), fill(dot)); tx += dp(16f) }
            c.drawText(label, tx, r.centerY() + dp(5f), paint)
            x += w + dp(8f)
        }
        chip(snap.chipRemaining)
        chip(offlineLabel, if (offline) 0xFF2EA043.toInt() else 0xFF3B8BEB.toInt())
        chip(routeLabel)
    }

    /** Rótulos fixos dos cartões, no idioma atual (definidos pela tela). */
    var labels = Labels("Autonomia", "Destino do dia")

    data class Labels(val autonomy: String, val destination: String)

    private fun fill(color: Int) = Paint(Paint.ANTI_ALIAS_FLAG).apply { this.color = color; style = Paint.Style.FILL }
    private fun stroke(color: Int, w: Float) = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        this.color = color; style = Paint.Style.STROKE; strokeWidth = w
        strokeCap = Paint.Cap.ROUND; strokeJoin = Paint.Join.ROUND
    }
    private fun textPaint(color: Int, size: Float, bold: Boolean = false) = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        this.color = color; textSize = size
        typeface = if (bold) Typeface.DEFAULT_BOLD else Typeface.DEFAULT
    }
    /** Quebra o texto em linhas que cabem em [maxW]; a última recebe "…" se sobrar. */
    private fun wrap(s: String, maxW: Float, size: Float, maxLines: Int): List<String> {
        val p = textPaint(0, size)
        val lines = mutableListOf<String>()
        var line = ""
        val words = s.split(" ")
        for ((i, word) in words.withIndex()) {
            val candidate = if (line.isEmpty()) word else "$line $word"
            if (p.measureText(candidate) <= maxW || line.isEmpty()) {
                line = candidate
            } else {
                lines += line
                line = word
                if (lines.size == maxLines - 1) {
                    lines += ellipsize(words.drop(i).joinToString(" "), maxW, size)
                    return lines
                }
            }
        }
        if (line.isNotEmpty()) lines += ellipsize(line, maxW, size)
        return lines
    }

    private fun ellipsize(s: String, maxW: Float, size: Float, bold: Boolean = false): String {
        val p = textPaint(0, size, bold)
        if (p.measureText(s) <= maxW) return s
        var end = s.length
        while (end > 0 && p.measureText(s.substring(0, end) + "…") > maxW) end--
        return s.substring(0, end) + "…"
    }
}
