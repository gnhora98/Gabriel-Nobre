package com.viagemestrada.app

import android.app.Application
import com.viagemestrada.app.data.TripRepository

class ViagemApp : Application() {
    val repository: TripRepository by lazy { TripRepository.get(this) }

    override fun onCreate() {
        super.onCreate()
        // Inicializa o MapLibre (mapa offline: sem chave e sem servidor).
        // (em testes na JVM a biblioteca nativa não existe: ignora)
        runCatching { org.maplibre.android.MapLibre.getInstance(this) }
    }
}
