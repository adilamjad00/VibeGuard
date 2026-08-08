import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config, require_ } from "./env.js";

let client: S3Client | undefined;

/**
 * Zerops Object Storage is MinIO, so path-style addressing is required —
 * virtual-host style would resolve `<bucket>.<apiUrl>`, which does not exist.
 * MinIO ignores the region but the SDK insists on one being present.
 */
export function getS3(): S3Client {
  if (!client) {
    client = new S3Client({
      endpoint: config.s3.endpoint ?? require_("S3_ENDPOINT"),
      region: process.env.S3_REGION ?? "us-east-1",
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.s3.accessKeyId ?? require_("S3_ACCESS_KEY"),
        secretAccessKey: config.s3.secretAccessKey ?? require_("S3_SECRET_KEY"),
      },
    });
  }
  return client;
}

export function getBucket(): string {
  return config.s3.bucket ?? require_("S3_BUCKET");
}

/** Long enough to click through from the report page, short enough not to leak. */
export const REPORT_URL_TTL_SECONDS = 300;

export async function presignReport(key: string): Promise<string> {
  return getSignedUrl(getS3(), new GetObjectCommand({ Bucket: getBucket(), Key: key }), {
    expiresIn: REPORT_URL_TTL_SECONDS,
  });
}
