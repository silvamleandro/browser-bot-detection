/**
 * Naive journey: fill(), click(), scrollTo(). No concealment.
 * The lower bound of adversary sophistication, and it should be trivial to catch.
 */
export async function run(page, { log = () => {} } = {}) {
  await page.waitForTimeout(1500 + Math.random() * 800);

  log('fill');
  await page.fill('#field', 'sessao automatizada de teste');

  log('click');
  await page.click('#btn');
  await page.waitForTimeout(300);

  log('scroll');
  await page.evaluate(() => {
    const box = document.getElementById('scrollbox');
    if (box) box.scrollTo(0, 500);
    window.scrollTo(0, 300);
  });

  await page.waitForTimeout(800);
  log('done');
}

/** What this journey promises to have produced. Checked before the run is stored. */
export async function verify(page) {
  const value = await page.inputValue('#field');
  if (value !== 'sessao automatizada de teste') {
    throw new Error(`campo contém "${value}", não o texto preenchido`);
  }
}
