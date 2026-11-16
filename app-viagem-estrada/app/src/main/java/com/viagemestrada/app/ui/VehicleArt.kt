package com.viagemestrada.app.ui

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import com.viagemestrada.app.data.VehicleModel
import kotlin.math.abs
import kotlin.math.cos

/**
 * Ilustração do veículo (vista lateral), usada na garagem, na tela de boas-
 * vindas do carro e como ícone no mapa. Substitui o modelo 3D até a fase do
 * SceneView/glTF: o "giro" é uma rotação simulada no eixo vertical.
 */
object VehicleArt {

    fun bitmap(model: VehicleModel, color: Int, width: Int, height: Int, rotationDeg: Float = 0f): Bitmap {
        val bmp = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        draw(Canvas(bmp), model, color, width.toFloat(), height.toFloat(), rotationDeg)
        return bmp
    }

    fun draw(c: Canvas, model: VehicleModel, color: Int, w: Float, h: Float, rotationDeg: Float = 0f) {
        val scaleX = cos(Math.toRadians(rotationDeg.toDouble())).toFloat()
            .let { if (abs(it) < 0.12f) 0.12f * (if (it < 0) -1 else 1) else it }
        c.save()
        c.translate(w / 2, h / 2)
        c.scale(scaleX, 1f)
        c.translate(-w / 2, -h / 2)
        // Sombra no chão.
        c.drawOval(RectF(w * 0.12f, h * 0.84f, w * 0.88f, h * 0.94f), fill(0x55000000))
        if (model.isMoto) drawMoto(c, model, color, w, h) else drawCar(c, model, color, w, h)
        c.restore()
    }

    private fun drawMoto(c: Canvas, model: VehicleModel, color: Int, w: Float, h: Float) {
        val trail = model == VehicleModel.TRAIL
        val r = h * (if (trail) 0.21f else 0.19f)
        val wheelY = h * 0.86f - r
        val rearX = w * 0.25f
        val frontX = w * 0.75f
        val tire = fill(0xFF2B313B.toInt())
        val rim = stroke(0xFF8B95A5.toInt(), h * 0.025f)
        val frame = stroke(0xFF9AA4B2.toInt(), h * 0.035f)
        for (x in listOf(rearX, frontX)) {
            c.drawCircle(x, wheelY, r, tire)
            c.drawCircle(x, wheelY, r * 0.62f, fill(0xFF1A1F27.toInt()))
            c.drawCircle(x, wheelY, r * 0.62f, rim)
            c.drawCircle(x, wheelY, r * 0.16f, fill(0xFFB8C0CC.toInt()))
        }
        val seatY = h * (if (trail) 0.38f else 0.45f)
        // Quadro e garfo.
        c.drawLine(rearX, wheelY, w * 0.47f, seatY + h * 0.08f, frame)
        c.drawLine(w * 0.47f, seatY + h * 0.08f, w * 0.52f, wheelY - r * 0.2f, frame)
        c.drawLine(frontX, wheelY, w * 0.66f, seatY - h * 0.1f, frame)
        // Motor.
        c.drawRoundRect(RectF(w * 0.42f, seatY + h * 0.1f, w * 0.58f, wheelY + r * 0.1f), h * 0.03f, h * 0.03f, fill(0xFF4A5260.toInt()))
        // Banco.
        c.drawRoundRect(RectF(w * 0.22f, seatY - h * 0.03f, w * 0.46f, seatY + h * 0.05f), h * 0.04f, h * 0.04f, fill(0xFF2A1F1A.toInt()))
        // Tanque (cor do veículo).
        val tank = Path().apply {
            moveTo(w * 0.44f, seatY + h * 0.04f)
            quadTo(w * 0.47f, seatY - h * 0.12f, w * 0.6f, seatY - h * 0.09f)
            quadTo(w * 0.68f, seatY - h * 0.06f, w * 0.64f, seatY + h * 0.05f)
            close()
        }
        c.drawPath(tank, fill(color))
        // Paralamas.
        val fender = stroke(color, h * 0.04f)
        c.drawArc(RectF(frontX - r * 1.1f, wheelY - r * 1.1f, frontX + r * 1.1f, wheelY + r * 1.1f), 200f, 110f, false, fender)
        c.drawArc(RectF(rearX - r * 1.1f, wheelY - r * 1.1f, rearX + r * 1.1f, wheelY + r * 1.1f), 220f, 100f, false, fender)
        // Guidão e farol.
        c.drawLine(w * 0.66f, seatY - h * 0.1f, w * 0.71f, seatY - h * 0.2f, stroke(0xFFD0D6DE.toInt(), h * 0.025f))
        c.drawCircle(w * 0.74f, seatY - h * 0.08f, h * 0.045f, fill(0xFFF5EBC8.toInt()))
        // Baú/alforje da viagem (custom e Meteor).
        if (!trail) c.drawRoundRect(RectF(w * 0.08f, seatY - h * 0.1f, w * 0.22f, seatY + h * 0.06f), h * 0.02f, h * 0.02f, fill(0xFF2A303A.toInt()))
    }

