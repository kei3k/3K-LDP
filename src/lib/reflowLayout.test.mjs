// Pure-logic test for computeShifts — no DOM required, runs under plain Node.
// Run: node src/lib/reflowLayout.test.mjs
import { computeShifts } from './reflowLayout.js';

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; }
  else { fail++; console.error('FAIL:', msg); }
}

// ── Test 1: single element grows, one sibling below shifts, none above ──────
{
  const elements = [
    { id: 'a', top: 0, height: 100 },   // grows
    { id: 'b', top: 100, height: 50 },  // sits right below a — must shift
    { id: 'c', top: 200, height: 50 },  // further below — must shift too
    { id: 'd', top: 0, height: 30 },    // beside a (not below) — must NOT shift
  ];
  const { shifts, sectionDelta, log } = computeShifts(elements, { a: 40 });
  assert(shifts.get('a') === 0, 'grower itself does not shift');
  assert(shifts.get('b') === 40, 'sibling immediately below shifts by full grow amount');
  assert(shifts.get('c') === 40, 'sibling further below also shifts by full grow amount');
  assert(shifts.get('d') === 0, 'sibling beside (not below) does not shift');
  assert(sectionDelta === 40, 'section delta equals the grow amount');
  assert(log.length === 1 && log[0].shiftedCount === 2, 'log records 1 grower shifting 2 elements');
}

// ── Test 2: two elements grow, deltas accumulate for elements below both ────
{
  const elements = [
    { id: 'a', top: 0, height: 100 },   // grows by 30
    { id: 'b', top: 100, height: 60 },  // grows by 20, sits below a
    { id: 'c', top: 160, height: 40 },  // sits below both a and b — must accumulate both deltas
  ];
  const { shifts, sectionDelta } = computeShifts(elements, { a: 30, b: 20 });
  assert(shifts.get('a') === 0, 'a (topmost grower) does not shift itself');
  assert(shifts.get('b') === 30, 'b shifts down by a\'s growth (a is above b)');
  // c sits below a's original bottom (100) AND below b's shifted+grown bottom.
  // a grows 30 -> c shifts +30 from that. b (now at top=130, grown height 80) bottom=210,
  // c's current top (160+30=190) < 210 so it should ALSO shift by b's 20.
  assert(shifts.get('c') === 50, 'c accumulates both a\'s and b\'s growth (30+20=50)');
  assert(sectionDelta === 50, 'section delta accumulates both growths (30+20=50)');
}

// ── Test 3: no growth => no shifts, zero delta ──────────────────────────────
{
  const elements = [
    { id: 'a', top: 0, height: 100 },
    { id: 'b', top: 100, height: 50 },
  ];
  const { shifts, sectionDelta, log } = computeShifts(elements, { a: 0, b: -10 });
  assert(shifts.get('a') === 0 && shifts.get('b') === 0, 'zero/negative growth causes no shift');
  assert(sectionDelta === 0, 'zero delta when nothing grew');
  assert(log.length === 0, 'no log entries when nothing grew');
}

// ── Test 4: element with no growth entry (absent from map) is treated as 0 ──
{
  const elements = [
    { id: 'a', top: 0, height: 100 },
    { id: 'b', top: 100, height: 50 },
  ];
  const { shifts } = computeShifts(elements, {}); // empty growth map
  assert(shifts.get('a') === 0 && shifts.get('b') === 0, 'absent growth entries default to no shift');
}

// ── Test 5: growth using a Map instance instead of plain object ─────────────
{
  const elements = [
    { id: 'a', top: 0, height: 100 },
    { id: 'b', top: 100, height: 50 },
  ];
  const growthMap = new Map([['a', 25]]);
  const { shifts, sectionDelta } = computeShifts(elements, growthMap);
  assert(shifts.get('b') === 25, 'Map input works identically to plain object input');
  assert(sectionDelta === 25, 'sectionDelta correct with Map input');
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
