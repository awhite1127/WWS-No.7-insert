"use strict";

const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const output = path.resolve(projectRoot, "dist");
if (path.dirname(output) !== projectRoot || path.basename(output) !== "dist") {
  throw new Error("Refusing to clean outside the project build directory");
}
function cleanDirectory(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const child = path.join(directory, entry.name);
    if (entry.isDirectory() && !entry.isSymbolicLink()) {
      cleanDirectory(child);
      fs.rmdirSync(child);
    } else {
      fs.unlinkSync(child);
    }
  }
}

if (fs.existsSync(output)) {
  const info = fs.lstatSync(output);
  if (info.isSymbolicLink() || fs.realpathSync(output) !== output) {
    throw new Error("Refusing to clean a linked build directory");
  }
  cleanDirectory(output);
  if (fs.readdirSync(output).length) {
    throw new Error("Build directory still contains files after cleanup");
  }
  fs.rmdirSync(output);
}
