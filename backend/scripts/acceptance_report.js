/* eslint-disable no-console */
const { PrismaClient } = require('@prisma/client');

function pct(num, den) {
  if (!den) return null;
  return Number(((num / den) * 100).toFixed(2));
}

function formatPct(value) {
  return value === null ? 'n/a' : `${value}%`;
}

function formatNum(value) {
  return value === null || value === undefined ? 'n/a' : String(value);
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const [calls, qRows] = await Promise.all([
      prisma.call.findMany({
        select: {
          createdAt: true,
          startedAt: true,
          status: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 5000,
      }),
      prisma.$queryRawUnsafe(
        `SELECT
            COUNT(*)::int AS total,
            SUM(CASE WHEN rtt_ms IS NOT NULL AND rtt_ms <= 200 THEN 1 ELSE 0 END)::int AS rtt_ok,
            SUM(CASE WHEN jitter_ms IS NOT NULL AND jitter_ms <= 80 THEN 1 ELSE 0 END)::int AS jitter_ok,
            SUM(CASE WHEN packet_loss_pct IS NOT NULL AND packet_loss_pct <= 5 THEN 1 ELSE 0 END)::int AS loss_ok
         FROM call_quality_metrics
         WHERE created_at >= NOW() - INTERVAL '24 hours'`,
      ),
    ]);

    const setupDurations = calls
      .filter((c) => c.startedAt)
      .map((c) => Math.max(0, (new Date(c.startedAt).getTime() - new Date(c.createdAt).getTime()) / 1000));

    const sorted = [...setupDurations].sort((a, b) => a - b);
    const pickPercentile = (arr, p) => {
      if (!arr.length) return null;
      const idx = Math.min(arr.length - 1, Math.max(0, Math.ceil((p / 100) * arr.length) - 1));
      return Number(arr[idx].toFixed(2));
    };
    const setupP95 = pickPercentile(sorted, 95);
    const setupLe8 = setupDurations.filter((v) => v <= 8).length;
    const setupLe8Pct = pct(setupLe8, setupDurations.length);

    const q = Array.isArray(qRows) && qRows[0] ? qRows[0] : { total: 0, rtt_ok: 0, jitter_ok: 0, loss_ok: 0 };
    const qTotal = Number(q.total || 0);
    const rttPct = pct(Number(q.rtt_ok || 0), qTotal);
    const jitterPct = pct(Number(q.jitter_ok || 0), qTotal);
    const lossPct = pct(Number(q.loss_ok || 0), qTotal);

    const nowMs = Date.now();
    const calls24h = calls.filter((c) => nowMs - new Date(c.createdAt).getTime() <= 24 * 60 * 60 * 1000);
    const active24h = calls24h.filter((c) => c.status === 'active').length;
    const ended24h = calls24h.filter((c) => c.status === 'ended').length;
    const completed24h = active24h + ended24h;

    const checks = [
      {
        key: 'SETUP_P95',
        target: 'call setup p95 <= 8s',
        pass: typeof setupP95 === 'number' && setupP95 <= 8,
        value: formatNum(setupP95),
      },
      {
        key: 'SETUP_95PCT',
        target: '>=95% setups <= 8s',
        pass: typeof setupLe8Pct === 'number' && setupLe8Pct >= 95,
        value: formatPct(setupLe8Pct),
      },
      {
        key: 'QUALITY_SAMPLE',
        target: 'quality samples exist (24h)',
        pass: qTotal > 0,
        value: String(qTotal),
      },
      {
        key: 'QUALITY_LOSS',
        target: 'packet loss <=5% samples >=95% (24h)',
        pass: typeof lossPct === 'number' && lossPct >= 95,
        value: formatPct(lossPct),
      },
    ];

    const passed = checks.filter((c) => c.pass).length;
    const total = checks.length;
    const status = passed === total ? 'PASS' : 'PARTIAL';

    const report = {
      generatedAt: new Date().toISOString(),
      status,
      score: `${passed}/${total}`,
      checks,
      metrics: {
        callSetup: {
          samples: setupDurations.length,
          p95Sec: setupP95,
          le8SecPct: setupLe8Pct,
        },
        quality24h: {
          samples: qTotal,
          rttLe200Pct: rttPct,
          jitterLe80Pct: jitterPct,
          packetLossLe5Pct: lossPct,
        },
        recentCallVolume24h: {
          active: active24h,
          ended: ended24h,
          total: completed24h,
        },
      },
      notes: [
        'This report validates measurable backend KPIs from DB data.',
        'External network resilience (TURN/TLS 443 under restricted NAT) must be validated in real network tests.',
      ],
    };

    console.log(JSON.stringify(report, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('acceptance_report_failed', err);
  if (
    err &&
    typeof err.message === 'string' &&
    (err.message.includes("Can't reach database server") || err.message.includes('P1001'))
  ) {
    console.error(
      'Hint: pass a reachable DB URL, e.g. DATABASE_URL="postgresql://...?...sslmode=require" npm run acceptance:report',
    );
  }
  process.exit(1);
});
