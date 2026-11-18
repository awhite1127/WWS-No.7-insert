"use strict";

const fs = require("node:fs/promises");
const { parseArenaData } = require("./arena-parser.cjs");

const REPLAY_SIGNATURE = 0x12323411;
const MAX_METADATA_BYTES = 1024 * 1024;

async function readReplayArena(filePath) {
  const file = await fs.open(filePath, "r");
  try {
    // The first block is a length-prefixed JSON roster. The packet stream follows the metadata blocks.
    const header = Buffer.alloc(12);
    const { bytesRead } = await file.read(header, 0, header.length, 0);
    if (bytesRead !== header.length || header.readUInt32BE(0) !== REPLAY_SIGNATURE || !header.readUInt32LE(4)) {
      throw new Error("请选择一份已完成录制的《战舰世界》录像");
    }
    const length = header.readUInt32LE(8);
    if (length === 0 || length > MAX_METADATA_BYTES) throw new Error("录像的阵容信息长度无效");

    const metadata = Buffer.alloc(length);
    const block = await file.read(metadata, 0, length, header.length);
    if (block.bytesRead !== length) throw new Error("录像的阵容信息不完整");
    const raw = JSON.parse(metadata.toString("utf8").replace(/^\uFEFF/, ""));
    const arena = parseArenaData(raw);
    const recorder = arena.players.find(player => player.name === raw.playerName);
    const recorderId = Number(raw.playerID);
    if (recorder && !recorder.accountId && Number.isSafeInteger(recorderId) && recorderId > 0) {
      recorder.accountId = recorderId;
    }
    const battleMode = [arena.matchGroup, raw.gameType, raw.gameMode, arena.gameMode].some(value => /(?:^|_)rank(?:ed)?(?:$|_)/i.test(value))
      ? "ranked" : "random";
    return { ...arena, battleMode };
  } finally {
    await file.close();
  }
}

module.exports = { readReplayArena };
