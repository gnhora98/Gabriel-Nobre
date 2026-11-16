plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.kotlin.plugin.serialization")
}

android {
    namespace = "com.viagemestrada.app"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.viagemestrada.app"
        minSdk = 26
        targetSdk = 36
        versionCode = 3
        versionName = "0.3.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            // Protótipo distribuído por sideload: assina o release com a chave de debug.
            signingConfig = signingConfigs.getByName("debug")
        }
    }

    // A viagem de teste vem direto de dados/, sem cópia.
    sourceSets["main"].assets.srcDir("../dados")

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        compose = true
    }

    androidResources {
        generateLocaleConfig = true
        // Tiles do mapa já são compactados; não recompactar no APK.
        noCompress += listOf("pbf")
    }

    // Testes de tela na JVM (Robolectric) geram as capturas em docs/telas/.
    testOptions {
        unitTests {
            isIncludeAndroidResources = true
            all {
                it.systemProperty("roborazzi.test.record", "true")
                it.systemProperty("screens.dir", rootProject.file("docs/telas").absolutePath)
                it.maxHeapSize = "3g"
            }
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
    }
}

dependencies {
    implementation(project(":core"))

    implementation("androidx.core:core-ktx:1.17.0")
    implementation("androidx.appcompat:appcompat:1.7.1")
    implementation("androidx.activity:activity-compose:1.12.2")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.9.4")

    implementation(platform("androidx.compose:compose-bom:2025.12.01"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.ui:ui-tooling-preview")
    debugImplementation("androidx.compose.ui:ui-tooling")

    // Android Auto (Car App Library), categoria NAVIGATION.
    implementation("androidx.car.app:app:1.7.0")

    // Mapa vetorial offline (tiles do OpenStreetMap embutidos em assets/mapa).
    implementation("org.maplibre.gl:android-sdk:11.13.5")

    testImplementation("junit:junit:4.13.2")
    testImplementation("org.robolectric:robolectric:4.16.1")
    testImplementation("io.github.takahirom.roborazzi:roborazzi:1.77.0")
    testImplementation("io.github.takahirom.roborazzi:roborazzi-compose:1.77.0")
    testImplementation(platform("androidx.compose:compose-bom:2025.12.01"))
    testImplementation("androidx.compose.ui:ui-test-junit4")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
    testImplementation("androidx.test:core-ktx:1.7.0")
}
