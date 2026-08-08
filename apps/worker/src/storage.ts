import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import type { NormalizedFinding, ScanSummary, Verdict } from "@vibeguard/core";

let client: S3Client | undefined;

/**
 * Mirrors apps/api/src/s3.ts. Zerops Object Storage is MinIO, so path-style
 * addressing is required — virtual-host style resolves `<bucket>.<apiUrl>`,
 * which does not exist.
 */
function getS3(): S3Client {
  if (!client) {
    client = new S3Client({
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION ?? "us-east-1",
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY ?? "",
        secretAccessKey: process.env.S3_SECRET_KEY ?? "",
      },
    });
  }
  return client;
}

export interface ScanReport {
  scanId: string;
  repoUrl: string;
  commitSha: string | null;
  score: number;
  verdict: Verdict;
  summary: ScanSummary;
  failedScanners: string[];
  findings: NormalizedFinding[];
  generatedAt: string;
}

/**
 * Persists the full report and returns its object key, or null if the write
 * failed.
 *
 * What is stored is the **normalised** report — the same redacted findings that
 * go to Postgres — deliberately not the scanners' raw stdout. Raw gitleaks
 * output contains the unredacted secret it just found, and this bucket exists
 * to hold reports about leaks, not to become one. The bucket is private, but
 * the contents are written as if it might not stay that way.
 *
 * Never throws: object storage is where the report is archived, not where the
 * result lives. Losing the archive must not fail a scan the user is watching.
 */
export async function storeReport(report: ScanReport): Promise<string | null> {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) {
    console.error("[storage] S3_BUCKET not set — skipping report upload");
    return null;
  }

  const key = `scans/${report.scanId}/report.json`;
  try {
    await getS3().send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: JSON.stringify(report, null, 2),
        ContentType: "application/json",
      }),
    );
    console.log(`[storage] report written to s3://${bucket}/${key}`);
    return key;
  } catch (err) {
    console.error(`[storage] report upload failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}
