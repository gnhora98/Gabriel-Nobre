package com.viagemestrada.app.car

import android.content.Intent
import androidx.car.app.CarAppService
import androidx.car.app.Screen
import androidx.car.app.Session
import androidx.car.app.validation.HostValidator

/**
 * Entrada do Android Auto. Categoria NAVIGATION (no manifest) permite
 * desenhar o próprio mapa na Surface do carro.
 */
class ViagemCarAppService : CarAppService() {

    // Protótipo por sideload: aceita qualquer host (Android Auto, DHU de testes).
    override fun createHostValidator(): HostValidator = HostValidator.ALLOW_ALL_HOSTS_VALIDATOR

    override fun onCreateSession(): Session = TripSession()
}

class TripSession : Session() {
    override fun onCreateScreen(intent: Intent): Screen = WelcomeScreen(carContext)
}
