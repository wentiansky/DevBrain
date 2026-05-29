-- Partial unique index: 每个用户最多一个 personal space
CREATE UNIQUE INDEX "Space_createdById_personal_unique" ON "Space"("createdById") WHERE "type" = 'personal';