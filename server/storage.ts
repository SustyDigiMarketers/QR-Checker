import fs from 'fs';
import path from 'path';
import { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const isProd = process.env.NODE_ENV === 'production';
const UPLOADS_DIR = process.env.UPLOAD_PATH || path.join(process.cwd(), 'uploads');
const BACKUPS_DIR = process.env.BACKUP_PATH || path.join(process.cwd(), 'backups');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

// S3 / Cloudflare R2 Client Setup
let s3Client: S3Client | null = null;
const s3Bucket = process.env.S3_BUCKET || '';
const s3Region = process.env.S3_REGION || 'auto';
const s3Endpoint = process.env.S3_ENDPOINT || ''; // e.g. https://<account_id>.r2.cloudflarestorage.com
const s3AccessKeyId = process.env.S3_ACCESS_KEY_ID || '';
const s3SecretAccessKey = process.env.S3_SECRET_ACCESS_KEY || '';
const s3PublicUrl = process.env.S3_PUBLIC_URL || ''; // Optional public domain if bucket is public

export function isS3Configured(): boolean {
  return !!(s3Bucket && s3AccessKeyId && s3SecretAccessKey);
}

function getS3Client(): S3Client {
  if (!s3Client) {
    if (!isS3Configured()) {
      throw new Error('S3 Object Storage is not fully configured in environment variables.');
    }
    s3Client = new S3Client({
      region: s3Region,
      endpoint: s3Endpoint || undefined,
      credentials: {
        accessKeyId: s3AccessKeyId,
        secretAccessKey: s3SecretAccessKey,
      },
    });
  }
  return s3Client;
}

/**
 * Generate a short-lived signed URL for reading a private object from S3/R2 (e.g. 15 minutes).
 */
export async function getPresignedReadUrl(key: string, expiresInSeconds = 900): Promise<string> {
  if (!isS3Configured()) {
    throw new Error('S3 Object Storage is not configured.');
  }
  const client = getS3Client();
  const command = new GetObjectCommand({
    Bucket: s3Bucket,
    Key: key,
  });
  return await getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

/**
 * Stream a private S3/R2 object body directly for backend authenticated proxying.
 */
export async function getObjectStream(key: string): Promise<{ stream: any; contentType: string; contentLength?: number }> {
  const client = getS3Client();
  const res = await client.send(
    new GetObjectCommand({
      Bucket: s3Bucket,
      Key: key,
    })
  );
  return {
    stream: res.Body,
    contentType: res.ContentType || 'application/octet-stream',
    contentLength: res.ContentLength,
  };
}

/**
 * Save an uploaded image or file buffer either to S3/Cloudflare R2 or local disk.
 */
export async function saveUploadBuffer(buffer: Buffer, filename: string, mimeType: string): Promise<string> {
  if (isS3Configured()) {
    try {
      const client = getS3Client();
      const s3Key = `uploads/${filename}`;
      await client.send(
        new PutObjectCommand({
          Bucket: s3Bucket,
          Key: s3Key,
          Body: buffer,
          ContentType: mimeType,
        })
      );

      // Store private backend route reference or signed proxy path in MongoDB
      return `/api/media/uploads/${filename}`;
    } catch (err: any) {
      console.error('[Storage Engine] Failed to upload to S3/R2. Falling back to local storage:', err.message || err);
    }
  }

  // Local filesystem fallback
  const filePath = path.join(UPLOADS_DIR, filename);
  fs.writeFileSync(filePath, buffer);
  return `/uploads/${filename}`;
}

/**
 * Delete uploaded file from S3 or local disk.
 */
export async function deleteUploadFile(url: string | undefined | null): Promise<void> {
  if (!url) return;

  if (isS3Configured() && (url.includes(s3Bucket) || url.includes('/uploads/'))) {
    try {
      const filename = url.split('/uploads/').pop() || '';
      if (filename) {
        const client = getS3Client();
        await client.send(
          new DeleteObjectCommand({
            Bucket: s3Bucket,
            Key: `uploads/${filename}`,
          })
        );
        console.log(`[Storage Engine] Deleted S3/R2 upload: uploads/${filename}`);
        return;
      }
    } catch (err: any) {
      console.error('[Storage Engine] Failed to delete S3 file:', err.message || err);
    }
  }

  // Local disk delete fallback
  if (url.startsWith('/uploads/')) {
    try {
      const filename = url.substring('/uploads/'.length);
      const filePath = path.join(UPLOADS_DIR, filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`[Storage Engine] Deleted local upload file: ${filename}`);
      }
    } catch (err: any) {
      console.error('[Storage Engine] Failed to delete local upload file:', err.message || err);
    }
  }
}

/**
 * Save a backup JSON snapshot to S3 or local disk.
 */
export async function saveBackupSnapshot(filename: string, jsonContent: string): Promise<string> {
  if (isS3Configured()) {
    try {
      const client = getS3Client();
      const s3Key = `backups/${filename}`;
      await client.send(
        new PutObjectCommand({
          Bucket: s3Bucket,
          Key: s3Key,
          Body: Buffer.from(jsonContent, 'utf8'),
          ContentType: 'application/json',
        })
      );
      console.log(`[Storage Engine] Backup snapshot saved to S3/R2: ${s3Key}`);
    } catch (err: any) {
      console.error('[Storage Engine] Failed to save backup snapshot to S3. Falling back to disk:', err.message || err);
    }
  }

  // Always save locally as well or as fallback
  const filePath = path.join(BACKUPS_DIR, filename);
  fs.writeFileSync(filePath, jsonContent, 'utf8');
  return filePath;
}

/**
 * List backup snapshot files from S3 or local disk.
 */
export async function listBackups(): Promise<Array<{ filename: string; sizeBytes: number; mtime: string; source: 's3' | 'local' }>> {
  const result: Array<{ filename: string; sizeBytes: number; mtime: string; source: 's3' | 'local' }> = [];
  const filenamesSeen = new Set<string>();

  if (isS3Configured()) {
    try {
      const client = getS3Client();
      const res = await client.send(
        new ListObjectsV2Command({
          Bucket: s3Bucket,
          Prefix: 'backups/',
        })
      );
      if (res.Contents) {
        for (const item of res.Contents) {
          if (!item.Key) continue;
          const name = item.Key.replace('backups/', '');
          if (!name) continue;
          filenamesSeen.add(name);
          result.push({
            filename: name,
            sizeBytes: item.Size || 0,
            mtime: item.LastModified ? item.LastModified.toISOString() : new Date().toISOString(),
            source: 's3',
          });
        }
      }
    } catch (err: any) {
      console.error('[Storage Engine] Failed to list S3 backups:', err.message || err);
    }
  }

  // Read local backups
  if (fs.existsSync(BACKUPS_DIR)) {
    const files = fs.readdirSync(BACKUPS_DIR);
    for (const file of files) {
      if (!filenamesSeen.has(file)) {
        const filePath = path.join(BACKUPS_DIR, file);
        const stats = fs.statSync(filePath);
        if (stats.isFile()) {
          result.push({
            filename: file,
            sizeBytes: stats.size,
            mtime: new Date(stats.mtimeMs).toISOString(),
            source: 'local',
          });
        }
      }
    }
  }

  return result.sort((a, b) => new Date(b.mtime).getTime() - new Date(a.mtime).getTime());
}

/**
 * Read backup content string by filename from S3 or local disk.
 */
export async function readBackupContent(filename: string): Promise<string> {
  if (isS3Configured()) {
    try {
      const client = getS3Client();
      const res = await client.send(
        new GetObjectCommand({
          Bucket: s3Bucket,
          Key: `backups/${filename}`,
        })
      );
      if (res.Body) {
        const streamToString = (stream: any) =>
          new Promise<string>((resolve, reject) => {
            const chunks: any[] = [];
            stream.on('data', (chunk: any) => chunks.push(chunk));
            stream.on('error', reject);
            stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
          });
        return await streamToString(res.Body);
      }
    } catch (err: any) {
      console.warn(`[Storage Engine] Backup ${filename} not found on S3. Falling back to local disk.`);
    }
  }

  const filePath = path.join(BACKUPS_DIR, filename);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Backup snapshot file not found: ${filename}`);
  }
  return fs.readFileSync(filePath, 'utf8');
}
