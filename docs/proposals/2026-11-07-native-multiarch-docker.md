# 提案：Docker 镜像原生多架构构建（去 QEMU）

> 能力：`docker-workflow`（B-convention；本提案细化其「原生多架构」约定，不新增能力）
> 发起：2026-11-07 ｜ 状态：已通知（待各项目研判）
> 审查：2026-11-07 通过（blocker 0 / warning 0 / suggest 2；三轮独立复核，清单见 [README](./README.md) 的「提交前优化审查」）
> 通知：2026-11-07 已提交 momei [#1002](https://github.com/CaoMeiYouRen/momei/issues/1002)、dependfix [#222](https://github.com/dependfix/dependfix/issues/222)、caomei-auth [#718](https://github.com/CaoMeiYouRen/caomei-auth/issues/718)

## 1 变更摘要

把 Docker 多架构构建从「buildx + QEMU 单 job 跨架构」改为「amd64 / arm64 各自在原生 runner 构建 → 按 digest 推送 → merge job 合成 manifest list」。覆盖两条入口：

- `push` 触发的镜像发布工作流（`docker.yml`）；
- release 工作流内的镜像构建，或 release 对镜像工作流的派发。

首批范围：`momei`、`dependfix`、`caomei-auth`。三个仓库均为 public；`ubuntu-24.04-arm` 已在 dependfix / caomei-auth 的镜像工作流中实际使用，并有成功运行记录。

能力台账中已有 `docker-workflow`（`capabilities/registry.json`，mature：三个项目），本提案不新建能力，只为该条目补充原生多架构约定与 `proposal` 指针。`mature` 表示整体 workflow 已验证，不代表本子约定已在全部项目落地；项目不采纳时，按 `optOut` 的 `items: ["native-multiarch"]` 登记理由。

## 2 背景与证据

### 2.1 为什么 QEMU 不可接受

amd64 runner 上通过 QEMU 模拟 arm64，会让 Nuxt / Vite 打包和原生模块（如 `better-sqlite3`）编译退化到不可用：

- dependfix 的镜像工作流注释记录了 1.0.0 实测：QEMU 下「Bundling client」单步 3h51m 未完成，两路构建均触 240 分钟上限被取消（`../dependfix/.github/workflows/docker.yml` 构建 job 注释）。
- momei 同为 QEMU 单 job 跨架构，2026-11-02、11-03、11-05 共四次 `build` job 在约 2 小时被取消（[run 41501882255](https://github.com/CaoMeiYouRen/momei/actions/runs/41501882255)、[run 41645192096](https://github.com/CaoMeiYouRen/momei/actions/runs/41645192096)、[run 42016033148](https://github.com/CaoMeiYouRen/momei/actions/runs/42016033148)、[run 42050488582](https://github.com/CaoMeiYouRen/momei/actions/runs/42050488582)），与 120 分钟上限一致；缓存命中时 `build` job 只需 2m39s（[run 41946004971](https://github.com/CaoMeiYouRen/momei/actions/runs/41946004971)），近期完整 `build` job 为 37m52s / 27m43s（[run 42328064112](https://github.com/CaoMeiYouRen/momei/actions/runs/42328064112) / [run 42336936580](https://github.com/CaoMeiYouRen/momei/actions/runs/42336936580)）。结论是 QEMU 耗时高度依赖缓存，缓存不完整时就会触顶。
- 原生 runner 已有成功运行：dependfix 7m52s（[run 42373335914](https://github.com/dependfix/dependfix/actions/runs/42373335914)）；caomei-auth 5m7s（[run 42370268641](https://github.com/CaoMeiYouRen/caomei-auth/actions/runs/42370268641)，含 Test 等工作流总耗时，build job 约 24s 且缓存命中）。不同项目缓存状态不同，不把绝对耗时当作等价比较，只证明原生 arm runner 可稳定产出。

### 2.2 当前状态（核验基线：2026-11-07；momei `d76b999d` / dependfix `df2a63b9` / caomei-auth `d53ca06`）

| 项目 | 镜像构建入口 | 当前架构策略 | 关键证据 |
| :--- | :--- | :--- | :--- |
| momei | `docker.yml` 的 `build` job；`release.yml` 的 `release` job | **QEMU 单 job 跨架构**：`setup-qemu-action` + `platforms: linux/amd64,linux/arm64` | `docker.yml:101,118,120,204`；`release.yml:93,139,227` |
| dependfix | `docker.yml` 的 `build` matrix + `merge`；`release.yml` 派发 `docker.yml` | **已原生**：amd64 用 `ubuntu-latest`、arm64 用 `ubuntu-24.04-arm`，按 digest 推送后 `imagetools create` 合成 | `docker.yml:83-91,176-220,221-246`；`release.yml:197` |
| caomei-auth | `docker.yml` 的 `build` matrix + `merge`；`release.yml`；`docker-publish.yml` | **部分原生**：`docker.yml` 已用原生 matrix；`release.yml` 仍为 QEMU；`docker-publish.yml` 的 rebuild 路径是单 job 跨架构且**未配置 QEMU**，arm64 阶段无法执行 Dockerfile 的 `RUN`，属于未验证的补发路径 | `docker.yml:77-84,112,135-136,194-195`；`release.yml:18,64,109`；`docker-publish.yml:39,79-80,195,203`；`Dockerfile:18,25` |

关于 `caomei-auth/docker-publish.yml` 的排查结论：该文件全文没有 `setup-qemu-action` / binfmt，`git log -S"setup-qemu-action" -- .github/workflows/docker-publish.yml` 也无结果；它的问题不是「QEMU 慢」，而是「单 job 跨架构但缺少执行 arm64 二进制的条件」。最近一次运行（[run 40510988460](https://github.com/CaoMeiYouRen/caomei-auth/actions/runs/40510988460)）走的是 `retag` 模式，未验证 rebuild 路径。

复现命令：

```bash
grep -rn "setup-qemu-action\|platforms:\|timeout-minutes\|runs-on" \
  ../momei/.github/workflows/{docker,release}.yml \
  ../dependfix/.github/workflows/{docker,release}.yml \
  ../caomei-auth/.github/workflows/{docker,release,docker-publish}.yml
```

结论：dependfix 已是可直接参照的样板；caomei-auth 的 `docker.yml` 也可作为结构参照；真正需要迁移的是 momei 的两条入口，以及 caomei-auth 的 release / 补发重建入口。

### 2.3 适用面

2026-11-07 扫描本仓库同级目录，命中 `setup-qemu-action` 的仓库共 16 个（含首批的 momei、caomei-auth，不含已迁移的 dependfix）：

```bash
grep -rl "setup-qemu-action" --include="*.yml" --include="*.yaml" \
  */.github/workflows | cut -d/ -f1 | sort -u
```

首批三个项目之外的 14 个仓库，在首批验证后按同一判据（是否真的构建 arm64、是否有可用原生 runner、构建耗时是否已触顶）逐个评估，不一次性铺开。

## 3 建议改动（按项目）

| 项目 | 建议 | 说明 |
| :--- | :--- | :--- |
| momei | **必须：迁移两条入口** | `docker.yml` 拆成 `build` matrix + `merge`；`release.yml` 内的镜像构建同样改为 matrix + merge，或改为 release 后派发 `docker.yml` 并传入版本。保留多 registry 发布、ACR 可选降级、`provenance:false` / `sbom:false` 与 Jenkins 部署顺序。 |
| dependfix | **必须：核对，无需重做** | 已是原生 matrix + digest + merge；核对 release 派发钉在 tag 上、无 QEMU 残留、merge 只在全部架构成功后执行。可作为其余项目的参照实现。 |
| caomei-auth | **必须：迁移剩余入口** | `docker.yml` 的架构 matrix 保持不变；迁移 `release.yml` 的 QEMU 构建，并修复 `docker-publish.yml` 的 `mode == 'build'` 路径（改为原生 matrix + merge，或先在 tag 上触发 `docker.yml` 产出 `sha-*`，再走 `retag`）。`retag` 默认路径不重新构建，保持现状。 |
| 其他项目 | **建议：后续批次** | 14 个仓库已确认使用 QEMU；首批未验证前不要求同步，验证后按 §2.3 的判据逐个评估。 |

建议的目标结构（结构示意，不是补丁）：

```text
build (matrix)
  amd64: ubuntu-latest
  arm64: ubuntu-24.04-arm
  → 按 registry 分别 push-by-digest
  → 上传 digest artifact
merge (ubuntu-latest)
  → 下载全部 digest
  → docker buildx imagetools create -t <tags> <image>@<digest>...
  → 镜像 README / Jenkins 部署
```

多 registry 时不要假设一个 digest 可跨 registry 复用；dependfix 的做法是每个 registry 各推一次、各存 digest，再由 merge 分别组装。项目可沿用或明确说明自己的等价做法。

## 4 需要项目 agent 研判的问题

1. **release 拓扑**：镜像构建放在 release workflow 内的 matrix job，还是 release 完成后 `workflow_dispatch` 镜像工作流（dependfix 模式）？前者少一次派发，后者复用更彻底；需要结合 tag 创建时机、`--ref` 钉版本、重跑幂等性决定。
2. **tag 传递**：momei / caomei-auth 当前用 `git describe --tags --exact-match HEAD` 取 tag。拆 job 后需要 job output 或工作流派发参数；确认 semver / latest / date / sha 四类 tag 与现有策略一致。
3. **arm runner 可用性**：`ubuntu-24.04-arm` 已在两个 public 仓库成功使用；确认组织配额、并发上限与计费，以及 runner 不可用时的处理（失败、排队还是降级）。
4. **缓存**：按架构使用独立的 `type=gha,scope=<arch>`，避免 amd64 / arm64 缓存互相污染；确认 release 与 push 是否共享缓存、缓存容量是否够。
5. **验证强度**：dependfix 目前只在 amd64 跑镜像冒烟。切原生 arm64 后，是否需要对 arm64 做一次运行时冒烟，还是「manifest inspect + amd64 冒烟」足够。
6. **多 registry**：ACR / GHCR / Docker Hub 的 digest 与 manifest 组装方式；ACR 个人版对 OCI attestation 的限制是否仍要求 `provenance:false` / `sbom:false`。
7. **触发面（可选，可另案）**：`push` 是否加 `paths` 过滤（dependfix 已加，momei / caomei-auth 尚未加），避免文档提交触发镜像构建。该优化与架构迁移不是同一类问题，由项目决定是否同批实施，不作为本提案的必过项。
8. **回滚与紧急路径**：arm runner 故障时，是临时只发 amd64 并在发布说明标注，还是短期恢复 QEMU？需要明确「不得静默少发一个架构」。

## 5 验收标准

- [ ] 首批三个仓库的 `.github/workflows` 中不再有 QEMU 模拟 arm64 的镜像构建路径；确有保留时，注释写明仅作紧急回退且不在主路径。失败判据：`grep -rn "setup-qemu-action"` 仍在主构建 job 命中且无上述注释。
- [ ] `build` matrix 明确：`linux/amd64` → `ubuntu-latest`，`linux/arm64` → `ubuntu-24.04-arm`；不再用 `platforms: linux/amd64,linux/arm64` 在单个 amd64 runner 上构建。失败判据：任一镜像构建 job 仍以单 runner 覆盖两个平台。
- [ ] 每个架构按 digest 推送，merge job 只在全部架构成功后执行；任一架构失败时不会发出单架构的 `latest`。失败判据：merge job 在部分架构失败后仍可运行，或 `latest` 只含一个平台。
- [ ] `docker buildx imagetools inspect <image>:<tag>` 显示 `linux/amd64` 与 `linux/arm64` 两个平台。失败判据：任一 tag 缺失平台或 manifest 无法解析。
- [ ] release 产出的版本 tag、`latest`、日期 tag、`sha-*` tag 与现有策略一致，且都指向同一个多架构 manifest。失败判据：同一版本在不同 registry / tag 上平台集合不一致。
- [ ] 各架构使用独立缓存 scope；失败判据：arm64 构建命中 amd64 的 `type=gha` scope，或两个架构共用同一 scope。
- [ ] 多 registry 发布、ACR 可选降级、`provenance:false` / `sbom:false`、镜像 README 同步、Jenkins 部署顺序均保持不变。失败判据：任一既有发布目标、降级行为或部署顺序被删除 / 前移。
- [ ] 回滚演练：回退 workflow 后能重新构建并发布；已发布镜像不受影响。失败判据：回退后无法重建，或回退动作删除了已发布 tag。

## 6 回滚

- 回滚 = 回退镜像工作流 / release 工作流的提交，重新触发一次构建；已推送的镜像与 tag 保留。
- 需要补发某个版本时，优先用项目现有的补发入口（如 caomei-auth 的 `docker-publish.yml` 的 `retag` 模式）；没有补发入口的项目重跑镜像工作流。
- arm runner 故障属于临时故障，不得把 QEMU 跨架构作为长期回滚路径；如需临时只发 amd64，必须在发布说明与 issue 中写明缺失架构及恢复条件。

## 7 本项目不做什么

- 不修改任何下游仓库的代码、workflow 或文档。
- 不提供统一的 reusable workflow / action，不替项目决定 release 拓扑与 tag 策略。
- 不修改 Dockerfile 的构建阶段与依赖安装方式。
- 不在首批未验证前要求其余 14 个仓库同步迁移。
- 不把 `paths` 触发过滤等与架构无关的相邻优化设为本提案的必过项。
- 不承诺具体的构建耗时下降数值；以「不再触顶超时、arm64 原生产出可用」为验收口径。

## 8 提交前优化审查记录

三轮独立复核：首轮 Reject（2 blocker / 9 warning）；第二轮 Reject（1 blocker / 7 warning）；第三轮 Pass。所有问题均已修订。

| 项 | 结论 |
| :--- | :--- |
| 单一目的 | 通过：只处理镜像构建的架构执行方式；`paths` 等触发面优化降为可选项 |
| 无重复 | 通过：已核对 `capabilities/registry.json` 的 `docker-workflow`、现有提案与三个项目实现；本提案为既有能力补约定，不新建能力 |
| 证据可复现 | 通过：给出文件、行号、复现命令、成功 / 取消 run 链接与核验 commit；caomei-auth 的「无 QEMU」结论单独说明 |
| 按项目分档 | 通过：三个项目分别为「必须迁移 / 必须核对 / 必须迁移剩余入口」，其余 14 个仓库标为「建议：后续批次」 |
| 边界清楚 | 通过：§7 明确不修改下游、不提供统一实现、不一次性铺开 |
| 验收可判定 | 通过：每条均有失败判据；平台、manifest、tag、缓存、registry、回滚均可检查 |
| 回滚可执行 | 通过：回退 workflow、按项目现有补发入口补发、临时单架构的限制均已写明 |
| 正文自包含 | 通过：issue 正文可直接引用 §1–§7，并附提案 URL + 实际 commit；不依赖上游其他文件 |
| 易变信息标日期 | 通过：runner 名称、行号、run 链接、核验 commit 与扫描结果均标注 2026-11-07 |

两轮复核已修复的问题：

- 更正 caomei-auth `docker-publish.yml` 的描述：该文件没有 QEMU，问题是单 job 跨架构且未配置 QEMU，arm64 的 `RUN` 无法执行；rebuild 路径未被实际验证。
- 改为复用既有 `docker-workflow` 能力，并在 `capabilities/registry.json` 补充 `proposal` 指针；`optOut.items` 的用法在提案正文约定，且明确 `mature` 不代表子约定已覆盖。
- 按 dependfix `df2a63b9` 重取行号；补充 momei 两次约 2 小时取消的 run 证据，并用缓存命中 run 说明耗时波动，不再用单一耗时作典型值。
- 修正后续批次数量（14）、`paths` 与「保持不变」的冲突、缓存项在 §5 / §7 的冲突、回滚入口、自包含口径、验收失败判据、多仓库索引状态与规则生效范围。

审查遗留的 suggest（不阻塞提交）：

1. 后续可把首批三个项目的构建耗时做成对比表，用于评估其余 14 个仓库的优先级。
2. `docker-workflow` 的 marker 目前只按文件存在判定，后续可考虑增加「原生多架构」的文本 / 配置标记，避免漂移无法自动发现。
