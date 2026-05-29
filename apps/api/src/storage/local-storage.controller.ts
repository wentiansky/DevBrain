import {
  Controller,
  Put,
  Head,
  Get,
  Param,
  Req,
  Res,
  HttpStatus,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { LocalStorageAdapter } from './local-storage.adapter';
import { verifySignatureToken } from './signature';

@ApiExcludeController()
@Controller('storage/local')
export class LocalStorageController {
  constructor(
    private readonly adapter: LocalStorageAdapter,
  ) {}

  @Put(':token')
  async handlePut(
    @Param('token') token: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const decodedToken = decodeURIComponent(token);
    const payload = verifySignatureToken(decodedToken);

    if (!payload) {
      res.status(HttpStatus.UNAUTHORIZED).json({
        statusCode: 401,
        message: '签名 token 无效、已过期或被篡改',
      });
      return;
    }

    if (payload.httpMethod !== 'PUT') {
      res.status(HttpStatus.METHOD_NOT_ALLOWED).json({
        statusCode: 405,
        message: '签名 token 不允许此 HTTP 方法',
      });
      return;
    }

    const contentLengthHeader = req.headers['content-length'];
    if (!contentLengthHeader) {
      res.status(HttpStatus.BAD_REQUEST).json({
        statusCode: 400,
        message: 'Content-Length 缺失',
      });
      return;
    }

    const receivedLength = parseInt(contentLengthHeader, 10);
    if (receivedLength > payload.maxContentLength) {
      res.status(HttpStatus.BAD_REQUEST).json({
        statusCode: 400,
        message: `内容长度 ${receivedLength} 超过签名上限 ${payload.maxContentLength}`,
      });
      return;
    }

    const buffer = req.body as Buffer;
    if (!Buffer.isBuffer(buffer)) {
      res.status(HttpStatus.BAD_REQUEST).json({
        statusCode: 400,
        message: '请求体格式不正确',
      });
      return;
    }

    try {
      await this.adapter.putObject(
        payload.objectKey,
        buffer,
        payload.maxContentLength,
        receivedLength,
      );
      res.status(HttpStatus.OK).json({ status: 'ok' });
    } catch (err) {
      res.status(HttpStatus.BAD_REQUEST).json({
        statusCode: 400,
        message: (err as Error).message,
      });
    }
  }

  @Head(':token')
  async handleHead(
    @Param('token') token: string,
    @Res() res: Response,
  ) {
    const decodedToken = decodeURIComponent(token);
    const payload = verifySignatureToken(decodedToken);

    if (!payload) {
      return res.status(HttpStatus.UNAUTHORIZED).json({
        statusCode: 401,
        message: '签名 token 无效、已过期或被篡改',
      });
    }

    if (payload.httpMethod !== 'HEAD') {
      return res.status(HttpStatus.METHOD_NOT_ALLOWED).json({
        statusCode: 405,
        message: '签名 token 不允许此 HTTP 方法',
      });
    }

    const result = await this.adapter.headObject(payload.objectKey);

    if (!result.exists) {
      return res.status(HttpStatus.NOT_FOUND).json({
        statusCode: 404,
        message: '对象不存在',
      });
    }

    res.setHeader('Content-Length', result.sizeBytes ?? 0);
    if (result.contentType) {
      res.setHeader('Content-Type', result.contentType);
    }
    return res.status(HttpStatus.OK).end();
  }

  @Get(':token')
  async handleGet(
    @Param('token') token: string,
    @Res() res: Response,
  ) {
    const decodedToken = decodeURIComponent(token);
    const payload = verifySignatureToken(decodedToken);

    if (!payload) {
      return res.status(HttpStatus.UNAUTHORIZED).json({
        statusCode: 401,
        message: '签名 token 无效、已过期或被篡改',
      });
    }

    if (payload.httpMethod !== 'GET') {
      return res.status(HttpStatus.METHOD_NOT_ALLOWED).json({
        statusCode: 405,
        message: '签名 token 不允许此 HTTP 方法',
      });
    }

    try {
      const stream = await this.adapter.getObjectStream(payload.objectKey);
      res.setHeader('Content-Type', 'application/octet-stream');
      stream.pipe(res);
    } catch {
      return res.status(HttpStatus.NOT_FOUND).json({
        statusCode: 404,
        message: '对象不存在',
      });
    }
  }
}