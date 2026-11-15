package com.viagemestrada.core

import java.io.File
import java.time.LocalDate
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class CoreTest {
    // Os testes rodam com o diretório do módulo `core` como diretório atual.
    private val trip = Trip.fromJson(File("../dados/viagem-exemplo.json").readText())
    private val nav = TripNavigator(trip)

    private fun stop(km: Double, type: String = "abastecer") =
        Stop(time = "00:00", km = km, name = "km $km", type = type)

    // ---- Modelo ----

    @Test fun `le a viagem de exemplo`() {
        assertEquals(8, trip.days.size)
        assertEquals("Royal Enfield Meteor 650", trip.vehicle.model)
        assertEquals(listOf(115.0, 255.0, 415.0, 520.0), trip.days[0].stops.filter { it.isFuel }.map { it.km })
        assertEquals(StopKind.OVERNIGHT, trip.days[0].stops.last().kind)
        assertEquals(StopKind.ARRIVAL, trip.days[7].stops.last().kind)
    }

    @Test fun `autonomia util bate com o intervalo de abastecimento do JSON`() {
        assertEquals(140.0, trip.vehicle.usableRangeKm, 1e-9)
        assertEquals(trip.rules.fuelIntervalKm!!, trip.vehicle.usableRangeKm, 1e-9)
    }

    // ---- Geo ----

    @Test fun `haversine Salvador a Fortaleza`() {
        val d = Geo.distanceKm(LatLng(-12.9714, -38.5014), LatLng(-3.7319, -38.5267))
        assertTrue(d in 1000.0..1050.0, "distância inesperada: $d")
    }

    @Test fun `conversao de horario`() {
        assertEquals(930, Geo.timeToMinutes("15:30"))
        assertEquals("05:07", Geo.minutesToTime(307))
        assertEquals("23:59", Geo.minutesToTime(-1))
    }

    // ---- Postos ----

    @Test fun `dia 1 tem um trecho acima da autonomia`() {
        val gaps = FuelPlanner.gaps(trip.days[0], trip.vehicle.usableRangeKm)
        assertEquals(listOf(FuelGap(255.0, 415.0)), gaps)
    }

    @Test fun `dia 2 fica dentro da autonomia`() {
        assertTrue(FuelPlanner.gaps(trip.days[1], trip.vehicle.usableRangeKm).isEmpty())
    }

    @Test fun `proximo posto e o mais distante alcancavel`() {
        val c = listOf(stop(100.0), stop(130.0), stop(200.0))
        assertEquals(130.0, FuelPlanner.nextFuelStop(c, 0.0, 140.0)?.km)
        assertEquals(100.0, FuelPlanner.nextFuelStop(c, 0.0, 140.0, endKm = 110.0)?.km)
        assertNull(FuelPlanner.nextFuelStop(listOf(stop(300.0)), 0.0, 140.0))
    }

    @Test fun `sugestao cobre o trecho na ordem do percurso`() {
        val c = listOf(stop(100.0), stop(200.0), stop(300.0), stop(400.0))
        assertEquals(listOf(100.0, 200.0, 300.0, 400.0), FuelPlanner.suggest(c, 0.0, 500.0, 140.0).map { it.km })
        assertTrue(FuelPlanner.suggest(listOf(stop(300.0)), 0.0, 500.0, 140.0).isEmpty())
    }

    // ---- Progresso ----

    @Test fun `avanca e troca de dia`() {
        var p = TripProgress()
        assertEquals("Posto Linha Verde – Subaúma (BA-099)", nav.target(p)?.name)
        repeat(trip.days[0].stops.size) { p = nav.advance(p) }
        assertEquals(TripProgress(dayIndex = 1, stopIndex = 0), p)
    }

    @Test fun `volta para o ultimo do dia anterior`() {
        val p = nav.back(TripProgress(dayIndex = 1, stopIndex = 0))
        assertEquals(TripProgress(dayIndex = 0, stopIndex = trip.days[0].stops.lastIndex), p)
        assertEquals(TripProgress(), nav.back(TripProgress()))
    }

    @Test fun `termina na ultima parada`() {
        var p = TripProgress(dayIndex = 7)
        repeat(trip.days[7].stops.size) { p = nav.advance(p) }
        assertTrue(p.done)
        assertNull(nav.target(p))
        assertFalse(nav.back(p).done)
    }

    @Test fun `autonomia restante conta desde o ultimo posto`() {
        // Dia 1: alvo = 3ª parada (km 415); última alcançada = posto km 255.
        val p = TripProgress(dayIndex = 0, stopIndex = 2)
        assertEquals(255.0, nav.reachedKm(p))
        assertEquals(255.0, nav.lastFuelKm(p))
        assertEquals(140.0, nav.remainingRangeKm(p))
        assertEquals(80.0, nav.remainingRangeKm(p, currentKm = 315.0))
        assertEquals(0.0, nav.remainingRangeKm(p, currentKm = 999.0))
        assertEquals(325.0, nav.remainingDayKm(p))
        assertEquals(415.0, nav.nextFuelStop(p)?.km)
    }

    @Test fun `saida do dia comeca com tanque cheio`() {
        val p = TripProgress(dayIndex = 3)
        assertEquals(0.0, nav.lastFuelKm(p))
        assertEquals(140.0, nav.remainingRangeKm(p))
        assertEquals("Nirvana Pipa", nav.dayDestination(p)?.name)
    }

    @Test fun `detecta chegada na parada`() {
        val p = TripProgress()
        val s = nav.target(p)!!
        assertTrue(nav.hasArrived(p, LatLng(s.lat!!, s.lng!!)))
        assertTrue(nav.hasArrived(p, LatLng(s.lat!! + 0.002, s.lng!!))) // ~220 m
        assertFalse(nav.hasArrived(p, LatLng(s.lat!! + 0.01, s.lng!!))) // ~1,1 km
    }

    // ---- Pôr do sol ----

    @Test fun `por do sol em Pipa no fim de dezembro`() {
        val min = assertNotNull(Sun.sunsetMinutes(LocalDate.of(2026, 12, 29), -6.23, -35.05))
        assertTrue(min in Geo.timeToMinutes("17:15")..Geo.timeToMinutes("17:40"), Geo.minutesToTime(min))
    }

    @Test fun `por do sol em Salvador em dezembro`() {
        val min = assertNotNull(Sun.sunsetMinutes(LocalDate.of(2026, 12, 14), -12.97, -38.50))
        assertTrue(min in Geo.timeToMinutes("17:35")..Geo.timeToMinutes("18:00"), Geo.minutesToTime(min))
    }
}
