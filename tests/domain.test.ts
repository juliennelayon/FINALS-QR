import { eventDateTime } from "../lib/domain";
import { parseProposal, proposalPreview } from "../lib/requestPayload";
import assert from "node:assert/strict";
import {
  phase,
  parsePH,
  phInput,
  monthKey,
  rate,
  type ScanEvent,
} from "../lib/domain";
let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log("PASS", name);
}
const start = Date.parse("2026-10-24T00:00:00Z"),
  end = start + 3600000;
const e: ScanEvent = {
  event_code: "TEST",
  title: "Test",
  venue: null,
  description: null,
  created_by: null,
  created_at: new Date(start).toISOString(),
  audience_course: null,
  audience_year: null,
  audience_block: null,
  late_minutes: 15,
  archived: false,
  id: "e",
  status: "open",
  required: true,
  start_time: new Date(start).toISOString(),
  end_time: new Date(end).toISOString(),
};
test("upcoming before start", () =>
  assert.equal(phase(e, start - 1), "Upcoming"));
test("ongoing at exact start", () => assert.equal(phase(e, start), "Ongoing"));
test("ended at exact end", () => assert.equal(phase(e, end), "Ended"));
test("manual closure overrides ongoing", () =>
  assert.equal(phase({ ...e, status: "closed" }, start), "Closed"));
test("cancelled overrides end", () =>
  assert.equal(phase({ ...e, status: "cancelled" }, end), "Cancelled"));
test("draft remains draft", () =>
  assert.equal(phase({ ...e, status: "draft" }, end), "Draft"));
test("Philippine date parsing independent of host timezone", () =>
  assert.equal(parsePH("2026-10-24 08:00"), "2026-10-24T00:00:00.000Z"));
test("invalid calendar dates rejected", () =>
  assert.throws(() => parsePH("2026-02-30 08:00")));
test("PH date round trip", () =>
  assert.equal(phInput("2026-10-24T00:00:00Z"), "2026-10-24 08:00"));
test("month grouping uses PH midnight", () =>
  assert.equal(monthKey("2026-09-30T16:00:00Z"), "2026-10"));
test("rate counts Present and Late against assignments", () =>
  assert.equal(
    rate(
      [
        { event_id: "e", student_id: "a", status: "present" },
        { event_id: "e", student_id: "b", status: "late" },
      ],
      [e],
      [
        { event_id: "e", student_id: "a" },
        { event_id: "e", student_id: "b" },
        { event_id: "e", student_id: "c" },
      ],
      undefined,
      end,
    ),
    67,
  ));
test("no completed required assignments returns null", () =>
  assert.equal(
    rate(
      [],
      [{ ...e, required: false }],
      [{ event_id: "e", student_id: "a" }],
      undefined,
      end,
    ),
    null,
  ));
test("malformed request proposals do not crash preview", () =>
  assert.deepEqual(proposalPreview("broken"), {}));
test("invalid proposals cannot be submitted", () =>
  assert.throws(() => parseProposal("broken")));
test("array proposals are rejected", () =>
  assert.throws(() => parseProposal("[1,2]")));
test("unchanged event schedule preserves original seconds", () =>
  assert.equal(
    eventDateTime("2026-10-24 08:00", "2026-10-24T00:00:42.000Z"),
    "2026-10-24T00:00:42.000Z",
  ));
test("changed event schedule uses the selected PH minute", () =>
  assert.equal(
    eventDateTime("2026-10-24 08:30", "2026-10-24T00:00:42.000Z"),
    "2026-10-24T00:30:00.000Z",
  ));
console.log(`${passed} domain checks passed`);
