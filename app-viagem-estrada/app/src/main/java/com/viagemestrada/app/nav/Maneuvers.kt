package com.viagemestrada.app.nav

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.Path
import androidx.car.app.navigation.model.Maneuver
import com.viagemestrada.app.R
import com.viagemestrada.app.data.Units
import com.viagemestrada.core.RouteStep
import java.util.Locale
import kotlin.math.roundToInt

/** Texto, seta e tipo (Android Auto) das manobras vindas do OSRM. */
object Maneuvers {

    private fun dir(ctx: Context, m: String?) = ctx.getString(
        when (m) {
            "right" -> R.string.d_right; "left" -> R.string.d_left
            "slight right" -> R.string.d_sright; "slight left" -> R.string.d_sleft
            "sharp right" -> R.string.d_shright; "sharp left" -> R.string.d_shleft
            else -> R.string.d_straight
        },
    )

    fun instruction(ctx: Context, st: RouteStep): String {
        val m = st.modifier ?: "straight"
        val base = when {
            st.type == "arrive" -> return ctx.getString(R.string.i_arrive)
            m == "uturn" -> ctx.getString(R.string.i_uturn)
            st.type == "turn" && m != "straight" -> ctx.getString(R.string.i_turn, dir(ctx, m))
            st.type == "merge" -> ctx.getString(R.string.i_merge, dir(ctx, m))
            st.type == "on ramp" -> ctx.getString(R.string.i_onramp, dir(ctx, m))
            st.type == "off ramp" -> ctx.getString(R.string.i_offramp, dir(ctx, m))
            st.type == "fork" -> ctx.getString(R.string.i_fork, dir(ctx, m))
            st.type == "end of road" -> ctx.getString(R.string.i_end, dir(ctx, m))
            "roundabout" in st.type || "rotary" in st.type -> ctx.getString(R.string.i_round, st.exit ?: 1)
            else -> ctx.getString(R.string.i_cont, dir(ctx, m))
        }
        return if (st.road.isNotBlank()) "$base · ${st.road}" else base
    }

    /** Tipo de manobra do Android Auto (o carro pode usar para o painel/HUD). */
    fun carType(st: RouteStep): Int {
        val m = st.modifier ?: "straight"
        val right = "right" in m
        return when {
            st.type == "arrive" -> Maneuver.TYPE_DESTINATION
            m == "uturn" -> Maneuver.TYPE_U_TURN_LEFT
            "roundabout" in st.type || "rotary" in st.type -> Maneuver.TYPE_ROUNDABOUT_ENTER_AND_EXIT_CCW
            st.type == "fork" -> if (right) Maneuver.TYPE_FORK_RIGHT else Maneuver.TYPE_FORK_LEFT
            st.type == "merge" -> if (right) Maneuver.TYPE_MERGE_RIGHT else Maneuver.TYPE_MERGE_LEFT
            st.type == "on ramp" -> if (right) Maneuver.TYPE_ON_RAMP_NORMAL_RIGHT else Maneuver.TYPE_ON_RAMP_NORMAL_LEFT
            st.type == "off ramp" -> if (right) Maneuver.TYPE_OFF_RAMP_NORMAL_RIGHT else Maneuver.TYPE_OFF_RAMP_NORMAL_LEFT
            m == "straight" -> Maneuver.TYPE_STRAIGHT
            m.startsWith("slight") -> if (right) Maneuver.TYPE_TURN_SLIGHT_RIGHT else Maneuver.TYPE_TURN_SLIGHT_LEFT
            m.startsWith("sharp") -> if (right) Maneuver.TYPE_TURN_SHARP_RIGHT else Maneuver.TYPE_TURN_SHARP_LEFT
            else -> if (right) Maneuver.TYPE_TURN_NORMAL_RIGHT else Maneuver.TYPE_TURN_NORMAL_LEFT
        }
    }

    /** Seta branca da manobra (bitmap quadrado). */
    fun arrow(st: RouteStep?, size: Int): Bitmap {
        val bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        val c = Canvas(bmp); c.scale(size / 48f, size / 48f)
        val p = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = 0xFFFFFFFF.toInt(); style = Paint.Style.STROKE; strokeWidth = 5f
            strokeCap = Paint.Cap.ROUND; strokeJoin = Paint.Join.ROUND
        }
        val m = st?.modifier ?: "straight"; val type = st?.type ?: "continue"
        val path = Path()
        when {
            "roundabout" in type || "rotary" in type -> {
                c.drawCircle(24f, 20f, 8f, p); path.moveTo(24f, 44f); path.lineTo(24f, 28f)
                path.moveTo(31f, 14f); path.lineTo(38f, 8f); path.moveTo(38f, 8f); path.lineTo(38f, 16f); path.moveTo(38f, 8f); path.lineTo(30f, 8f)
            }
            m == "uturn" -> { path.moveTo(30f, 44f); path.lineTo(30f, 20f); path.arcTo(14f, 12f, 30f, 28f, 0f, -180f, false); path.lineTo(14f, 30f); path.moveTo(7f, 26f); path.lineTo(14f, 34f); path.lineTo(21f, 26f) }
            m == "straight" || type == "arrive" -> { path.moveTo(24f, 44f); path.lineTo(24f, 8f); path.moveTo(12f, 20f); path.lineTo(24f, 8f); path.lineTo(36f, 20f) }
            m.startsWith("slight") -> { path.moveTo(18f, 44f); path.lineTo(18f, 26f); path.lineTo(32f, 10f); path.moveTo(24f, 9f); path.lineTo(33f, 9f); path.lineTo(33f, 18f) }
            m.startsWith("sharp") -> { path.moveTo(16f, 44f); path.lineTo(16f, 14f); path.lineTo(34f, 36f); path.moveTo(36f, 26f); path.lineTo(36f, 37f); path.lineTo(25f, 37f) }
            else -> { path.moveTo(16f, 44f); path.lineTo(16f, 22f); path.quadTo(16f, 16f, 22f, 16f); path.lineTo(40f, 16f); path.moveTo(32f, 8f); path.lineTo(40f, 16f); path.lineTo(32f, 24f) }
        }
        if ("left" in m && m != "straight") path.transform(Matrix().apply { setScale(-1f, 1f, 24f, 24f) })
        c.drawPath(path, p)
        return bmp
    }

    /** Distância curta para o cartão de manobra: "350 m", "1,6 km". */
    fun distance(meters: Double, units: Units): String = when (units) {
        Units.MI -> {
            val mi = meters / 1609.344
            if (mi < 0.2) "${(meters * 3.28084 / 50).roundToInt() * 50} ft" else String.format(Locale.getDefault(), if (mi < 10) "%.1f mi" else "%.0f mi", mi)
        }
        Units.KM -> when {
            meters < 100 -> "${maxOf(10, (meters / 10).roundToInt() * 10)} m"
            meters < 1000 -> "${(meters / 50).roundToInt() * 50} m"
            else -> String.format(Locale.getDefault(), if (meters < 10_000) "%.1f km" else "%.0f km", meters / 1000)
        }
    }
}
