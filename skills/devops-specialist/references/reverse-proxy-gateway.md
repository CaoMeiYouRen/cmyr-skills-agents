# 反代网关层：nginx / OpenResty / Nginx Proxy Manager（NPM）

适用：把裸机 nginx 迁到 GUI 化网关；判断「我的站点能不能交给 NPM 管」；在反代层做版本指纹、真实 IP、证书与暴露面加固。

## 第一步永远先确认「面对的是哪个 nginx」

```bash
nginx -v 2>&1        # 或 openresty -v
curl -sI https://<site>/ | grep -i '^server:'
```

`openresty` 与 `nginx` 不是同一套编译：OpenResty 自带 `HeadersMoreNginxModule`（`more_clear_headers` / `more_set_headers`）、Lua 等。**用 openresty 专属指令写出来的配置，迁到任何官方 nginx 镜像都会 `[emerg] unknown directive`**。

NPM 的 nginx 来自它自建的 `nginxproxymanager/nginx-full:certbot-node` 镜像，官方文档只声明 geoip2 可 `load_module`，**headers-more 未在文档中声明**。迁移前先实测：

```bash
docker exec <npm容器> nginx -V 2>&1 | tr ' ' '\n' | grep -iE 'headers_more|http_v3|brotli|lua'
```

没有 headers-more 就用原生 `proxy_hide_header`（`http|server|location` 上下文，只作用于 `proxy_pass` 的上游响应）。

## 迁 NPM 之前的分类法（决定「全量迁」还是「双轨」）

| 类别 | 特征 | 动作 |
| --- | --- | --- |
| **A 纯反代** | 只有 `server_name` + `proxy_pass` + 少量 header | ✅ 最适合 NPM，可 API 批量导入 |
| **B 反代+定制** | `proxy_set_header` / `add_header` / `rewrite` / `return 301` | ✅ 迁，逻辑进该站点的 Advanced |
| **C 静态/目录** | `root`、`try_files`、`index`、直接 serve 文件 | ❌ NPM 做不了（见边界表） |
| **D http 级指令** | `map`、`geo`、`limit_req_zone`、`upstream` 块 | ⚠️ 只能全站一份放 `custom/http_top.conf`，**失去按站点隔离** |
| **E openresty/lua** | `more_*`、`content_by_lua`、`js_*` | ❌ 留裸机 |

```bash
# 一键分类（在 sites-enabled/ 下跑）
grep -lE "^\s*(root|try_files|index)\b" *.conf                     # C
grep -lE "^\s*(map|geo|limit_req_zone|limit_conn_zone)\b" *.conf    # D
grep -lE "more_(set|clear|set_input|if)|lua_|js_(content|set)" *.conf # E
grep -lE "proxy_pass" *.conf                                        # A/B
```

**判据：A+B ≥85% 才值得全量迁**；C/D/E 超过五六个时，双轨（NPM 管 Docker 内纯反代 + 裸机管静态 / 特殊）成本更低、风险更小。

## NPM 的能力边界（源码级）

| 能力 | 支持 | 依据 / 说明 |
| --- | --- | --- |
| HTTP/HTTPS 反代、WebSocket | ✅ | 模板按 `allow_websocket_upgrade` 自动补 `Upgrade` / `Connection` / `proxy_http_version 1.1` |
| Let's Encrypt HTTP-01 | ✅ | 内置 certbot |
| Let's Encrypt **DNS-01 / 通配符** | ✅ | `backend/lib/certbot.js` 读 `certbot/dns-plugins.json`，运行时 `pip install` 对应插件（Cloudflare 等） |
| 重定向主机 / 404 主机 / TCP·UDP stream | ✅ | 官方 Features |
| IP 白名单 / Basic Auth | ✅ | Access List |
| per-host 任意 **server 级**指令 | ✅ | Advanced 标签；模板里 `{{ advanced_config }}` 插在 `server{}` 内 |
| **http 级指令（map / geo / limit_req_zone）** | ⚠️ 只有全局 | `/data/nginx/custom/http_top.conf`、`http.conf`，无法按站点隔离 |
| 静态文件服务、`try_files` | ❌ | `location /` 里永远是 `include conf.d/include/proxy.conf`（即 proxy_pass）；要静态就得关 `use_default_location` 再手写，等于绕开 NPM |
| 从现有 `.conf` 一键导入 | ❌ | 官方 Discussion 多年未实现；只能 API 或手工 |

模板证据（`backend/templates/proxy_host.conf`）的渲染顺序：`{{ advanced_config }}` → `{{ locations }}` → `location / { include conf.d/include/proxy.conf; }` → `include /data/nginx/custom/server_proxy[.]conf;`。

## 四个坑

