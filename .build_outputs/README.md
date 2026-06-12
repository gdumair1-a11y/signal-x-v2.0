# V2K Signal-X Offline APK Deployment

This folder contains a fully-configured, offline-capable **native Android Studio wrapper project** prepared specifically for your offline personal usage. 

By running or compiling this wrapper, you will generate a **standalone Android APK** that loads the V2K spectral interception interface entirely locally from the device storage (`file:///android_asset`), ensuring **zero telemetry leaks, 100% offline operability, and full microphone/camera access**.

---

## ⚡ STRUCTURE PROFILE

*   **Runtime Root**: `/.build_outputs/android_project`
*   **Target Application ID**: `com.umair.v2k.frequencyvoice`
*   **Android App Manifest capabilities**: Declares `RECORD_AUDIO`, `CAMERA`, `ACCESS_FINE_LOCATION`, and `MODIFY_AUDIO_SETTINGS` permissions.
*   **Bundled Assets**: All compiled static HTML/CSS/JavaScript are optimized with safe relative paths and integrated into `.../app/src/main/assets/www`.

---

## 🛠️ HOW TO COMPILE THE OFFLINE .APK (RECOMMENDED)

You can compile this Android project into a production-ready `.apk` file using any computer with **Android Studio** or **Gradle** installed:

### Option A: Using Android Studio (Visual & Simple)
1.  **Download project**: Export or download this workspace from code settings/GitHub import.
2.  **Open Android Studio**: Select **File** -> **New** -> **Import Project** and navigate to select the `/.build_outputs/android_project` directory.
3.  **Sync Gradle**: Allow Android Studio to complete the automatic Gradle synchronization.
4.  **Assemble APK**:
    *   Go to **Build** on the top menu bar.
    *   Click **Build Bundle(s) / APK(s)** -> **Build APK(s)**.
5.  **Locate APK**: Android Studio will trigger a notification popup in the bottom right corner showing the build completed. Click **locate** to locate the compiled `app-debug.apk` output file. Directly install this file on your android handset!

### Option B: Command Line (Fast & Automated)
If you have Gradle installed on your local development machine, open your terminal at `/.build_outputs/android_project/` and run:

**On Mac/Linux:**
```bash
chmod +x gradlew
./gradlew assembleDebug
```

**On Windows:**
```cmd
gradlew.bat assembleDebug
```
The compiled APK will immediately write to:
`android_project/app/build/outputs/apk/debug/app-debug.apk`

---

## 📱 ALTERNATIVE METHOD: PWA CLIENT ENGINE (NO COMPILING REQUIRED)

If you are currently browsing this application on an Android or iOS device:
1.  Open the **header menu** in the top-right corner of the application interface.
2.  Click **INSTALL DEVICE / APK**.
3.  Open the **1-Click Install** tab and select **INSTANT SYSTEM CHECK / INSTALL DEVICE**.
4.  This adds the standalone app directly onto your home screen launcher as an offline WebAPK under 1 second.
