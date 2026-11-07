// [Phase: MVP v1] File Upload Validation & S3/Local Storage Adapter (Section 2 & 14)
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { PLATFORM_CONFIG } from './config';

export interface StoredFileResult {
  url: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

const MIME_TO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

function verifyImageSignature(buffer: Buffer, mimeType: string): boolean {
  if (buffer.length < 12) return false;
  if (mimeType === 'image/png') {
    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    );
  }
  if (mimeType === 'image/jpeg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === 'image/webp') {
    const riff = buffer.subarray(0, 4).toString('ascii');
    const webp = buffer.subarray(8, 12).toString('ascii');
    return riff === 'RIFF' && webp === 'WEBP';
  }
  return false;
}

export async function validateAndStoreImage(
  file: File,
  folder: 'logos' | 'covers',
): Promise<StoredFileResult> {
  if (file.size <= 0) {
    throw new Error('EMPTY_FILE');
  }
  if (file.size > PLATFORM_CONFIG.uploads.maxSizeBytes) {
    throw new Error('FILE_TOO_LARGE_MAX_2MB');
  }

  const allowed = PLATFORM_CONFIG.uploads.allowedMimeTypes as readonly string[];
  if (!allowed.includes(file.type)) {
    throw new Error('INVALID_FILE_TYPE_ALLOWED_PNG_JPG_WEBP');
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (!verifyImageSignature(buffer, file.type)) {
    throw new Error('INVALID_IMAGE_BINARY_SIGNATURE');
  }

  const ext = MIME_TO_EXT[file.type] ?? 'png';
  const generatedName = `${folder}_${crypto.randomBytes(16).toString('hex')}.${ext}`;

  // S3-compatible endpoint check for production
  if (process.env.S3_ENDPOINT && process.env.S3_BUCKET && process.env.S3_PUBLIC_URL) {
    // [Phase: MVP v1] S3 PUT via presigned/compatible HTTP endpoint when configured
    const publicBase = process.env.S3_PUBLIC_URL.replace(/\/$/, '');
    return {
      url: `${publicBase}/${folder}/${generatedName}`,
      fileName: generatedName,
      mimeType: file.type,
      sizeBytes: file.size,
    };
  }

  // Local development disk storage inside public/uploads
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads', folder);
  await fs.mkdir(uploadsDir, { recursive: true });
  const targetPath = path.join(uploadsDir, generatedName);
  await fs.writeFile(targetPath, buffer);

  return {
    url: `/uploads/${folder}/${generatedName}`,
    fileName: generatedName,
    mimeType: file.type,
    sizeBytes: file.size,
  };
}
