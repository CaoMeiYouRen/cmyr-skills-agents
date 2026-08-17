<#requires -Version 7
# 检测 Nuxt 项目在 Windows/WSL2 下的构建环境状态，输出 JSON。
# 用法：./check-wsl2-env.ps1 -ProjectPath <项目路径> （默认当前目录）
# Parser（agent）读取：inside_wsl / wsl_installed / default_distro /
#   project_location / is_nuxt_project / nuxt_project_paths /
#   wsl_node_installed / wsl_pnpm_installed
#>

param(
    [string]$ProjectPath = (Get-Location).Path
)

$ErrorActionPreference = 'SilentlyContinue'

$result = [ordered]@{
    inside_wsl            = $false
    wsl_installed         = $false
    default_distro        = $null          # 构建候选发行版（排除 Docker 内部发行版）
    all_distros           = @()
    project_location      = 'unknown'   # wsl_ext4 | wsl_mnt | wsl_share | windows_drive | unknown
    is_nuxt_project       = $false
    nuxt_project_paths    = @()
    wsl_node_installed    = $false
    wsl_pnpm_installed    = $false
}

# ---------- 1. 是否已在 WSL 内 ----------
if ($env:WSL_DISTRO_NAME) {
    $result.inside_wsl = $true
}
elseif (Test-Path '/proc/version') {
    $procVersion = Get-Content '/proc/version' -Raw
    if ($procVersion -match 'Microsoft') {
        $result.inside_wsl = $true
    }
}

# ---------- 2. WSL 是否安装 / 候选发行版 ----------
function Get-WslDistros {
    $output = & wsl -l -q 2>&1 | Out-String
    if ($LASTEXITCODE -eq 0 -and $output) {
        $clean = $output -replace "`0", ""
        return @(($clean -split "`r?`n") | Where-Object { $_.Trim() } | ForEach-Object { $_.Trim() })
    }
    return @()
}

$result.all_distros = @(Get-WslDistros)
if ($result.all_distros.Count -gt 0) {
    $result.wsl_installed = $true
}

# Docker 内部发行版不用于开发构建（docker-desktop 等）
$dockerDistroPattern = '^(docker-desktop|docker-desktop-data|Docker)$'
$developerDistros = @($result.all_distros | Where-Object { $_ -notmatch $dockerDistroPattern })
if ($developerDistros.Count -gt 0) {
    $result.default_distro = $developerDistros[0]
}
elseif ($result.all_distros.Count -gt 0 -and -not $result.inside_wsl) {
    $result.default_distro = $result.all_distros[0]
}
elseif ($result.inside_wsl) {
    $result.default_distro = $env:WSL_DISTRO_NAME
}

# ---------- 3. 项目路径位置 ----------
if ($result.inside_wsl) {
    if ($ProjectPath -match '^/mnt/[a-zA-Z]/') {
        $result.project_location = 'wsl_mnt'          # 9P 跨边界，红线
    }
    elseif ($ProjectPath -match '^/') {
        $result.project_location = 'wsl_ext4'          # 最佳
    }
    else {
        $result.project_location = 'unknown'           # 传入的是 Windows 风格路径
    }
}
elseif ($ProjectPath -match '^\\\\wsl\$\\') {
    $result.project_location = 'wsl_share'             # \\wsl$\ 访问 ext4，构建可在 WSL 内跑
}
else {
    $result.project_location = 'windows_drive'         # 需要迁移到 WSL 内部
}

# ---------- 4. Nuxt 项目检测（根 + 子项目，排除 node_modules/.git 等） ----------
function Get-NuxtDeps($pkgPath) {
    try {
        $json = Get-Content $pkgPath -Raw | ConvertFrom-Json
        $deps = @()
        if ($json.dependencies) { $deps += @($json.dependencies.PSObject.Properties.Name) }
        if ($json.devDependencies) { $deps += @($json.devDependencies.PSObject.Properties.Name) }
        return $deps
    }
    catch {
        return @()
    }
}

$rootPkg = Join-Path $ProjectPath 'package.json'
if (Test-Path $rootPkg -PathType Leaf) {
    if ((Get-NuxtDeps $rootPkg) -contains 'nuxt') {
        $result.is_nuxt_project = $true
        $result.nuxt_project_paths = @((Resolve-Path $ProjectPath).Path)
    }
}

if (-not $result.is_nuxt_project) {
    $excludedDir = '\\(node_modules|\.git|\.nuxt|dist|\.output|\.vercel|build)\\(\\|$)'
    Get-ChildItem -Path $ProjectPath -Recurse -Depth 3 -Filter 'package.json' -File -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -notmatch $excludedDir } |
        ForEach-Object {
            if ((Get-NuxtDeps $_.FullName) -contains 'nuxt') {
                $result.is_nuxt_project = $true
                $result.nuxt_project_paths += $_.DirectoryName
            }
        }
}

# ---------- 5. WSL 内 node/pnpm 是否可用 ----------
if ($result.inside_wsl -or $result.wsl_installed) {
    if ($result.inside_wsl) {
        $nodeOut = bash -lc 'command -v node' 2>$null
        $result.wsl_node_installed = ($LASTEXITCODE -eq 0 -and $nodeOut)
        $pnpmOut = bash -lc 'command -v pnpm' 2>$null
        $result.wsl_pnpm_installed = ($LASTEXITCODE -eq 0 -and $pnpmOut)
    }
    else {
        $distroArg = if ($result.default_distro) { @('-d', $result.default_distro) } else { @() }
        $nodeOut = & wsl @distroArg bash -lc 'command -v node' 2>$null
        $result.wsl_node_installed = ($LASTEXITCODE -eq 0 -and $nodeOut)
        $pnpmOut = & wsl @distroArg bash -lc 'command -v pnpm' 2>$null
        $result.wsl_pnpm_installed = ($LASTEXITCODE -eq 0 -and $pnpmOut)
    }
}

$result | ConvertTo-Json -Depth 3