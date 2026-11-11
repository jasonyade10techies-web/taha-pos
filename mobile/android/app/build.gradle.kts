plugins { id("com.android.application") }
android {
    namespace = "com.tahamobiles.staff"
    compileSdk = 35
    defaultConfig {
        applicationId = "com.tahamobiles.staff"
        minSdk = 26
        targetSdk = 35
        versionCode = 10
        versionName = "0.5D.2"
    }
    buildFeatures { buildConfig = true }
    sourceSets.getByName("main").assets.srcDir("../../../dist-mobile")
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    buildTypes {
        debug { applicationIdSuffix = ".debug"; versionNameSuffix = "-test" }
        release { isMinifyEnabled = false }
    }
    lint { abortOnError = true }
}
dependencies {
    // AndroidX pulls newer stdlib; align legacy JDK variants to avoid duplicate classes.
    implementation(platform("org.jetbrains.kotlin:kotlin-bom:1.8.22"))
    implementation("androidx.core:core:1.15.0")
    implementation("androidx.webkit:webkit:1.12.1")
    implementation("androidx.activity:activity:1.9.3")
    implementation("com.journeyapps:zxing-android-embedded:4.3.0")
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.json:json:20240303")
}

