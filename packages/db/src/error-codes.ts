export const DocumentErrorCodes = {
  MARKDOWN_EMPTY: 'markdown.empty',
  MARKDOWN_TOO_LARGE: 'markdown.too_large',
  MARKDOWN_INVALID_ENCODING: 'markdown.invalid_encoding',
  MARKDOWN_BINARY_CONTENT: 'markdown.binary_content',
  STORAGE_OBJECT_NOT_FOUND: 'storage.object_not_found',
  STORAGE_READ_FAILED: 'storage.read_failed',
  WORKER_UNEXPECTED_ERROR: 'worker.unexpected_error',
  INGESTION_PARSE_FAILED: 'ingestion.parse_failed',
  INGESTION_EMPTY_CHUNKS: 'ingestion.empty_chunks',
  INGESTION_CHUNK_WRITE_FAILED: 'ingestion.chunk_write_failed',
  EMBEDDING_AUTH_FAILED: 'embedding.auth_failed',
  EMBEDDING_RATE_LIMITED: 'embedding.rate_limited',
  EMBEDDING_TIMEOUT: 'embedding.timeout',
  EMBEDDING_NETWORK_ERROR: 'embedding.network_error',
  EMBEDDING_SCHEMA_MISMATCH: 'embedding.schema_mismatch',
  EMBEDDING_DIMENSION_MISMATCH: 'embedding.dimension_mismatch',
  EMBEDDING_FAILED: 'embedding.failed',
} as const;

export type DocumentErrorCode =
  (typeof DocumentErrorCodes)[keyof typeof DocumentErrorCodes];

export const ErrorMessages: Record<DocumentErrorCode, string> = {
  [DocumentErrorCodes.MARKDOWN_EMPTY]: '文件内容为空',
  [DocumentErrorCodes.MARKDOWN_TOO_LARGE]: '文件超过 20MB 上限',
  [DocumentErrorCodes.MARKDOWN_INVALID_ENCODING]: '文件编码不是有效的 UTF-8',
  [DocumentErrorCodes.MARKDOWN_BINARY_CONTENT]: '文件包含二进制内容，请上传纯文本 Markdown',
  [DocumentErrorCodes.STORAGE_OBJECT_NOT_FOUND]: '存储对象不存在',
  [DocumentErrorCodes.STORAGE_READ_FAILED]: '存储对象读取失败',
  [DocumentErrorCodes.WORKER_UNEXPECTED_ERROR]: '处理过程中发生未预期错误',
  [DocumentErrorCodes.INGESTION_PARSE_FAILED]: 'Markdown 解析失败',
  [DocumentErrorCodes.INGESTION_EMPTY_CHUNKS]: '文档解析后未生成有效文本块',
  [DocumentErrorCodes.INGESTION_CHUNK_WRITE_FAILED]: '文本块写入数据库失败',
  [DocumentErrorCodes.EMBEDDING_AUTH_FAILED]: 'Embedding 服务认证失败，请检查 API Key',
  [DocumentErrorCodes.EMBEDDING_RATE_LIMITED]: 'Embedding 服务请求过于频繁，请稍后重试',
  [DocumentErrorCodes.EMBEDDING_TIMEOUT]: 'Embedding 服务响应超时',
  [DocumentErrorCodes.EMBEDDING_NETWORK_ERROR]: 'Embedding 服务网络连接失败',
  [DocumentErrorCodes.EMBEDDING_SCHEMA_MISMATCH]: 'Embedding 服务返回格式异常',
  [DocumentErrorCodes.EMBEDDING_DIMENSION_MISMATCH]: 'Embedding 向量维度不匹配，预期 1024',
  [DocumentErrorCodes.EMBEDDING_FAILED]: 'Embedding 服务调用失败',
};