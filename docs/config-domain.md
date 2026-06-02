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

## 2. 配置 Caddy 域名

文件：

```bash
/opt/devbrain/infra/caddy/Caddyfile
```

修改：

```caddy
:80 {
```

为：

```caddy
<your-domain>, www.<your-domain> {
```

重启：

```bash
docker restart devbrain-caddy
```

---

## 3. 开放 HTTPS 端口

文件：

```bash
docker-compose.yml
```

原配置：

```yaml
ports:
  - '${CADDY_HTTP_PORT:-80}:80'
```

修改为：

```yaml
ports:
  - '${CADDY_HTTP_PORT:-80}:80'
  - '${CADDY_HTTPS_PORT:-443}:443'
  - '${CADDY_HTTPS_PORT:-443}:443/udp'
```

重建：

```bash
docker compose up -d caddy
```

验证：

```bash
docker ps | grep caddy
```

应包含：

```txt
0.0.0.0:443->443/tcp
0.0.0.0:443->443/udp
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
