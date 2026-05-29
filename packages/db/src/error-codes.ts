export const DocumentErrorCodes = {
  MARKDOWN_EMPTY: 'markdown.empty',
  MARKDOWN_TOO_LARGE: 'markdown.too_large',
  MARKDOWN_INVALID_ENCODING: 'markdown.invalid_encoding',
  MARKDOWN_BINARY_CONTENT: 'markdown.binary_content',
  STORAGE_OBJECT_NOT_FOUND: 'storage.object_not_found',
  STORAGE_READ_FAILED: 'storage.read_failed',
  WORKER_UNEXPECTED_ERROR: 'worker.unexpected_error',
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
};