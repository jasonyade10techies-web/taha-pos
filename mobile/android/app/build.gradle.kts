import java.util.Properties
plugins { id("com.android.application") }
val releaseVersion = Properties().apply { rootProject.file("release.properties").inputStream().use { load(it) } }
android {
    namespace = "com.tahamobiles.staff"
    compileSdk = 35
    defaultConfig {
        applicationId = "com.tahamobiles.staff"
        minSdk = 26
        targetSdk = 35
        versionCode = releaseVersion.getProperty("versionCode").toInt()
        versionName = releaseVersion.getProperty("versionName")
    }
    buildFeatures { buildConfig = true }
    sourceSets.getByName("main").assets.srcDir("../../../dist-mobile")
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    signingConfigs {
        if (System.getenv("TAHA_ANDROID_KEYSTORE") != null) create("approved") {
            storeFile = file(System.getenv("TAHA_ANDROID_KEYSTORE")); storePassword = System.getenv("TAHA_ANDROID_STORE_PASSWORD")
            keyAlias = System.getenv("TAHA_ANDROID_KEY_ALIAS"); keyPassword = System.getenv("TAHA_ANDROID_KEY_PASSWORD")
        }
    }
    buildTypes {
        debug { applicationIdSuffix = ".debug"; versionNameSuffix = "-test"; if (signingConfigs.findByName("approved") != null) signingConfig = signingConfigs.getByName("approved") }
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

