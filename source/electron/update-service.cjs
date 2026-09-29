"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { Readable, Transform } = require("node:stream");
const { pipeline } = require("node:stream/promises");

const REPOSITORY = "awhite1127/WWS-No.7-insert";
const LATEST_URL = `https://api.github.com/repos/${REPOSITORY}/releases/latest`;

function versionParts(version) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:[.+-].*)?$/i.exec(String(version || "").trim());
  return match ? match.slice(1, 4).map(Number) : null;
}

function compareVersions(a, b) {
  const left = versionParts(a);
  const right = versionParts(b);
  if (!left || !right) throw new Error("无法识别发布版本号");
  for (let index = 0; index < 3; index++) {
    if (left[index] !== right[index]) return Math.sign(left[index] - right[index]);
  }
  return 0;
}

function validAsset(asset) {
  if (!asset || typeof asset.name !== "string" || !/^No\. 7 insert(?: Setup)? v?\d+\.\d+\.\d+\.exe$/i.test(asset.name)) return false;
  try {
    const url = new URL(asset.browser_download_url);
    return url.protocol === "https:" && url.hostname === "github.com"
      && url.pathname.startsWith(`/${REPOSITORY}/releases/download/`);
  } catch { return false; }
}

function chooseAsset(assets, portable) {
  const available = Array.isArray(assets) ? assets.filter(validAsset) : [];
  return available.find((asset) => portable ? !asset.name.includes(" Setup ") : asset.name.includes(" Setup "))
    || available[0] || null;
}

async function checkForUpdate(currentVersion, portable = false, fetcher = fetch) {
  const response = await fetcher(LATEST_URL, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": "No7Insert-Updater", "X-GitHub-Api-Version": "2022-11-28" },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(response.status === 404 ? "尚未找到公开发布版本" : `GitHub 检查失败（${response.status}）`);
  const release = await response.json();
  const latestVersion = String(release.tag_name || "").replace(/^v/i, "");
  const updateAvailable = compareVersions(latestVersion, currentVersion) > 0;
  const asset = updateAvailable ? chooseAsset(release.assets, portable) : null;
  return {
    currentVersion,
    latestVersion,
    updateAvailable,
    releaseUrl: `https://github.com/${REPOSITORY}/releases/tag/${encodeURIComponent(release.tag_name)}`,
    asset: asset ? {
      name: asset.name,
      url: asset.browser_download_url,
      size: Number(asset.size) || 0,
      digest: typeof asset.digest === "string" ? asset.digest : "",
      installer: asset.name.includes(" Setup "),
    } : null,
  };
}

async function downloadUpdate(asset, downloadsPath, onProgress = () => {}, fetcher = fetch) {
  if (!validAsset({ name: asset?.name, browser_download_url: asset?.url })) throw new Error("更新文件地址无效");
  const expected = /^sha256:([0-9a-f]{64})$/i.exec(asset.digest || "")?.[1]?.toLowerCase() || "";
  const version = versionParts(asset.name.match(/v?\d+\.\d+\.\d+/i)?.[0]);
  if (!version) throw new Error("更新文件版本无效");
  const directory = path.join(downloadsPath, "No. 7 insert updates", version.join("."));
  await fsp.mkdir(directory, { recursive: true });
  const destination = path.join(directory, asset.name);
  if (expected) {
    try {
      const existingHash = crypto.createHash("sha256");
      for await (const chunk of fs.createReadStream(destination)) existingHash.update(chunk);
      if (existingHash.digest("hex") === expected) {
        return { path: destination, verified: true, installer: asset.installer };
      }
    } catch {}
  }
  const response = await fetcher(asset.url, {
    headers: { "User-Agent": "No7Insert-Updater" },
    signal: AbortSignal.timeout(10 * 60 * 1000),
  });
  if (!response.ok || !response.body) throw new Error(`更新文件下载失败（${response.status}）`);
  const temporary = path.join(directory, `.${crypto.randomUUID()}.download`);
  const hash = crypto.createHash("sha256");
  const total = Number(asset.size) || Number(response.headers.get("content-length")) || 0;
  let received = 0;
  let lastProgressAt = 0;
  let reportedBytes = -1;
  const reportProgress = () => {
    reportedBytes = received;
    lastProgressAt = Date.now();
    onProgress({ received, total, percent: total ? Math.min(100, Math.round(received / total * 100)) : null });
  };
  try {
    await pipeline(Readable.fromWeb(response.body), new Transform({
      transform(chunk, _encoding, callback) {
        received += chunk.length;
        hash.update(chunk);
        if (Date.now() - lastProgressAt >= 100) reportProgress();
        callback(null, chunk);
      },
    }), fs.createWriteStream(temporary, { flags: "wx" }));
    if (reportedBytes !== received) reportProgress();
    if (asset.size && received !== asset.size) throw new Error("更新文件大小与发布信息不符");
    if (expected && hash.digest("hex") !== expected) throw new Error("更新文件校验失败");
    let finalPath = destination;
    try {
      await fsp.access(finalPath);
      finalPath = path.join(directory, `${path.basename(asset.name, ".exe")} (${Date.now()}).exe`);
    } catch {}
    await fsp.rename(temporary, finalPath);
    return { path: finalPath, verified: Boolean(expected), installer: asset.installer };
  } catch (error) {
    await fsp.rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
}

module.exports = { checkForUpdate, compareVersions, chooseAsset, downloadUpdate };
