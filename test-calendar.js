// Test calendar gap algorithm

function testCalendarGaps() {
  const base = new Date('2026-10-11T10:00:00Z');

  // Busy intervals: 12:00-13:00 and 15:30-16:30
  const busy = [
    { start: new Date('2026-10-11T12:00:00Z'), end: new Date('2026-10-11T13:00:00Z') },
    { start: new Date('2026-10-11T15:30:00Z'), end: new Date('2026-10-11T16:30:00Z') },
  ];

  const windowStart = new Date('2026-10-11T10:00:00Z');
  const windowEnd = new Date('2026-10-11T20:00:00Z');

  let currentPointer = new Date(windowStart);
  const gaps = [];

  for (const b of busy) {
    const gapMs = b.start.getTime() - currentPointer.getTime();
    const gapMinutes = Math.floor(gapMs / (1000 * 60));
    if (gapMinutes >= 60) {
      gaps.push({
        start: currentPointer.toISOString(),
        end: b.start.toISOString(),
        durationMinutes: gapMinutes
      });
    }
    currentPointer = new Date(b.end);
  }

  const finalGapMinutes = Math.floor((windowEnd.getTime() - currentPointer.getTime()) / (1000 * 60));
  if (finalGapMinutes >= 60) {
    gaps.push({
      start: currentPointer.toISOString(),
      end: windowEnd.toISOString(),
      durationMinutes: finalGapMinutes
    });
  }

  console.log('Detected Gaps:', JSON.stringify(gaps, null, 2));

  if (gaps.length === 3 && gaps[0].durationMinutes === 120 && gaps[1].durationMinutes === 150) {
    console.log('✅ PASS: Calendar gap algorithm correctly identified 1-hour+ free windows!');
  } else {
    console.error('❌ FAIL: Unexpected gaps');
    process.exit(1);
  }
}

testCalendarGaps();
