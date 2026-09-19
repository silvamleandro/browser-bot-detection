/**
 * Humanized journey: a deliberately strong adversary.
 *
 * A weak imitation would flatter the detector, so this uses the minimum-jerk
 * trajectory (Flash & Hogan, 1985) plus the things a real hand does: positional
 * noise, overshoot with a corrective submovement, log-normal step and keystroke
 * timing floored above human motor limits, and real wheel events instead of
 * scrollTo().
 *
 * Results against this journey are reported separately from the naive one.
 */

/** Log-normal sample, matching the right-skewed shape of human timing intervals. */
function logNormal(median, sigma = 0.35) {
  const u1 = Math.random() || 1e-9;
  const u2 = Math.random() || 1e-9;
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return median * Math.exp(sigma * z);
}

function gauss(sd) {
  const u1 = Math.random() || 1e-9;
  const u2 = Math.random() || 1e-9;
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2) * sd;
}

/** Minimum-jerk position profile: 10t^3 - 15t^4 + 6t^5. */
function minJerk(t) {
  return 10 * t ** 3 - 15 * t ** 4 + 6 * t ** 5;
}

/** Returns the final position so movements can be chained. */
async function humanMove(page, from, to, { steps = null } = {}) {
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  // Fitts's law: movement time grows with distance and target difficulty.
  const duration = 180 + 120 * Math.log2(1 + dist / 40);
  const n = steps || Math.max(12, Math.round(duration / 12));

  // Overshoot then correct: the two-phase reach.
  const overshoot = dist > 120 && Math.random() < 0.7;
  const primary = overshoot
    ? { x: to.x + gauss(dist * 0.04), y: to.y + gauss(dist * 0.04) }
    : to;

  // Perpendicular bow, so the path arcs.
  const mx = (from.x + primary.x) / 2;
  const my = (from.y + primary.y) / 2;
  const nx = -(primary.y - from.y);
  const ny = primary.x - from.x;
  const nlen = Math.hypot(nx, ny) || 1;
  const bow = gauss(dist * 0.06);
  const ctrl = { x: mx + (nx / nlen) * bow, y: my + (ny / nlen) * bow };

  for (let i = 1; i <= n; i++) {
    const tau = minJerk(i / n);
    // Bezier at the minimum-jerk time warp: curved in space, ballistic in time.
    const u = 1 - tau;
    let x = u * u * from.x + 2 * u * tau * ctrl.x + tau * tau * primary.x;
    let y = u * u * from.y + 2 * u * tau * ctrl.y + tau * tau * primary.y;
    x += gauss(0.6);
    y += gauss(0.6);
    await page.mouse.move(x, y);
    await page.waitForTimeout(Math.max(1, logNormal(duration / n, 0.5)));
  }

  if (overshoot) {
    const csteps = 4 + Math.floor(Math.random() * 4);
    for (let i = 1; i <= csteps; i++) {
      const tau = minJerk(i / csteps);
      await page.mouse.move(
        primary.x + (to.x - primary.x) * tau + gauss(0.4),
        primary.y + (to.y - primary.y) * tau + gauss(0.4),
      );
      await page.waitForTimeout(Math.max(1, logNormal(14, 0.4)));
    }
  }
  return to;
}

async function centerOf(page, selector) {
  const box = await page.locator(selector).boundingBox();
  if (!box) throw new Error(`sem bounding box: ${selector}`);
  return {
    x: box.x + box.width * (0.3 + Math.random() * 0.4),
    y: box.y + box.height * (0.3 + Math.random() * 0.4),
  };
}

/**
 * Bring a target into view with wheel events, the way a person does.
 *
 * `scrollIntoView()` would be a scripted scroll, which is exactly the behaviour
 * this journey exists to avoid producing. It also matters mechanically: a wheel
 * dispatched with the pointer outside the viewport is delivered to nothing, so on
 * a 1280x720 window the scroll box below the fold received no wheel events at all.
 */
async function wheelIntoView(page, selector) {
  const vp = page.viewportSize() || { width: 1280, height: 720 };
  for (let i = 0; i < 15; i++) {
    const box = await page.locator(selector).boundingBox();
    if (!box) return;
    const below = box.y + box.height >= vp.height - 40;
    const above = box.y <= 60;
    if (!below && !above) return;
    await page.mouse.wheel(0, (below ? 1 : -1) * (110 + Math.round(gauss(25))));
    await page.waitForTimeout(Math.max(10, logNormal(55, 0.4)));
  }
}

