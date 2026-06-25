Index: qtest-runner/_analyze_settings2.js
===================================================================
const fs = require("fs");

function extractContent(html, startMarker, endTagName) {
  const idx = html.indexOf(startMarker);
  if (idx === -1) return null;
  let d = 0;
  let e = -1;
  for (let i = idx; i < html.length; i++) {
    if (html[i] === "<") {
      if (html.startsWith("<" + endTagName + " ", i) || html.startsWith("<" + endTagName + ">", i)) d++;
      else if (html.startsWith("</" + endTagName + ">", i)) {
        if (d === 0) { e = i + endTagName.length + 3; break; }
        d--;
      }
    }
  }
  if (e === -1) return null;
  return html.substring(idx, e);
}

const html = fs.readFileSync("Q:/User_Data/Desktop/TestQA/qtest-runner/_zephyr_analysis/zephyr_settings.html", "utf-8");

// Extract the configuration section
// Find the main navigation content area after the tabs
const configIdx = html.indexOf("GENERAL");
if (configIdx >= 0) {
  // Find the containing div/ul
  let start = html.lastIndexOf("<div", configIdx);
  if (start === -1) start = configIdx - 100;
  let end = html.indexOf("</div>", configIdx);
  if (end === -1) end = configIdx + 2000;
  
  const configSection = html.substring(Math.max(0, start), Math.min(html.length, end + 2000));
  console.log("=== Configuration Section ===");
  
  // Pretty-print the configuration content
  let depth = 0;
  let out = "";
  for (let i = 0; i < configSection.length; i++) {
    if (configSection[i] === "<") {
      const tagEnd = configSection.indexOf(">", i);
      if (tagEnd === -1) break;
      const tag = configSection.substring(i, tagEnd + 1);
      
      if (tag.startsWith("</")) {
        depth = Math.max(0, depth - 1);
        const tagName = tag.match(/<\/(\w+)/)?.[1];
        out += "  ".repeat(depth) + "</" + tagName + ">\n";
      } else {
        const tagName = tag.match(/<(\w+)/)?.[1];
        const testId = tag.match(/data-testid="([^"]*)"/)?.[1] || "";
        const cls = tag.match(/class="([^"]*)"/)?.[1] || "";
        let info = "<" + tagName;
        if (testId) info += " testid=" + testId;
        if (cls) info += " cls=" + cls;
        out += "  ".repeat(depth) + info + ">\n";
        
        const isSelfClosing = tag.endsWith("/>") || ["img","br","hr","input","meta","link"].includes(tagName);
        if (!isSelfClosing) depth++;
        
        if (depth > 15) break;
      }
      i = tagEnd;
    } else {
      const nextTag = configSection.indexOf("<", i);
      const text = configSection.substring(i, nextTag === -1 ? configSection.length : nextTag).trim();
      if (text && text.length > 0 && text.length < 200) {
        out += "  ".repeat(depth) + text + "\n";
      }
      if (nextTag === -1) break;
      i = nextTag - 1;
    }
  }
  console.log(out);
}

// Also find all data-testid attributes
const testIds = html.match(/data-testid="([^"]*)"/g);
if (testIds) {
  const unique = [...new Set(testIds)];
  console.log("\n=== All data-testid values ===");
  unique.forEach(id => console.log("  " + id));
}
