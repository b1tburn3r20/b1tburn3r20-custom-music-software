# b1tburn3r20 installer for Windows. Needs no admin rights, and installs nothing system-wide.
#
#   irm https://github.com/b1tburn3r20/b1tburn3r20-custom-music-software/releases/latest/download/install.ps1 | iex
#
# Options, because `iex` can't pass arguments, are environment variables:
#   $env:B1T_CHECK_ONLY = 1   Report what's missing, and stop.
#   $env:B1T_YES = 1          Don't ask questions.
#   $env:B1T_VERSION = "x.y.z"
#   $env:B1T_FORCE = 1        Allow installing an older version.
#   $env:B1T_UNINSTALL = 1
# When run as a file, the same options work as -CheckOnly, -Yes, -Version, -Force, -Uninstall.
param(
    [switch]$CheckOnly,
    [switch]$Yes,
    [string]$Version = "",
    [switch]$Force,
    [switch]$Uninstall,
    [switch]$NoLaunch
)

# Stamped at release time. Everything downloaded is checked against these.
$script:ReleaseVersion = "__B1T_VERSION__"
$script:SourceSha256 = "__B1T_SOURCE_SHA256__"
$script:Repo = "https://github.com/b1tburn3r20/b1tburn3r20-custom-music-software"
$script:NodeVersion = "26.13.0"
$script:NodeHashes = @{
    "x64"   = "__NODE_SHA_win-x64__"
    "arm64" = "__NODE_SHA_win-arm64__"
}
$script:MinFreeGB = 2

function Write-Check([string]$Label, [bool]$Ok, [string]$Detail) {
    $mark = if ($Ok) { "ok  " } else { "FAIL" }
    Write-Host ("  [{0}] {1,-16} {2}" -f $mark, $Label, $Detail)
}

function Test-Host([string]$Url) {
    try {
        $null = Invoke-WebRequest -Uri $Url -Method Head -UseBasicParsing -TimeoutSec 15 -MaximumRedirection 5
        return $true
    } catch [System.Net.WebException] {
        # Any HTTP answer, even an error, proves the host can be reached.
        return ($null -ne $_.Exception.Response)
    } catch {
        return $false
    }
}

function Test-Preflight([string]$Root) {
    Write-Host "`nChecking this computer:"
    $ok = $true

    $build = [Environment]::OSVersion.Version
    $osOk = $build.Major -ge 10
    Write-Check "Windows" $osOk "$($build.ToString()) (needs Windows 10 or newer)"
    $ok = $ok -and $osOk

    $archOk = [Environment]::Is64BitOperatingSystem
    $arch = Get-Architecture
    Write-Check "Architecture" $archOk "$arch (needs 64-bit)"
    $ok = $ok -and $archOk

    $psOk = $PSVersionTable.PSVersion.Major -ge 5
    Write-Check "PowerShell" $psOk "$($PSVersionTable.PSVersion) (needs 5.0 or newer)"
    $ok = $ok -and $psOk

    $tar = Join-Path $env:SystemRoot "System32\tar.exe"
    $tarOk = Test-Path $tar
    Write-Check "tar" $tarOk $(if ($tarOk) { $tar } else { "not found. Update Windows 10 to version 1803 or newer." })
    $ok = $ok -and $tarOk

    $drive = [System.IO.Path]::GetPathRoot($Root)
    try {
        $free = [math]::Round((New-Object System.IO.DriveInfo($drive)).AvailableFreeSpace / 1GB, 1)
        $diskOk = $free -ge $script:MinFreeGB
        Write-Check "Disk space" $diskOk "$free GB free on $drive (needs $($script:MinFreeGB) GB while building)"
    } catch {
        $diskOk = $true
        Write-Check "Disk space" $true "couldn't measure $drive, carrying on"
    }
    $ok = $ok -and $diskOk

    foreach ($site in @("https://github.com", "https://nodejs.org", "https://registry.npmjs.org")) {
        $reach = Test-Host $site
        Write-Check "Network" $reach $site
        $ok = $ok -and $reach
    }

    Write-Host "`nInstalled automatically, just for this app:"
    Write-Host "  - Node $($script:NodeVersion), used to build the app (your own Node isn't used or changed)"
    Write-Host "  - yt-dlp and ffmpeg, used for optional YouTube features"
    if (Get-Command adb -ErrorAction SilentlyContinue) {
        Write-Host "`nOptional: adb found, so phone sync can work."
    } else {
        Write-Host "`nOptional: adb not found. Only phone sync needs it: install Android Platform Tools if you want that."
    }
    return $ok
}

function Get-Architecture {
    # PROCESSOR_ARCHITEW6432 is set when 32-bit PowerShell runs on 64-bit Windows.
    $name = if ($env:PROCESSOR_ARCHITEW6432) { $env:PROCESSOR_ARCHITEW6432 } else { $env:PROCESSOR_ARCHITECTURE }
    if ($name -eq "ARM64") { return "arm64" }
    return "x64"
}

function Get-File([string]$Url, [string]$Out) {
    Invoke-WebRequest -Uri $Url -OutFile $Out -UseBasicParsing
}

function Assert-Hash([string]$File, [string]$Expected, [string]$Label) {
    $actual = (Get-FileHash -Path $File -Algorithm SHA256).Hash.ToLower()
    if ($actual -ne $Expected.ToLower()) { throw "$Label failed its checksum, so nothing was installed. Try again; if it keeps happening, please report it." }
}