/**
 * Reach for a target and press it.
 *
 * The position is measured again at the end of the reach. The page re-renders
 * while we are moving, and the first version of this journey pressed wherever the
 * target had been when the movement started: every one of the 31 recorded
 * sessions clicked past the field and typed into the document instead, which made
 * the space characters scroll the page. The detector was reading that as scripted
 * scrolling, so the strongest adversary in the matrix was being caught by a bug in
 * itself. Re-measuring keeps the imitation honest.
 */
async function reachAndPress(page, from, selector) {
  let pos = await humanMove(page, from, await centerOf(page, selector));

  const target = await centerOf(page, selector);
  if (Math.hypot(target.x - pos.x, target.y - pos.y) > 6) {
    pos = await humanMove(page, pos, target, { steps: 6 });
  }

  await page.mouse.down();
  await page.waitForTimeout(logNormal(82, 0.3));
  await page.mouse.up();
  return pos;
}

export async function run(page, { log = () => {} } = {}) {
  // People read before they act.
  await page.waitForTimeout(logNormal(1800, 0.4));

  const vp = page.viewportSize() || { width: 1280, height: 720 };
  let pos = { x: vp.width * 0.5 + gauss(60), y: vp.height * 0.4 + gauss(60) };
  await page.mouse.move(pos.x, pos.y);

  log('move to field');
  await wheelIntoView(page, '#field');
  pos = await reachAndPress(page, pos, '#field');

  // Typing into the page instead of into the field is a different journey from the
  // one this claims to be, so it fails loudly rather than recording a lie.
  let focused = await page.evaluate(() => document.activeElement?.id === 'field');
  if (!focused) {
    pos = await reachAndPress(page, pos, '#field');
    focused = await page.evaluate(() => document.activeElement?.id === 'field');
  }
  if (!focused) throw new Error('campo não recebeu foco depois de dois cliques');

  log('type');
  const text = 'sessao de teste humanizada';
  for (const ch of text) {
    await page.keyboard.down(ch === ' ' ? 'Space' : ch);
    await page.waitForTimeout(Math.max(20, logNormal(75, 0.3)));
    await page.keyboard.up(ch === ' ' ? 'Space' : ch);
    // Log-normal, floored above the motor limit, with occasional thinking pauses.
    let gap = logNormal(120, 0.45);
    if (Math.random() < 0.08) gap += logNormal(400, 0.5);
    await page.waitForTimeout(Math.max(35, gap));
  }

  log('move to button');
  await page.waitForTimeout(logNormal(300, 0.4));
  await wheelIntoView(page, '#btn');
  pos = await reachAndPress(page, pos, '#btn');

  log('scroll');
  await page.waitForTimeout(logNormal(500, 0.4));
  await wheelIntoView(page, '#scrollbox');
  pos = await humanMove(page, pos, await centerOf(page, '#scrollbox'));
  // Short bursts of real wheel events.
  const bursts = 3 + Math.floor(Math.random() * 3);
  for (let b = 0; b < bursts; b++) {
    const ticks = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < ticks; i++) {
      await page.mouse.wheel(0, 100 + Math.round(gauss(20)));
      await page.waitForTimeout(Math.max(8, logNormal(45, 0.4)));
    }
    await page.waitForTimeout(logNormal(320, 0.5));
  }

  log('idle');
  for (let i = 0; i < 3; i++) {
    pos = await humanMove(page, pos, {
      x: Math.max(10, Math.min(vp.width - 10, pos.x + gauss(120))),
      y: Math.max(10, Math.min(vp.height - 10, pos.y + gauss(90))),
    });
    await page.waitForTimeout(logNormal(400, 0.5));
  }
  log('done');
}

/** What this journey promises to have produced. Checked before the run is stored. */
export async function verify(page) {
  const value = await page.inputValue('#field');
  if (value !== 'sessao de teste humanizada') {
    throw new Error(`campo contém "${value}", não o texto digitado`);
  }
  const wheels = await page.evaluate(() => (window.__getSession?.().events || [])
    .filter((e) => e.e === 'wh').length);
  if (wheels < 3) throw new Error(`apenas ${wheels} eventos de roda gravados`);
}
