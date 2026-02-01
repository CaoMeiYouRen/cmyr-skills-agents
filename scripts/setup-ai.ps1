# 分开定义文件和文件夹链接
$fileLinks = @{
    "CLAUDE.md" = "AGENTS.md"
}

$dirLinks = @{
    ".github/agents" = "agents"
    ".github/skills" = "skills"
    ".claude/agents" = "agents"
    ".claude/skills" = "skills"
}

function Create-Link {
    param (
        [string]$Dest,
        [string]$Target,
        [boolean]$IsDir
    )

    # 将路径中的斜杠统一转换为 Windows 的反斜杠，防止 mklink 将其误认为开关 (Switch)
    $winDest = $Dest -replace '/', '\'
    $winTarget = $Target -replace '/', '\'

    if (-not (Test-Path $winDest)) {
        # 计算相对路径深度
        $depth = ($winDest -split '\\').Count - 1
        $relTarget = if ($depth -gt 0) { ("..\" * $depth) + $winTarget } else { $winTarget }

        # 创建父目录
        $parent = Split-Path $winDest
        if ($parent -and -not (Test-Path $parent)) {
            New-Item -ItemType Directory -Path $parent -Force | Out-Null
        }

        # 检查原始目标是否存在
        if (Test-Path $winTarget) {
            Write-Host "Creating relative link: $winDest -> $relTarget"
            if ($IsDir) {
                # 创建目录软链接 (/D)
                # 使用引号包裹路径，并确保传给 cmd 的是反斜杠路径
                cmd /c "mklink /D `"$winDest`" `"$relTarget`""
            }
            else {
                # 创建文件软链接
                cmd /c "mklink `"$winDest`" `"$relTarget`""
            }
        }
        else {
            Write-Warning "Source target not found: $winTarget"
        }
    }
}

# 处理文件链接
foreach ($item in $fileLinks.GetEnumerator()) {
    Create-Link -Dest $item.Key -Target $item.Value -IsDir $false
}

# 处理文件夹链接
foreach ($item in $dirLinks.GetEnumerator()) {
    Create-Link -Dest $item.Key -Target $item.Value -IsDir $true
}
