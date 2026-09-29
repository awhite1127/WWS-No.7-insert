"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { checkForUpdate, compareVersions, downloadUpdate } = require("../electron/update-service.cjs");

const installer = {
  name: "No. 7 insert Setup 0.1.5.exe",
  browser_download_url: "https://github.com/awhite1127/WWS-No.7-insert/releases/download/V0.1.5/No.7.exe",
  size: 4,
};
const portable = {
  name: "No. 7 insert 0.1.5.exe",
  browser_download_url: "https://github.com/awhite1127/WWS-No.7-insert/releases/download/V0.1.5/portable.exe",
  size: 4,
};

test("compares release versions and selects the matching Windows package", async () => {
  assert.equal(compareVersions("V0.1.5", "0.1.4"), 1);
  assert.equal(compareVersions("0.1.3", "0.1.4"), -1);
  const response = async () => new Response(JSON.stringify({ tag_name: "V0.1.5", assets: [portable, installer] }), { status: 200 });
  const installed = await checkForUpdate("0.1.4", false, response);
  const unpacked = await checkForUpdate("0.1.4", true, response);
  assert.equal(installed.asset.name, installer.name);
  assert.equal(unpacked.asset.name, portable.name);
  assert.equal(installed.updateAvailable, true);
  const current = await checkForUpdate("0.1.5", false, response);
  assert.equal(current.updateAvailable, false);
  assert.equal(current.asset, null);
});

test("downloads a release only after matching its GitHub SHA-256 digest", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "no7-update-test-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const bytes = Buffer.from("test");
  const digest = `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;
  const asset = { name: installer.name, url: installer.browser_download_url, size: bytes.length, digest, installer: true };
  const progress = [];
  const download = () => new Response(bytes, { status: 200 });
  const result = await downloadUpdate(asset, directory, (value) => progress.push(value), download);
  assert.equal(result.verified, true);
  assert.deepEqual(await fs.readFile(result.path), bytes);
  assert.equal(progress.at(-1).percent, 100);
  const reused = await downloadUpdate(asset, directory, () => {}, () => { throw new Error("Cached installer must not be downloaded again"); });
  assert.equal(reused.path, result.path);
  assert.equal(reused.verified, true);
  await assert.rejects(downloadUpdate({ ...asset, digest: `sha256:${"0".repeat(64)}` }, directory, () => {}, download), /校验失败/);
  assert.equal((await fs.readdir(path.dirname(result.path))).filter((name) => name.endsWith(".download")).length, 0);
});

test("download progress is throttled while the final byte count remains exact", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "no7-progress-test-"));
  t.after(async () => {
    const resolved = path.resolve(directory);
    assert.ok(resolved.startsWith(path.resolve(os.tmpdir()) + path.sep));
    await fs.rm(resolved, { recursive: true, force: true });
  });
  t.mock.method(Date, "now", () => 12345);
  const progress = [];
  const body = new ReadableStream({ start(controller) {
    for (let i = 0; i < 200; i++) controller.enqueue(new Uint8Array([i]));
    controller.close();
  } });
  await downloadUpdate({ name: installer.name, url: installer.browser_download_url, size: 200, digest: "", installer: true },
    directory, (value) => progress.push(value), async () => new Response(body));
  assert.ok(progress.length <= 2);
  assert.equal(progress.at(-1).received, 200);
  assert.equal(progress.at(-1).percent, 100);
});
