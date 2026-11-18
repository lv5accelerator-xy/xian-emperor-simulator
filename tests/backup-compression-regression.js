"use strict";
// 备份压缩：完整备份只把 bundle 压成 packed 字符串，元数据保持明文；解压后与压缩前逐字相同；
// 旧版明文 bundle 条目与新条目混在一起时都能读取、恢复；存储体积明显变小。
const assert = require("node:assert/strict");
const { harness, plain, CORE_KEY } = require("./helpers/game-harness");
const BACKUP_KEY = "xian_emperor_save_backups_v2180";

function ready(stores = {}) { const run = harness(stores, .91); run.loadMechanics(); run.mount("save-backups"); run.flush(); return run; }
function oneMonth(run) { run.decide(1); run.api.endTurn(); run.flush(); }

const run = ready();
run.api.startNewGame("standard", "jianan_196", { randomSeed: 20261118 }); run.flush();
for (let month = 0; month < 6; month++) oneMonth(run);
const raw = run.localStorage.getItem(BACKUP_KEY), stored = JSON.parse(raw);
assert.equal(stored.months.length, 3);
for (const entry of stored.months) {
  assert.equal(typeof entry.packed, "string", "monthly backups are stored compressed");
  assert.equal(Object.hasOwn(entry, "bundle"), false, "the plain bundle is not stored next to the packed copy");
  assert.ok(Number.isInteger(entry.turn) && entry.label, "metadata stays readable without decompression");
  assert.ok(![...entry.packed].some(char => { const code = char.charCodeAt(0); return code >= 0xd800 && code <= 0xdfff; }), "packed text has no lone surrogates");
}
const entries = run.window.XianSaveBackups.getEntries();
const live = plain(run.api.captureFullSave());
assert.deepEqual(plain(entries[0].bundle.stores), live.stores, "the newest backup unpacks to exactly the state it captured");
const plainSize = entries.reduce((sum, entry) => sum + JSON.stringify(entry.bundle).length, 0);
assert.ok(raw.length * 4 < plainSize, `compressed index (${raw.length} chars) is far smaller than the plain bundles (${plainSize})`);

// 旧版明文条目：保留原样可读，新月份写入时不被改写，也能用于恢复。
const legacyBundle = plain(run.api.captureFullSave());
const legacyEntry = { id: `${legacyBundle.stores[CORE_KEY].createdAt}:${legacyBundle.stores[CORE_KEY].turn}`, label: "月度自动留档", capturedAt: "2026-01-01T00:00:00.000Z",
  scenarioId: legacyBundle.stores[CORE_KEY].scenarioId, turn: legacyBundle.stores[CORE_KEY].turn, year: 196, month: 1, ended: false, challengeId: null, bundle: legacyBundle };
const asStrings = stores => Object.fromEntries(Object.entries(stores).map(([key, value]) => [key, typeof value === "string" ? value : JSON.stringify(value)]));
const mixed = ready({ ...asStrings(legacyBundle.stores), [BACKUP_KEY]: JSON.stringify({ version: 1, months: [legacyEntry], replacement: { ...legacyEntry, label: "开启新局前" } }) });
const read = mixed.window.XianSaveBackups.getEntries();
assert.equal(read.length, 2);
assert.deepEqual(plain(read[0].bundle), legacyBundle, "legacy plain replacement entry still reads");
assert.deepEqual(plain(read[1].bundle), legacyBundle, "legacy plain monthly entry still reads");
assert.equal(mixed.window.XianSaveBackups.captureBeforeReplacement("测试"), true);
const after = JSON.parse(mixed.localStorage.getItem(BACKUP_KEY));
assert.equal(typeof after.replacement.packed, "string", "a newly written backup is packed");
assert.ok(after.months[0].bundle && !after.months[0].packed, "existing legacy entries are kept as they were");
const reread = mixed.window.XianSaveBackups.getEntries();
assert.deepEqual(plain(reread[1].bundle), legacyBundle, "legacy entry still restores after a new packed entry is written");
assert.deepEqual(plain(reread[0].bundle.stores[CORE_KEY]), plain(mixed.api.captureFullSave().stores[CORE_KEY]), "new packed entry unpacks to the live state");
console.log(`backup-compression-regression passed: ${plainSize} → ${raw.length} chars for three monthly backups`);
