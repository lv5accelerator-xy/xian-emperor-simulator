"use strict";
// 重构安全网：用同一套对局脚本和测试夹具，分别驱动基线提交与当前工作区的 src，
// 比较 15 条固定种子完整对局终局时的全部存储。任何“不应改变结果”的改动都应当零差异。
// 用法：node scripts/playthrough-equivalence.cjs [基线提交，默认 HEAD] [--ignore=键名,键名]
// 现有回归多不超过六个月；本脚本覆盖 12 至 24 个月的长局，耗时数分钟，故不并入 check.cjs。
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const { spawn, execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const args = process.argv.slice(2);
const baseRef = args.find(arg => !arg.startsWith("--")) || "HEAD";
const ignored = new Set((args.find(arg => arg.startsWith("--ignore="))?.slice(9) || "").split(",").filter(Boolean));
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "xian-equivalence-"));
const baseTree = path.join(temp, "base");
const git = (...argv) => execFileSync("git", argv, { cwd: root, stdio: ["ignore", "pipe", "pipe"] }).toString().trim();

// 时间戳与由时钟生成的编号每次运行都不同，不属于玩法结果。
function normalize(text) {
  return text.replace(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?Z/g, "<time>").replace(/\d{9,}/g, "0");
}
function strip(value) {
  if (Array.isArray(value)) return value.map(strip);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([key]) => !ignored.has(key)).map(([key, item]) => [key, strip(item)]));
  return value;
}
function differences(a, b, trail, found, limit = 40) {
  if (found.length >= limit) return;
  if (a === b) return;
  const objects = a && b && typeof a === "object" && typeof b === "object" && Array.isArray(a) === Array.isArray(b);
  if (!objects) { found.push(`${trail || "(根)"}：${JSON.stringify(a)?.slice(0, 80)} → ${JSON.stringify(b)?.slice(0, 80)}`); return; }
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) differences(a[key], b[key], trail ? `${trail}.${key}` : key, found, limit);
}
function play(tree, label) {
  const output = path.join(temp, `${label}-stores.json`);
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(tree, "scripts/normal-playthrough.cjs")], { cwd: tree,
      env: { ...process.env, NORMAL_OUTPUT: path.join(temp, `${label}-rows.json`), NORMAL_STORES_OUTPUT: output } });
    let log = ""; child.stdout.on("data", chunk => log += chunk); child.stderr.on("data", chunk => log += chunk);
    child.on("exit", code => code ? reject(new Error(`${label} 对局失败：\n${log.slice(-2000)}`)) : resolve(strip(JSON.parse(normalize(fs.readFileSync(output, "utf8"))))));
  });
}

(async () => {
  try {
    const commit = git("rev-parse", "--short", baseRef);
    git("worktree", "add", "--detach", baseTree, baseRef);
    // 两边使用同一份对局脚本与夹具，只有 src（及其余运行文件）不同。
    for (const file of ["scripts/normal-playthrough.cjs", "tests/helpers/game-harness.js"]) fs.copyFileSync(path.join(root, file), path.join(baseTree, file));
    console.log(`对照基线 ${commit} 与当前工作区，各跑 15 条完整对局……`);
    const [base, current] = await Promise.all([play(baseTree, "base"), play(root, "current")]);
    const found = []; differences(base, current, "", found);
    if (found.length) {
      console.error(`FAIL 终局存储与基线 ${commit} 不一致（最多列出 40 处）：`);
      for (const line of found) console.error(`  ${line}`);
      process.exitCode = 1;
    } else console.log(`PASS ${current.length} 条完整对局终局时的全部存储与基线 ${commit} 一致${ignored.size ? `（忽略键：${[...ignored].join("、")}）` : ""}。`);
  } catch (error) { console.error(error.message || error); process.exitCode = 1; }
  finally {
    try { git("worktree", "remove", "--force", baseTree); } catch (_) { /* 基线工作树可能尚未建立。 */ }
    fs.rmSync(temp, { recursive: true, force: true });
  }
})();
