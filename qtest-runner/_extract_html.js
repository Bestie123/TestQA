Index: qtest-runner/_extract_html.js
===================================================================
const fs = require("fs");

function extract(html, startMarker, endTag, maxLen) {
  const startIdx = html.indexOf(startMarker);
  if (startIdx === -1) return null;
  let depth = 0;
  let endIdx = -1;
  for (let i = startIdx; i < Math.min(html.length, startIdx + maxLen); i++) {
    if (html[i] === "<") {
      if (html.startsWith(endTag.start, i)) depth++;
      else if (html.startsWith(endTag.end, i)) {
        if (depth === 0) { endIdx = i + endTag.end.length; break; }
        depth--;
      }
    }
  }
  if (endIdx === -1) return null;
  return html.substring(startIdx, endIdx);
}

const html = fs.readFileSync("Q:/User_Data/Desktop/TestQA/qtest-runner/_zephyr_analysis/01_test_cases.html", "utf-8");

// Extract zephyr-scale-v2 span content
const zephyr = extract(html, '<span data-testid="zephyr-scale-v2"', { start: "<span ", end: "</span>" }, 200000);
if (zephyr) {
  fs.writeFileSync("Q:/User_Data/Desktop/TestQA/qtest-runner/_zephyr_analysis/zephyr_app.html", zephyr, "utf-8");
  console.log("Zephyr app saved, length:", zephyr.length);
} else console.log("Not found");

// Extract config page
const configHtml = fs.readFileSync("Q:/User_Data/Desktop/TestQA/qtest-runner/_zephyr_analysis/03_config.html", "utf-8");
const config = extract(configHtml, '<span data-testid="zephyr-scale-v2"', { start: "<span ", end: "</span>" }, 200000);
if (config) {
  fs.writeFileSync("Q:/User_Data/Desktop/TestQA/qtest-runner/_zephyr_analysis/zephyr_config.html", config, "utf-8");
  console.log("Config saved, length:", config.length);
}

// Extract settings page
const settingsHtml = fs.readFileSync("Q:/User_Data/Desktop/TestQA/qtest-runner/_zephyr_analysis/04_settings.html", "utf-8");
const settings = extract(settingsHtml, '<span data-testid="zephyr-scale-v2"', { start: "<span ", end: "</span>" }, 200000);
if (settings) {
  fs.writeFileSync("Q:/User_Data/Desktop/TestQA/qtest-runner/_zephyr_analysis/zephyr_settings.html", settings, "utf-8");
  console.log("Settings saved, length:", settings.length);
}

// Extract cycles page
const cyclesHtml = fs.readFileSync("Q:/User_Data/Desktop/TestQA/qtest-runner/_zephyr_analysis/02_test_cycles.html", "utf-8");
const cycles = extract(cyclesHtml, '<span data-testid="zephyr-scale-v2"', { start: "<span ", end: "</span>" }, 200000);
if (cycles) {
  fs.writeFileSync("Q:/User_Data/Desktop/TestQA/qtest-runner/_zephyr_analysis/zephyr_cycles.html", cycles, "utf-8");
  console.log("Cycles saved, length:", cycles.length);
}
