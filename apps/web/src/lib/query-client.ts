import { QueryClient, isServer } from '@tanstack/react-query';

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        retry: false,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

export function getQueryClient(): QueryClient {
  if (isServer) {
    return makeQueryClient();
  }
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}

// 切换用户（登录、注册、登出、refresh 失败被踢）时调用，
// 避免上一个用户的 query cache 串号到下一个用户。
export function clearQueryCache(): void {
  if (isServer) return;
  if (!browserQueryClient) return;
  browserQueryClient.clear();
}
