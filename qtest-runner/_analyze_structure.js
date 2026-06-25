Index: qtest-runner/_analyze_structure.js
===================================================================
const fs = require("fs");

function analyzeStructure(html, maxDepth) {
  const lines = [];
  let depth = 0;
  let i = 0;
  
  while (i < html.length && depth <= maxDepth) {
    // Find next tag
    const tagStart = html.indexOf("<", i);
    if (tagStart === -1) break;
    
    // Text before tag
    if (tagStart > i) {
      const text = html.substring(i, tagStart).trim();
      if (text && text.length > 0 && text.length < 200 && depth <= maxDepth) {
        lines.push("  ".repeat(depth) + "TEXT: " + text.slice(0, 120));
      }
    }
    
    // Parse tag
    const tagEnd = html.indexOf(">", tagStart);
    if (tagEnd === -1) break;
    
    const tag = html.substring(tagStart, tagEnd + 1);
    
    if (tag.startsWith("</")) {
      depth--;
      if (depth >= 0 && depth <= maxDepth) {
        const tagName = tag.match(/<\/(\w+)/)?.[1];
        lines.push("  ".repeat(depth) + "</" + tagName + ">");
      }
    } else {
      const tagName = tag.match(/<(\w+)/)?.[1];
      const dataTestId = tag.match(/data-testid="([^"]*)"/)?.[1] || "";
      const cls = tag.match(/class="([^"]*)"/)?.[1] || "";
      const role = tag.match(/role="([^"]*)"/)?.[1] || "";
      
      let extra = "";
      if (dataTestId) extra += " data-testid=" + dataTestId;
      if (role) extra += " role=" + role;
      
      if (depth <= maxDepth) {
        lines.push("  ".repeat(depth) + "<" + tagName + (cls ? " class=" + cls : "") + extra + ">");
      }
      
      const isSelfClosing = tag.endsWith("/>") || ["img","br","hr","input","meta","link"].includes(tagName);
      if (!isSelfClosing) depth++;
    }
    
    i = tagEnd + 1;
  }
  
  return lines.join("\n");
}

// Process test cases page
const html = fs.readFileSync("Q:/User_Data/Desktop/TestQA/qtest-runner/_zephyr_analysis/zephyr_app.html", "utf-8");
const structure = analyzeStructure(html, 10);
fs.writeFileSync("Q:/User_Data/Desktop/TestQA/qtest-runner/_zephyr_analysis/zephyr_structure.txt", structure, "utf-8");
console.log("Structure lines: " + structure.split("\n").length);
console.log(structure.slice(0, 5000));
