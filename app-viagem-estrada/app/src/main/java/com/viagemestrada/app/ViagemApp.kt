package com.viagemestrada.app

import android.app.Application
import com.viagemestrada.app.data.TripRepository

class ViagemApp : Application() {
    val repository: TripRepository by lazy { TripRepository.get(this) }
}
