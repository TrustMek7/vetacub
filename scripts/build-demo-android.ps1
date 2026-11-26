param(
    [Parameter(Mandatory)]
    [string]$Keystore,
    [Parameter(Mandatory)]
    [string]$Alias,
    [string]$Architectures = 'arm64-v8a,x86_64'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$keyFile = (Resolve-Path -LiteralPath $Keystore).Path
$sdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
$apksigner = Join-Path $sdk 'build-tools\37.0.0\apksigner.bat'
if (!(Test-Path -LiteralPath $apksigner)) {
    throw 'Instala Android SDK Build-Tools 37.0.0 o corrige ANDROID_HOME.'
}

Push-Location -LiteralPath $root
try {
    $env:ANDROID_HOME = $sdk
    $env:ANDROID_SDK_ROOT = $sdk
    & npx.cmd expo prebuild --platform android --no-install --no-clean
    if ($LASTEXITCODE) { throw 'Expo prebuild falló.' }

    # Reduce las rutas de Ninja al generar objetos C++ en Windows.
    $gradleFile = Join-Path $root 'android\app\build.gradle'
    $gradle = [IO.File]::ReadAllText($gradleFile)
    if (!$gradle.Contains('CMAKE_OBJECT_PATH_MAX')) {
        $anchor = '    defaultConfig {'
        if (!$gradle.Contains($anchor)) { throw 'No se encontró defaultConfig en el proyecto Android generado.' }
        $config = @'
    defaultConfig {
        externalNativeBuild {
            cmake {
                arguments '-DCMAKE_OBJECT_PATH_MAX=240'
            }
        }
'@
        $staging = @'
android {
    externalNativeBuild {
        cmake {
            buildStagingDirectory rootProject.file('../.cxx')
        }
    }
'@
        $gradle = $gradle.Replace('android {', $staging.TrimEnd()).Replace($anchor, $config.TrimEnd())
        [IO.File]::WriteAllText($gradleFile, $gradle)
    }

    & .\android\gradlew.bat -p android :app:assembleRelease "-PreactNativeArchitectures=$Architectures" --console=plain
    if ($LASTEXITCODE) { throw 'La compilación release de Android falló.' }

    $version = (Get-Content -LiteralPath 'app.json' -Raw | ConvertFrom-Json).expo.version
    $apk = "dist\VetaCub-demo-$version.apk"
    New-Item -ItemType Directory -Path 'dist' -Force | Out-Null
    $signOptions = @('--ks', $keyFile, '--ks-key-alias', $Alias)
    if ($env:VETACUB_KEYSTORE_PASSWORD) {
        $signOptions += @('--ks-pass', 'env:VETACUB_KEYSTORE_PASSWORD')
    }
    & $apksigner sign @signOptions --out $apk 'android\app\build\outputs\apk\release\app-release.apk'
    if ($LASTEXITCODE) { throw 'La firma del APK falló.' }
    & $apksigner verify --print-certs $apk
    if ($LASTEXITCODE) { throw 'La verificación de la firma del APK falló.' }
    Get-Item -LiteralPath $apk
    Get-FileHash -LiteralPath $apk -Algorithm SHA256
}
finally {
    Pop-Location
}
