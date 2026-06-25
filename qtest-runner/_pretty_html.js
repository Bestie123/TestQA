Index: qtest-runner/_pretty_html.js
===================================================================
const fs = require("fs");

function getAttrs(tag) {
  const match = tag.match(/(?:data-testid|class|role|aria-selected|tabindex|width|height|aria-disabled|title)="[^"]*"/g);
  return match ? match.join(" ") : "";
}

function prettyPrint(html, maxDepth) {
  let result = "";
  let depth = 0;
  let i = 0;
  
  while (i < html.length && depth <= maxDepth) {
    if (html[i] === "<") {
      let tagEnd = html.indexOf(">", i);
      if (tagEnd === -1) break;
      let tag = html.substring(i, tagEnd + 1);
      
      if (tag.startsWith("</")) {
        depth--;
        if (depth >= 0) {
          let tagName = tag.match(/<\/(\w+)/)?.[1];
          result += "  ".repeat(Math.max(0, depth)) + "</" + tagName + ">\n";
        }
      } else {
        let tagName = tag.match(/<(\w+)/)?.[1];
        let attrStr = getAttrs(tag);
        let shortened = tag.length > 150 ? " ...>" : ">";
        
        result += "  ".repeat(depth) + "<" + tagName + (attrStr ? " " + attrStr : "") + shortened + "\n";
        
        let isSelfClosing = tag.endsWith("/>");
        if (!isSelfClosing) depth++;
      }
      i = tagEnd + 1;
    } else {
      let textEnd = html.indexOf("<", i);
      if (textEnd === -1) textEnd = html.length;
      let text = html.substring(i, textEnd).trim();
      if (text && text.length > 0) {
        result += "  ".repeat(depth) + text.slice(0, 120) + "\n";
      }
      i = textEnd;
    }
  }
  return result;
}

const files = [
  "zephyr_app.html",
  "zephyr_config.html", 
  "zephyr_cycles.html",
  "zephyr_settings.html"
];

for (const f of files) {
  const path = "Q:/User_Data/Desktop/TestQA/qtest-runner/_zephyr_analysis/" + f;
  if (!fs.existsSync(path)) { console.log("Skipping " + f); continue; }
  const html = fs.readFileSync(path, "utf-8");
  const out = prettyPrint(html, 8);
  const outPath = path.replace(".html", "_pretty.txt");
  fs.writeFileSync(outPath, out, "utf-8");
  console.log("Written " + outPath + " (" + out.length + " chars, " + out.split("\n").length + " lines)");
}
