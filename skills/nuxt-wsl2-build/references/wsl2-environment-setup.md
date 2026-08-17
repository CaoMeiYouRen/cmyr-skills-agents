# WSL2 环境搭建与 Git 配置

一次性环境搭建指南，适用于 Windows 11 + WSL2（Ubuntu）。安装前先确认：

```powershell
wsl --status
```

## 1. 安装 WSL2 + Ubuntu

```powershell
# 管理员 PowerShell
wsl --install -d Ubuntu
wsl --set-version Ubuntu 2   # 确保 WSL2 而非 WSL1
```

首次安装需要重启。重启后进入 WSL 完成首次用户配置。

## 2. 配置 .wslconfig

`C:\Users\<用户名>\.wslconfig`（内存/CPU 按机器实际调整；16GB 机器给 8-10GB、32GB 机器给 16GB 较合理）：

```ini
[wsl2]
memory=16GB        # 默认 50% 物理内存；Node 构建吃内存，给足
processors=8       # 默认全部逻辑核；构建并行化需要
swap=4GB
localhostForwarding=true   # 让 Windows 浏览器能访问 WSL 里的 dev server（localhost:3000）
```

> ⚠️ 修改后必须 `wsl --shutdown` 重启 WSL 才生效。

## 3. WSL 内安装 Linux 版 Node + pnpm

```bash
# 不要跨边界调用 Windows 的 node
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt-get install -y nodejs
corepack enable && corepack prepare pnpm@latest --activate
```

## 4. SSH 配置（复用 Windows 的 key，不要重新生成）

```bash
# ① 看 Windows .ssh 里有什么（key 名可能是 id_rsa，不一定是 id_ed25519）
ls -la /mnt/c/Users/<用户名>/.ssh/

# ② 复制过来
mkdir -p ~/.ssh
cp -r /mnt/c/Users/<用户名>/.ssh/* ~/.ssh/

# ③ 修正权限（必须！否则报 Permissions too open）
chmod 600 ~/.ssh/id_rsa          # 私钥（按实际文件名）
chmod 644 ~/.ssh/id_rsa.pub      # 公钥
chmod 600 ~/.ssh/known_hosts
```

验证：

```bash
ssh -T git@github.com
# 期望输出：Hi <用户名>! You've successfully authenticated...
```

配 git 身份：

```bash
git config --global user.name "<用户名>"
git config --global user.email "<GitHub邮箱>"
```

## 5. GPG 配置（复用 Windows 的 gpg.exe，最佳方案）

不装 Linux GPG、不复制私钥——让 git 直接调用 Windows 的 gpg.exe（比 socat socket 桥接简单，无密码回传隐患，VS Code 无缝集成）。

```bash
# ① 找 gpg.exe（scoop 版路径示例）
ls /mnt/c/Users/<用户名>/scoop/apps/gnupg/current/bin/gpg.exe

# ② 看已有私钥（记下 key id 与 uid 邮箱）
/mnt/c/Users/<用户名>/scoop/apps/gnupg/current/bin/gpg.exe --list-secret-keys

# ③ 配置 git（3 条命令）
git config --global gpg.program "/mnt/c/Users/<用户名>/scoop/apps/gnupg/current/bin/gpg.exe"
git config --global user.signingkey <完整KEYID>
git config --global commit.gpgsign true
```

验证三步：

```bash
# ① 签名测试（会弹 Windows 侧密码框）
echo test | /mnt/c/Users/<用户名>/scoop/apps/gnupg/current/bin/gpg.exe --clearsign

# ② 真实 commit 签名
git commit -S --allow-empty -m "test gpg signing"

# ③ 验证签名
git log -1 --show-signature
# 期望：Good signature from "用户名 <邮箱>"
```

公钥上传 GitHub：`gpg.exe --armor --export <KEYID>` 输出贴到 GitHub → Settings → SSH and GPG keys → New GPG key。

### GPG 常见坑

| 坑 | 表现 | 解决 |
|---|---|---|
| 邮箱不匹配 | commit 显示 Unverified | `user.email` 必须用 GitHub 已验证邮箱，且与 key 的 uid 邮箱一致 |
| key 未上传 GitHub | Unverified | 导出公钥添加到 GitHub |
| pinentry 不弹窗 | commit 卡住 | 确认 Windows 侧 gpg/pinentry 程序正常 |
| 信任级别 [unknown] | 签名警告 | `gpg --edit-key <KEYID>` → `trust` → `5`（ultimate） |
| 多把 key 混乱 | 选错签名 key | 选与当前邮箱匹配的那把，配置 `user.signingkey` |

## 6. 避坑清单

1. 项目别放 `/mnt/c`——WSL2 里构建必须在 `~/`（ext4），否则比原生 Windows 还慢（9P 跨边界）。
2. SSH key 别重新生成——复制 Windows 已有的；文件名看实际（id_rsa / id_ed25519 都行）；`chmod 600` 必须。
3. GPG 别在 WSL 里装一套——直接 `gpg.program` 指向 Windows 的 gpg.exe，key 永远留在 Windows。
4. 邮箱一致性——git `user.email`、GPG key uid 邮箱、GitHub 已验证邮箱三者必须一致。
5. `.wslconfig` 改完要 `wsl --shutdown`。
6. git 换行符——Linux 侧默认 LF；若项目有 CRLF 历史，`git config core.autocrlf input`。
7. 内存分配——`.wslconfig` 给 WSL2 的内存是从 Windows 划走的，不要给满。
8. Docker 联动——Docker Desktop 的 WSL2 后端可直接复用该发行版，容器构建 context 同样享受 ext4 提速。

## 参考来源

- 微软官方：WSL 配置文档 <https://learn.microsoft.com/en-us/windows/wsl/wsl-config>
- GitHub 官方：SSH key 配置 <https://docs.github.com/en/authentication/connecting-to-github-with-ssh>
- GitHub 官方：GPG key 配置 <https://docs.github.com/en/authentication/managing-commit-signature-verification/generating-a-new-gpg-key>
