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

const githubInstaller = { ...installer, name: "No.7.insert.Setup.0.1.5.exe" };
const githubPortable = { ...portable, name: "No.7.insert.0.1.5.exe" };

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
  const githubResponse = async () => new Response(JSON.stringify({ tag_name: "V0.1.5", assets: [githubPortable, githubInstaller] }), { status: 200 });
  const githubInstalled = await checkForUpdate("0.1.4", false, githubResponse);
  const githubUnpacked = await checkForUpdate("0.1.4", true, githubResponse);
  assert.equal(githubInstalled.asset.name, githubInstaller.name);
  assert.equal(githubInstalled.asset.installer, true);
  assert.equal(githubUnpacked.asset.name, githubPortable.name);
  assert.equal(githubUnpacked.asset.installer, false);
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


test("download retries a transient failure, but not missing or corrupt assets", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "no7-retry-test-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const bytes = Buffer.from("test"), digest = "sha256:" + crypto.createHash("sha256").update(bytes).digest("hex");
  const asset = { name: installer.name, url: installer.browser_download_url, size: 4, digest, installer: true };
  let calls = 0;
  const result = await downloadUpdate(asset, directory, () => {}, async () => ++calls === 1 ? new Response("", { status:503 }) : new Response(bytes), { retryDelayMs:0 });
  assert.equal(calls,2); assert.equal(result.verified,true);
  for (const status of [404,200]) {
    calls=0;
    await assert.rejects(downloadUpdate({...asset,digest:"sha256:"+"0".repeat(64)},directory,()=>{},async()=>{calls++;return new Response(bytes,{status});},{retryDelayMs:0}), status===404 ? /下载失败/ : /校验失败/);
    assert.equal(calls,1);
  }
});

test("connection timeout aborts, reports an actionable error and retries once", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "no7-connect-test-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  let calls=0;
  const hung=(_url,{signal})=>{calls++;return new Promise((resolve,reject)=>signal.addEventListener("abort",()=>reject(signal.reason),{once:true}));};
  await assert.rejects(downloadUpdate({name:installer.name,url:installer.browser_download_url,size:4,digest:"",installer:true},directory,()=>{},hung,{connectTimeoutMs:15,retryDelayMs:0}),/连接.*超时.*系统代理/);
  assert.equal(calls,2);
});

test("stalled response body is aborted and partial download is removed", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "no7-idle-test-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const stalled=async()=>new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array([1]));}}));
  await assert.rejects(downloadUpdate({name:installer.name,url:installer.browser_download_url,size:4,digest:"",installer:true},directory,()=>{},stalled,{idleTimeoutMs:15,maxAttempts:1}),/没有收到数据.*重试/);
  const files=await fs.readdir(path.join(directory,"No. 7 insert updates","0.1.5"));
  assert.deepEqual(files,[]);
});