function Get-Source([string]$WorkDir, [string]$WantVersion) {
    $tarball = Join-Path $WorkDir "source.tar.gz"
    if ($env:B1T_SOURCE_TARBALL) {
        # Testing a build that hasn't been released yet.
        Copy-Item $env:B1T_SOURCE_TARBALL $tarball
    } else {
        $stamped = $script:ReleaseVersion -notlike "__*"
        if (-not $stamped -and -not $WantVersion) { throw "This copy of the script wasn't made by a release. Use the command in the README, or set `$env:B1T_VERSION." }
        $tag = if ($WantVersion) { $WantVersion } else { $script:ReleaseVersion }
        $base = "$($script:Repo)/releases/download/v$tag"
        Write-Host "Downloading version $tag..."
        Get-File "$base/source.tar.gz" $tarball
        if ($stamped -and $tag -eq $script:ReleaseVersion) {
            Assert-Hash $tarball $script:SourceSha256 "The download"
        } else {
            $sums = Join-Path $WorkDir "SHA256SUMS"
            Get-File "$base/SHA256SUMS" $sums
            $line = Get-Content $sums | Where-Object { $_ -match "\ssource\.tar\.gz$" } | Select-Object -First 1
            if (-not $line) { throw "Release $tag doesn't list a checksum for its source." }
            Assert-Hash $tarball ($line -split "\s+")[0] "The download"
        }
    }
    $source = Join-Path $WorkDir "source"
    New-Item -ItemType Directory -Force -Path $source | Out-Null
    & (Join-Path $env:SystemRoot "System32\tar.exe") -xzf $tarball -C $source
    if ($LASTEXITCODE -ne 0) { throw "Couldn't unpack the download." }
    return $source
}

function Get-Node([string]$WorkDir) {
    $arch = Get-Architecture
    $name = "node-v$($script:NodeVersion)-win-$arch"
    $zip = Join-Path $WorkDir "$name.zip"
    Write-Host "Downloading Node $($script:NodeVersion)..."
    Get-File "https://nodejs.org/dist/v$($script:NodeVersion)/$name.zip" $zip
    Assert-Hash $zip $script:NodeHashes[$arch] "The Node download"
    & (Join-Path $env:SystemRoot "System32\tar.exe") -xf $zip -C $WorkDir
    if ($LASTEXITCODE -ne 0) { throw "Couldn't unpack Node." }
    return (Join-Path $WorkDir "$name\node.exe")
}

function Invoke-Node([string]$Node, [string[]]$NodeArgs) {
    & $Node @NodeArgs
    if ($LASTEXITCODE -ne 0) { throw "__ALREADY_REPORTED__" }
}

function Invoke-B1tInstall {
    $ErrorActionPreference = "Stop"
    $ProgressPreference = "SilentlyContinue" # the progress bar makes downloads many times slower
    # Windows PowerShell can default to TLS versions that GitHub and nodejs.org refuse.
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

    $wantCheckOnly = $CheckOnly -or $env:B1T_CHECK_ONLY
    $wantYes = $Yes -or $env:B1T_YES
    $wantForce = $Force -or $env:B1T_FORCE
    $wantUninstall = $Uninstall -or $env:B1T_UNINSTALL
    $wantVersion = if ($Version) { $Version } else { $env:B1T_VERSION }
    $root = if ($env:B1T_INSTALL_ROOT) { $env:B1T_INSTALL_ROOT } else { Join-Path $env:LOCALAPPDATA "b1tburn3r20" }

    if ($wantUninstall) {
        $node = Join-Path $root "tools\node.exe"
        $core = Join-Path $root "installer\install-core.cjs"
        if (-not ((Test-Path $node) -and (Test-Path $core))) { throw "b1tburn3r20 doesn't seem to be installed in $root." }
        $uninstallArgs = @($core, "--root", $root, "--uninstall")
        if ($wantYes) { $uninstallArgs += "--yes" }
        Invoke-Node $node $uninstallArgs
        return
    }

    $ready = Test-Preflight $root
    if (-not $ready) { throw "This computer isn't ready yet. Fix the items marked FAIL above, then run this again." }
    if ($wantCheckOnly) {
        Write-Host "`nEverything needed is here. Nothing was changed."
        return
    }

    Write-Host "`nThis installs b1tburn3r20 to $root, plus a Start Menu shortcut. Your music is not touched."
    if (-not $wantYes) {
        $reply = Read-Host "Continue? [Y/n]"
        if ($reply -and $reply -notmatch "^(y|yes)$") {
            Write-Host "Cancelled. Nothing was changed."
            return
        }
    }

    New-Item -ItemType Directory -Force -Path $root | Out-Null
    $work = Join-Path $root "install-tmp"
    if (Test-Path $work) { Remove-Item -Recurse -Force $work }
    New-Item -ItemType Directory -Force -Path $work | Out-Null
    try {
        $source = Get-Source $work $wantVersion
        $node = Get-Node $work
        $coreArgs = @((Join-Path $source "installer\install-core.cjs"), "--source", $source, "--root", $root)
        if ($wantYes) { $coreArgs += "--yes" }
        if ($wantForce) { $coreArgs += "--force" }
        if ($NoLaunch -or $env:B1T_NO_LAUNCH) { $coreArgs += "--no-launch" }
        Invoke-Node $node $coreArgs
    } finally {
        if (Test-Path $work) { Remove-Item -Recurse -Force $work -ErrorAction SilentlyContinue }
    }
}

# Inside `irm | iex`, `exit` would close the user's terminal. Report the failure and return.
try {
    Invoke-B1tInstall
} catch {
    if ($_.Exception.Message -ne "__ALREADY_REPORTED__") {
        Write-Host "`nInstall stopped: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "Your existing install, music and data were not changed."
    }
    # Lets a script or CI see the failure, without closing an interactive window.
    if ($MyInvocation.MyCommand.Path -or $env:CI) { exit 1 } else { $global:LASTEXITCODE = 1 }
}
