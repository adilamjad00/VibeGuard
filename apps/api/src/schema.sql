create extension if not exists "uuid-ossp";

create table if not exists scans (
  id uuid primary key default uuid_generate_v4(),
  repo_url text not null,
  commit_sha text,
  status text not null default 'queued',
  score int,
  verdict text,
  summary jsonb,
  report_object_key text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists findings (
  id uuid primary key default uuid_generate_v4(),
  scan_id uuid not null references scans(id) on delete cascade,
  source text not null,
  category text not null,
  severity text not null,
  title text not null,
  file_path text,
  line_start int,
  line_end int,
  snippet text,
  explanation text,
  recommended_fix text,
  fingerprint text,
  created_at timestamptz not null default now()
);

create table if not exists scan_events (
  id uuid primary key default uuid_generate_v4(),
  scan_id uuid not null references scans(id) on delete cascade,
  phase text,
  message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_findings_scan on findings(scan_id);
create index if not exists idx_findings_sev on findings(severity);
create index if not exists idx_scans_repo on scans(repo_url, commit_sha);
