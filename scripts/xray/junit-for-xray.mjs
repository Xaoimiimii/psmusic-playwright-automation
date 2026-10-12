// Prepares Playwright's JUnit report for Xray. Tests assert the user story, not the current behavior
// (docs/test-strategy/test-strategy.md, "Rule for expected results"). A test that hits a known defect calls
// knownDefect() (src/support/known-defect.ts), which marks it test.fail(), so Playwright and JUnit report the
// reproduced defect as a pass. Imported as is, Xray would show the Test PASSED while the Bug is open.
// This flips the status of known-defect testcases only:
//   defect reproduced (expected failure, no <failure>)   -> <failure>: Xray FAILED, message names the defect
//   defect not reproduced (unexpected pass, <failure>)   -> no <failure>: Xray PASSED, testrun_comment asks for review
// knownDefect() is called right before the story assertion; a failure before that line happens before test.fail()
// is set, so it stays an ordinary failure and is not touched here.

const escapeXml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const unescapeXml = (s) => s.replace(/&quot;/g, '"').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');

/** Number of <testcase> elements in a JUnit report. */
export const countTestcases = (xml) => (xml.match(/<testcase /g) ?? []).length;

/** Testcases without a test_key property: Xray would create a new Generic Test for each (xray doc §6.2). */
export const countUnkeyedTestcases = (xml) => countTestcases(xml) - (xml.match(/name="test_key"/g) ?? []).length;

/** Returns { xml, changes } where changes lists each testcase whose status was flipped. */
export function knownDefectsToXrayStatus(xml) {
  const changes = [];
  const out = xml.replace(/<testcase\b[^>]*>[\s\S]*?<\/testcase>/g, (block) => {
    const defect = block.match(/<property name="known-defect" value="([^"]*)"/)?.[1];
    if (!defect || !/<property name="fail" /.test(block)) return block;
    const name = unescapeXml(block.match(/<testcase name="([^"]*)"/)?.[1] ?? '');
    const failure = /<failure\b[\s\S]*?(<\/failure>|\/>)/;
    if (failure.test(block)) {
      changes.push({ testcase: name, xrayStatus: 'PASSED', reason: 'known defect did not reproduce' });
      const comment = `Known defect ${unescapeXml(defect)} did not reproduce: the story assertion passed. Review whether the Bug is fixed and remove knownDefect().`;
      return block
        .replace(failure, '')
        .replace('</properties>', `<property name="testrun_comment" value="${escapeXml(comment)}">\n</property>\n</properties>`);
    }
    changes.push({ testcase: name, xrayStatus: 'FAILED', reason: 'known defect reproduced' });
    const message = escapeXml(`Known defect reproduced: ${unescapeXml(defect)}`);
    return block.replace('</properties>', `</properties>\n<failure message="${message}" type="KnownDefect">${message}</failure>`);
  });
  return { xml: out, changes };
}
