# 域名配置（<your-domain>）

## 1. 配置 DNS

Porkbun 删除默认 Parking Page 记录：

- ALIAS @ -> pixie.porkbun.com
- CNAME * -> pixie.porkbun.com

新增 DNS：

| Type | Host | Value |
|------|------|------|
| A | @ | <vps-ip> |
| A | www | <vps-ip> |

验证：

```bash
dig @curitiba.ns.porkbun.com <your-domain>
```

返回：

```txt
<your-domain>. IN A <vps-ip>
```

---

## 2. 切换生产 Caddy 配置

当前项目使用双 Caddyfile 方案：
- `infra/caddy/Caddyfile`：开发/试用环境，`require` 无法解析模板变量，仅用于 `docker compose config` 校验。
- `infra/caddy/Caddyfile.prod`：生产环境，域名在文件内硬编码，自动申请 Let's Encrypt 证书。

在生产 VPS 上执行：

```bash
cd /opt/devbrain
# 将 Caddyfile.prod 中的 <your-domain> 替换为你的域名
sed -i 's/<your-domain>/<your-domain>/g' infra/caddy/Caddyfile.prod
sed -i 's/www\.<your-domain>/www.<your-domain>/g' infra/caddy/Caddyfile.prod

# 写入 CADDY_CONFIG 到 .env
echo 'CADDY_CONFIG=Caddyfile.prod' >> .env

# 重启 caddy
$COMPOSE up -d caddy
```

验收：
```bash
$COMPOSE config | grep caddy
```

---

## 3. 启用生产 Compose 覆盖

`docker-compose.prod.yml` 已包含 caddy 443 端口映射和镜像拉取策略，无需手动编辑 `docker-compose.yml`。

确认生产 compose 合并无误：

```bash
cd /opt/devbrain
$COMPOSE config >/tmp/devbrain-compose.yml
grep -A3 'caddy:' /tmp/devbrain-compose.yml
```

应包含：

```txt
- 0.0.0.0:80->80/tcp
- 0.0.0.0:443->443/tcp
- 0.0.0.0:443->443/udp
```

---

## 4. HTTPS 证书

Caddy 自动申请 Let's Encrypt。

验证：

```bash
docker logs devbrain-caddy --tail=100
```

出现：

```txt
certificate obtained successfully
identifier: <your-domain>
```

说明证书签发成功。

---

## 最终验证

```bash
curl --noproxy "*" -Iv https://<your-domain>
```

浏览器访问：

```txt
https://<your-domain>
```

---

# 问题记录

## 问题1：域名无法解析（NXDOMAIN）

### 错误

```txt
ping: cannot resolve <your-domain>
```

或：

```txt
status: NXDOMAIN
```

### 原因

DNS 刚修改，全球 DNS 尚未同步。

### 解决方法

等待 DNS 传播。

验证权威 DNS：

```bash
dig @curitiba.ns.porkbun.com <your-domain>
```

---

## 问题2：HTTPS 无法访问

### 错误

```txt
Failed to connect to <your-domain> port 443
```

### 原因

Docker Compose 未映射 443 端口。

### 解决方法

增加：

```yaml
- '${CADDY_HTTPS_PORT:-443}:443'
- '${CADDY_HTTPS_PORT:-443}:443/udp'
```

然后执行：

```bash
docker compose up -d caddy
```

---

## 问题3：curl 测试结果异常

### 错误

```txt
Uses proxy env variable HTTPS_PROXY
```

### 原因

请求经过 Clash、V2Ray 等代理，导致排查结果失真。

### 解决方法

绕过代理测试：

```bash
curl --noproxy "*" -Iv https://<your-domain>
```

---

## 问题4：证书签发失败排查

### 原因

优先检查：

- DNS 是否生效
- 80 端口是否开放
- 443 端口是否开放
- Caddy 是否加载域名配置

### 解决方法

查看日志：

```bash
docker logs devbrain-caddy --tail=100
```

确认出现：

```txt
certificate obtained successfully
```
