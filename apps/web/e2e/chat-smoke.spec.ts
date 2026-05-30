import { test, expect } from '@playwright/test';

function uniqueEmail(): string {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

const TEST_PASSWORD = 'E2eTest123!';

const TEST_MD_CONTENT = `# 项目概述

这是一个用于端到端测试的 Markdown 文档。

## 架构设计

DevBrain 是一个自托管的 RAG 知识库系统，采用前后端分离架构。前端使用 Next.js App Router，后端使用 NestJS。

## 数据存储

使用 PostgreSQL 16 配合 pgvector 扩展存储向量数据，结合中文全文检索实现混合召回。

## 检索流程

检索分为 BM25 关键词检索、向量相似度检索和重排序三个阶段。
`;

test.describe('P0 真 E2E 全链路冒烟', () => {
  test('注册 → 创建 KB → 上传文档 → 等待就绪 → 对话 → 引用展示', async ({
    page,
  }) => {
    const email = uniqueEmail();

    await page.goto('/register');
    await page.getByLabel('邮箱').fill(email);
    await page.getByLabel('密码', { exact: true }).fill(TEST_PASSWORD);
    await page.getByRole('button', { name: /注册/ }).click();
    await expect(page).toHaveURL('/', { timeout: 15000 });

    await page.getByLabel('KB 名称').fill('全链路测试 KB');
    await page.getByRole('button', { name: /创建/ }).click();

    const kbLink = page.getByText('全链路测试 KB');
    await expect(kbLink).toBeVisible({ timeout: 5000 });
    await kbLink.click();

    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: '选择文件' }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: 'test-doc.md',
      mimeType: 'text/markdown',
      buffer: Buffer.from(TEST_MD_CONTENT, 'utf-8'),
    });

    await page.waitForURL(/\/kb\/[^/]+$/, { timeout: 30000 });

    const docItem = page.locator('.rounded-lg.border.p-3').filter({ hasText: 'test-doc.md' });
    await expect(docItem).toBeVisible({ timeout: 10000 });
    await expect(docItem.getByText('已完成')).toBeVisible({
      timeout: 60000,
    });

    await page.getByRole('link', { name: '进入 AI 对话' }).click();
    await expect(page).toHaveURL(/\/kb\/[^/]+\/chat/, { timeout: 10000 });

    const input = page.getByRole('textbox');
    await expect(input).toBeVisible({ timeout: 5000 });
    await input.fill('什么是 DevBrain？');
    await input.press('Enter');

    await expect(page.getByText('什么是 DevBrain？')).toBeVisible({
      timeout: 5000,
    });

    await expect(page.getByText(/模拟回答/)).toBeVisible({
      timeout: 60000,
    });

    const citationChips = page.getByRole('button', { name: /^[0-9]/ });
    await expect(citationChips.first()).toBeVisible({ timeout: 15000 });
    const chipCount = await citationChips.count();
    expect(chipCount).toBeGreaterThan(0);

    await citationChips.first().click();

    const sourcePanel = page.getByText('引用来源');
    await expect(sourcePanel).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('项目概述').first()).toBeVisible({
      timeout: 5000,
    });
  });

  test('未登录访问 Chat 页面被重定向', async ({ page }) => {
    await page.goto('/kb/some-id/chat');
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });
});