    private fun drawCar(c: Canvas, model: VehicleModel, color: Int, w: Float, h: Float) {
        val tall = when (model) { VehicleModel.SUV -> 0.1f; VehicleModel.HATCH -> 0.04f; else -> 0f }
        val r = h * (if (model == VehicleModel.SUV) 0.15f else 0.13f)
        val wheelY = h * 0.86f - r
        val bodyTop = h * (0.5f - tall)
        val roofTop = h * (0.27f - tall)
        val rearEnd = if (model == VehicleModel.HATCH) w * 0.12f else w * 0.06f
        val body = Path().apply {
            moveTo(rearEnd, wheelY + r * 0.2f)
            lineTo(rearEnd, bodyTop + h * 0.04f)
            quadTo(rearEnd, bodyTop, rearEnd + w * 0.05f, bodyTop)
            lineTo(w * 0.27f, bodyTop)
            lineTo(w * 0.36f, roofTop)
            lineTo(if (model == VehicleModel.SEDAN) w * 0.6f else w * 0.66f, roofTop)
            lineTo(w * 0.74f, bodyTop)
            lineTo(w * 0.9f, bodyTop + h * 0.04f)
            quadTo(w * 0.95f, bodyTop + h * 0.06f, w * 0.95f, bodyTop + h * 0.14f)
            lineTo(w * 0.95f, wheelY + r * 0.2f)
            close()
        }
        c.drawPath(body, fill(color))
        // Vidros.
        val glass = fill(0xFF1F2A36.toInt())
        c.drawPath(Path().apply {
            moveTo(w * 0.3f, bodyTop - h * 0.01f); lineTo(w * 0.375f, roofTop + h * 0.03f)
            lineTo(w * 0.5f, roofTop + h * 0.03f); lineTo(w * 0.5f, bodyTop - h * 0.01f); close()
        }, glass)
        c.drawPath(Path().apply {
            val end = if (model == VehicleModel.SEDAN) w * 0.59f else w * 0.65f
            moveTo(w * 0.52f, bodyTop - h * 0.01f); lineTo(w * 0.52f, roofTop + h * 0.03f)
            lineTo(end, roofTop + h * 0.03f); lineTo(w * 0.71f, bodyTop - h * 0.01f); close()
        }, glass)
        // Faróis e lanternas.
        c.drawRoundRect(RectF(w * 0.9f, bodyTop + h * 0.06f, w * 0.95f, bodyTop + h * 0.1f), 6f, 6f, fill(0xFFF5EBC8.toInt()))
        c.drawRoundRect(RectF(rearEnd, bodyTop + h * 0.05f, rearEnd + w * 0.025f, bodyTop + h * 0.1f), 6f, 6f, fill(0xFFD93A3A.toInt()))
        for (x in listOf(w * 0.24f, w * 0.78f)) {
            c.drawCircle(x, wheelY, r * 1.12f, fill(0xFF0F1318.toInt()))
            c.drawCircle(x, wheelY, r, fill(0xFF2B313B.toInt()))
            c.drawCircle(x, wheelY, r * 0.55f, fill(0xFF8B95A5.toInt()))
        }
    }

    private fun fill(color: Int) = Paint(Paint.ANTI_ALIAS_FLAG).apply { this.color = color; style = Paint.Style.FILL }
    private fun stroke(color: Int, width: Float) = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        this.color = color; style = Paint.Style.STROKE; strokeWidth = width; strokeCap = Paint.Cap.ROUND
    }

    /** Cores inspiradas nas pinturas da linha Meteor 650. */
    val palette: List<Long> = listOf(
        0xFFA3211F, // Stellar Red
        0xFFE2611B, // Fireball Orange
        0xFFE3A81A, // Fireball Yellow
        0xFF1F3F8F, // Stellar Blue
        0xFF3E5B41, // Astral Green
        0xFF5B3A29, // Supernova Brown
        0xFF16181C, // Astral Black
        0xFFE6E8EB, // Branco
    )

    fun Long.argb(): Int = (this and 0xFFFFFFFF).toInt()
}
