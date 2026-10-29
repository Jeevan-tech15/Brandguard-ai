import { NextResponse } from 'next/server';
import { getSupabaseServerClient, getServerDbConfigStatus } from '@/lib/supabase/server';

export async function GET() {
  const configStatus = getServerDbConfigStatus();
  const startTime = Date.now();

  let isDatabaseReachable = false;
  let databaseLatencyMs: number | undefined;
  let dbError: string | null = null;

  const storageStatus = {
    creativesBucketReachable: false,
    assetsBucketReachable: false,
    serviceRoleActive: Boolean(configStatus.hasServiceKey),
  };

  if (configStatus.isConfigured) {
    const supabase = getSupabaseServerClient();
    if (supabase) {
      try {
        const { error } = await supabase.from('brand_guidelines').select('id').limit(1);
        databaseLatencyMs = Date.now() - startTime;
        if (!error) {
          isDatabaseReachable = true;
        } else {
          dbError = error.message;
        }

        const { data: buckets } = await supabase.storage.listBuckets();
        if (buckets) {
          storageStatus.creativesBucketReachable = buckets.some((b) => b.name === 'brandguard-creatives');
          storageStatus.assetsBucketReachable = buckets.some((b) => b.name === 'brand-assets');
        }
      } catch (err: unknown) {
        dbError = err instanceof Error ? err.message : 'Database ping failed';
      }
    }
  }

  return NextResponse.json({
    status: isDatabaseReachable ? 'connected' : configStatus.isConfigured ? 'unreachable' : 'local_persistence',
    database: {
      configured: configStatus.isConfigured,
      reachable: isDatabaseReachable,
      latencyMs: databaseLatencyMs,
      missingVars: configStatus.missingVars,
      mode: configStatus.isConfigured ? 'Audit Data Storage' : 'Local Persistent Storage',
      storage: storageStatus,
      error: dbError,
    },
    llmEngine: {
      status: 'standby',
      phase: 'ready_for_phase_2',
      note: 'Server-side LLM review engine will evaluate content against active brand guidelines and approved facts.',
    },
    timestamp: new Date().toISOString(),
  });
}
