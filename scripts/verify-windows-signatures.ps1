param(
    [Parameter(Mandatory=$true)][string]$PackagedDirectory,
    [Parameter(Mandatory=$true)][string]$ArtifactsDirectory
)
$ErrorActionPreference = 'Stop'
function Assert-TrustedSignature([string]$File) {
    if (-not (Test-Path -LiteralPath $File -PathType Leaf)) { throw "Executable is missing: $File" }
    $signature = Get-AuthenticodeSignature -LiteralPath $File
    if ($signature.Status -ne 'Valid' -or $null -eq $signature.SignerCertificate) {
        throw "Missing or untrusted publisher signature: $File ($($signature.Status))"
    }
}
Assert-TrustedSignature (Join-Path $PackagedDirectory 'utube-desktop.exe')
$installers = @(Get-ChildItem -LiteralPath $ArtifactsDirectory -Recurse -File -Filter '*.exe')
$archives = @(Get-ChildItem -LiteralPath $ArtifactsDirectory -Recurse -File -Filter '*.zip')
if ($installers.Count -eq 0 -or $archives.Count -eq 0) { throw 'Windows installer and ZIP are both required.' }
foreach ($file in $installers) { Assert-TrustedSignature $file.FullName }
foreach ($archive in $archives) {
    $temporary = Join-Path ([System.IO.Path]::GetTempPath()) ([System.Guid]::NewGuid().ToString())
    try {
        Expand-Archive -LiteralPath $archive.FullName -DestinationPath $temporary
        $apps = @(Get-ChildItem -LiteralPath $temporary -Recurse -File -Filter 'utube-desktop.exe')
        if ($apps.Count -ne 1) { throw "Expected exactly one desktop executable in $($archive.Name)" }
        Assert-TrustedSignature $apps[0].FullName
    } finally {
        if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary -Recurse -Force }
    }
}
Write-Output 'Verified trusted Authenticode signatures on the app, installer, and ZIP payload.'
