package com.viagemestrada.core

import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

class RouteTrackTest {
    private val trip = Trip.fromJson(File("../dados/teste-stella-maris.json").readText())
    private val track = RouteTrack(DayRoute.listFromJson(File("../dados/rotas/teste-stella-maris.json").readText())[0])

    @Test fun `viagem de teste tem 4 etapas e volta para casa`() {
        assertEquals("teste-stella-maris", trip.id)
        val stops = trip.days[0].stops
        assertEquals(listOf("Colégio Marízia Maior", "Redemix Supermercado", "Paróquia Nossa Senhora de Fátima", "Casa · Rua Ítalo Gaudenzi"), stops.map { it.name })
        assertEquals(StopKind.ARRIVAL, stops.last().kind)
    }

    @Test fun `rota real tem cerca de 5,3 km e uma perna por parada`() {
        assertTrue(track.totalMeters in 5000.0..5600.0, "total ${track.totalMeters}")
        assertEquals(trip.days[0].stops.size, track.legEnds.size)
        assertEquals(track.totalMeters, track.legEnds.last(), 1.0)
    }

    @Test fun `cada perna termina perto da parada`() {
        trip.days[0].stops.forEachIndexed { i, s ->
            val end = track.pointAt(track.legEnds[i])
            val d = Geo.distanceKm(end, LatLng(s.lat!!, s.lng!!)) * 1000
            assertTrue(d < 60, "${s.name}: ${d} m")
        }
    }

    @Test fun `projecao do GPS volta a distancia ao longo da rota`() {
        val s = 2100.0
        val (proj, off) = track.project(track.pointAt(s), hintMeters = 1800.0)
        assertEquals(s, proj, 5.0)
        assertTrue(off < 1.0)
    }

    @Test fun `tem manobra a frente e direcao valida`() {
        val up = assertNotNull(track.nextStep(0.0))
        assertTrue(up.distanceMeters > 0)
        assertTrue(track.bearingAt(500.0) in 0.0..360.0)
        assertTrue(track.roadAt(10.0).isNotBlank())
    }
}
