Index: qtest-runner/_analyze_settings.js
===================================================================
const fs = require("fs");

function extractApp(html) {
  const startMarker = "<span data-testid=\"zephyr-scale-v2\"";
  const idx = html.indexOf(startMarker);
  if (idx === -1) return null;
  let d = 0;
  let e = -1;
  for (let i = idx; i < html.length; i++) {
    if (html[i] === "<") {
      if (html.startsWith("<span ", i)) d++;
      else if (html.startsWith("</span>", i)) {
        d--;
        if (d === 0) { e = i + 7; break; }
      }
    }
  }
  if (e === -1) return null;
  return html.substring(idx, e);
}

// Settings page
const settingsHtml = fs.readFileSync("Q:/User_Data/Desktop/TestQA/qtest-runner/_zephyr_analysis/04_settings.html", "utf-8");
const settingsApp = extractApp(settingsHtml);
if (settingsApp) {
  fs.writeFileSync("Q:/User_Data/Desktop/TestQA/qtest-runner/_zephyr_analysis/zephyr_settings.html", settingsApp, "utf-8");
  console.log("Settings app saved, length: " + settingsApp.length);
  console.log("First 2000 chars:");
  console.log(settingsApp.slice(0, 2000));
  
  // Search for key content
  const keywords = ["Back to", "API", "token", "Token", "настройк", "Настройк", "Configuration", "configuration"];
  for (const kw of keywords) {
    const pos = settingsApp.indexOf(kw);
    if (pos >= 0) {
      const ctx = settingsApp.substring(Math.max(0, pos - 100), pos + 200);
      console.log("\nFound '" + kw + "' at " + pos + ":");
      console.log(ctx);
    }
  }
} else {
  console.log("Settings app not found");
}
