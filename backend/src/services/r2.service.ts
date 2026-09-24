import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  HeadObjectCommandOutput,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  DeleteObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3';
import fs from 'fs';
import { Readable } from 'stream';
import { config } from '../config/index.js';

class R2Service {
  private client: S3Client;
  private bucket: string;
  public publicUrl: string;

  constructor() {
    this.bucket = config.r2.bucket;
    this.publicUrl = config.r2.publicUrl;
    this.client = new S3Client({
      region: 'auto',
      endpoint: config.r2.endpoint,
      credentials: {
        accessKeyId: config.r2.accessKeyId,
        secretAccessKey: config.r2.secretAccessKey,
      },
    });
  }

  async uploadFile(key: string, filePath: string, contentType: string, isImmutable = false): Promise<string> {
    const fileStream = fs.createReadStream(filePath);
    const cacheControl = isImmutable
      ? 'public, max-age=31536000, immutable'
      : 'no-cache, no-store, must-revalidate';

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: fileStream,
      ContentType: contentType,
      CacheControl: cacheControl,
    });

    await this.client.send(command);
    return this.getPublicUrl(key);
  }

  async uploadBuffer(key: string, buffer: Buffer, contentType: string, isImmutable = false): Promise<string> {
    const cacheControl = isImmutable
      ? 'public, max-age=31536000, immutable'
      : 'no-cache, no-store, must-revalidate';

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: cacheControl,
    });

    await this.client.send(command);
    return this.getPublicUrl(key);
  }

  async fileExists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }));
      return true;
    } catch (err: any) {
      if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
        return false;
      }
      return false;
    }
  }

  async getObjectMeta(key: string): Promise<HeadObjectCommandOutput | null> {
    try {
      return await this.client.send(new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }));
    } catch {
      return null;
    }
  }

  /**
   * Multipart upload for large video files (> 5MB).
   * Uploads in 64MB chunks — efficient for files up to 50GB+.
   * Reports progress via optional onProgress callback (0–100).
   */
  async uploadLargeFile(
    key: string,
    filePath: string,
    contentType: string,
    onProgress?: (pct: number) => void,
  ): Promise<string> {
    const CHUNK_SIZE = 64 * 1024 * 1024; // 64 MB per part
    const fileSize = fs.statSync(filePath).size;

    // Small files: plain PutObject (< 64MB)
    if (fileSize <= CHUNK_SIZE) {
      const fileStream = fs.createReadStream(filePath);
      await this.client.send(new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: fileStream,
        ContentType: contentType,
        ContentLength: fileSize,
        CacheControl: 'public, max-age=31536000, immutable',
      }));
      onProgress?.(100);
      return this.getPublicUrl(key);
    }

    // Large files: multipart upload
    const { UploadId } = await this.client.send(new CreateMultipartUploadCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    }));

    const parts: { ETag: string; PartNumber: number }[] = [];
    let uploadedBytes = 0;
    let partNumber = 1;

    try {
      for (let offset = 0; offset < fileSize; offset += CHUNK_SIZE) {
        const end = Math.min(offset + CHUNK_SIZE - 1, fileSize - 1);
        const chunkSize = end - offset + 1;
        const fileStream = fs.createReadStream(filePath, { start: offset, end });

        const { ETag } = await this.client.send(new UploadPartCommand({
          Bucket: this.bucket,
          Key: key,
          UploadId,
          PartNumber: partNumber,
          Body: fileStream,
          ContentLength: chunkSize,
        }));

        parts.push({ ETag: ETag!, PartNumber: partNumber });
        uploadedBytes += chunkSize;
        partNumber++;

        const pct = Math.round((uploadedBytes / fileSize) * 100);
        onProgress?.(pct);
        console.log(`[R2 Upload] ${key} — ${pct}% (${(uploadedBytes / 1e9).toFixed(2)}GB / ${(fileSize / 1e9).toFixed(2)}GB)`);
      }

      await this.client.send(new CompleteMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId,
        MultipartUpload: { Parts: parts },
      }));

      return this.getPublicUrl(key);
    } catch (err) {
      // Abort upload on failure to avoid partial orphaned upload costs
      await this.client.send(new AbortMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId,
      })).catch(() => {});
      throw err;
    }
  }

  async listFiles(prefix: string): Promise<string[]> {
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
      });
      const response = await this.client.send(command);
      return (response.Contents || []).map((c) => c.Key || '').filter(Boolean);
    } catch (err) {
      console.error('Error listing files in R2:', err);
      return [];
    }
  }

  async listAllObjects(prefix = ''): Promise<{ key: string; size: number; lastModified?: Date }[]> {
    let continuationToken: string | undefined = undefined;
    const allObjects: { key: string; size: number; lastModified?: Date }[] = [];
    try {
      do {
        const command: ListObjectsV2Command = new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        });
        const response = await this.client.send(command);
        if (response.Contents) {
          for (const item of response.Contents) {
            if (item.Key) {
              allObjects.push({
                key: item.Key,
                size: item.Size || 0,
                lastModified: item.LastModified,
              });
            }
          }
        }
        continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
      } while (continuationToken);
    } catch (err) {
      console.error('Error listing all objects in R2:', err);
    }
    return allObjects;
  }

  async deleteObjects(keys: string[]): Promise<number> {
    if (!keys || keys.length === 0) return 0;
    let deletedCount = 0;
    try {
      for (let i = 0; i < keys.length; i += 1000) {
        const batch = keys.slice(i, i + 1000).map((Key) => ({ Key }));
        const command = new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: {
            Objects: batch,
            Quiet: true,
          },
        });
        await this.client.send(command);
        deletedCount += batch.length;
      }
    } catch (err) {
      console.error('Error batch deleting objects in R2:', err);
    }
    return deletedCount;
  }

  async deleteFolder(prefix: string): Promise<number> {
    const keys = (await this.listAllObjects(prefix)).map((o) => o.key);
    if (keys.length === 0) return 0;
    return this.deleteObjects(keys);
  }

  async getStorageUsage(): Promise<{
    totalBytes: number;
    totalFiles: number;
    streams: {
      infoHash: string;
      fileCount: number;
      totalBytes: number;
      lastModified?: string;
    }[];
  }> {
    const objects = await this.listAllObjects('streams/');
    const streamMap = new Map<string, { fileCount: number; totalBytes: number; lastModified?: Date }>();
    let totalBytes = 0;

    for (const obj of objects) {
      totalBytes += obj.size;
      const parts = obj.key.split('/');
      // Expected format: streams/<infoHash>/filename
      if (parts.length >= 2 && parts[1]) {
        const hash = parts[1].toLowerCase();
        const existing = streamMap.get(hash) || { fileCount: 0, totalBytes: 0 };
        existing.fileCount += 1;
        existing.totalBytes += obj.size;
        if (!existing.lastModified || (obj.lastModified && obj.lastModified > existing.lastModified)) {
          existing.lastModified = obj.lastModified;
        }
        streamMap.set(hash, existing);
      }
    }

    const streams = Array.from(streamMap.entries()).map(([infoHash, data]) => ({
      infoHash,
      fileCount: data.fileCount,
      totalBytes: data.totalBytes,
      lastModified: data.lastModified?.toISOString(),
    }));

    return {
      totalBytes,
      totalFiles: objects.length,
      streams,
    };
  }

  getPublicUrl(key: string): string {
    return `${this.publicUrl}/${key.replace(/^\//, '')}`;
  }
}

export const r2Service = new R2Service();
