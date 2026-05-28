# TODO (Change 10)：实现 backup Dockerfile
# 基础镜像建议：postgres:16-alpine 或自定义 alpine 镜像
# 需包含：postgresql-client、rclone、supercronic（或等价 cron 工具）
FROM alpine:3.21
RUN apk add --no-cache postgresql-client rclone supercronic
COPY backup.sh /backup.sh
COPY crontab /crontab
ENTRYPOINT ["supercronic", "/crontab"]