1. **`map` 不能进 Advanced**。它属 `http` 级，而 Advanced 的内容被插在 `server{}` 内 → `[emerg] "map" directive is not allowed here`。要按站点做变量，只能全站写进 `custom/http_top.conf`。
2. **`http_top.conf` 并不在真正的「top」**。某些版本它被 include 在 `nginx.conf` 靠后的位置（http 块开头之后），中间已存在 NPM 自己的 `map`。后果有两层：在 `http_top.conf` 里重复定义 NPM 已声明的 http 级指令（如同名 `map` 变量）会 `[emerg]`；而该文件任何语法错误都会让 `nginx -t` 失败，导致**后续所有站点的配置都存不进去**。动 http 级变量前先 `docker exec <npm> grep -n include /etc/nginx/nginx.conf` 看真实位置。
3. **`server_proxy.conf` 会污染所有站点**——它被 include 进**每一个** proxy server 块。只想改一个站点就用该站点的 Advanced（server 级），别碰全局文件。
4. **不配 real_ip，Access List 的 IP 白名单就是废的**。反代 / CDN 前置（Cloudflare 等）时必须：

    ```nginx
    set_real_ip_from <CDN 段>;
    real_ip_header CF-Connecting-IP;   # 或 X-Forwarded-For
    real_ip_recursive on;
    ```

    否则 NPM 看到的是上一跳 IP，白名单失效或误伤。裸机 nginx 上通常已在 `nginx.conf` 做过，迁移时最容易漏掉。

## 灰度与回滚（全量迁移时）

1. **备份**：NPM 的 `/data`（SQLite + 证书）+ 裸机 `sites-enabled` 全量；先导出再动手。
2. **证书先行**：先在 NPM 里把泛域名证书（DNS-01）签好并确认能自动续期，再切流量——证书失败会拖住整批迁移。
3. **批量导入走 API**：`POST /api/nginx/proxy-hosts`，字段 `domain_names[]` / `forward_scheme` / `forward_host` / `forward_port` / `advanced_config` / `ssl_forced` / `http2_support` / `hsts_enabled` / `allow_websocket_upgrade` / `block_exploits` / `access_list_id` / `certificate_id` / `locations[]` / `meta`。
4. **一次只切一条 DNS**，每条观察 24h；先改 hosts 验证再动正式解析。
5. **回滚两条路**：DNS 改回裸机 IP；或停 NPM 容器让裸机重新占 80/443。迁移期内两台机器都要能独立提供全部站点。
6. **验收清单**：HTTP/2、WebSocket、`client_max_body_size`（要在 Advanced 写）、真实 IP、HSTS、301/rewrite 链路、后端名解析（NPM 与上游同宿主机时用自定义 Docker network + 服务名，不映射端口）。
7. 切完至少 30 天再删裸机 conf。

## 在 NPM 里剥版本指纹头（与裸机 nginx 的写法差异）

裸机 nginx 的写法（`server{}` 里 `proxy_hide_header`，或 OpenResty 的 `more_clear_headers`）**不能直接搬进 NPM 的 custom 目录**：

- 用**该站点的 Advanced**（内容插在 `server{}` 内，正好是 `proxy_hide_header` 的合法上下文）：

    ```nginx
    proxy_hide_header X-Jenkins;
    proxy_hide_header X-Jenkins-Session;
    ```

- **不要**写进 `custom/server_proxy.conf`——它被 include 进每一个 proxy server 块，一处改动会把所有站点的响应头一起改掉。
- 别指望 `more_clear_headers`：先按上文 `nginx -V` 实测 headers-more 是否被编译进去，没有就是 `unknown directive`，而 NPM 的报错会让**整个站点的配置存不进去**（改完先 `docker exec <npm> nginx -t`）。
- **剥之前确认哪个头是客户端判据**：Jenkins CLI 以 `X-Hudson` 与 `X-Jenkins` 同时为 null 才判定「不是 Jenkins」，两个都剥会让 `jenkins-cli.jar` 报 `There's no Jenkins running at …`。`X-Hudson` 是固定值、不含版本，可以保留。
- 剥头是抬成本不是修复：Jenkins 仍有 `/jnlpJars/jenkins-cli.jar`（manifest 里就是版本）、登录页结构等指纹；真正的动作是升级 + 不暴露公网。

## 反代层通用加固（与用哪个网关无关）

- **管理口绝不挂公网**（NPM 的 81、Portainer 的 9000、Jenkins 的 8080）：内网 / VPN / CF Access + IP 白名单。
- 版本指纹头按站点剥，剥之前先确认该头有没有被客户端或 CLI 当作判据（见上文 `X-Hudson`）。
- 裸机 nginx 升版本跟随官方安全公告（公告页直接给 `Vulnerable: x.y.z-a.b.c` 区间，是版本判定最精确的一类产品）。
- 迁移完成后核对线上实际版本与镜像 tag 是否一致，不要用 tag 冒充线上版本（容器内 `nginx -v` 才是最直接的证据）。
