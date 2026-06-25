Index: qtest-runner/_analyze_structure2.js
===================================================================
const fs = require("fs");

function analyzeStructure(html) {
  const lines = [];
  let depth = 0;
  let i = 0;
  const maxDepth = 25;
  
  while (i < html.length && depth <= maxDepth) {
    const tagStart = html.indexOf("<", i);
    if (tagStart === -1) break;
    
    // Text before tag
    if (tagStart > i) {
      const text = html.substring(i, tagStart).trim();
      if (text && text.length > 0 && text.length < 300 && depth <= maxDepth) {
        lines.push({d: depth, t: "text", v: text.slice(0, 150)});
      }
    }
    
    // Parse tag
    const tagEnd = html.indexOf(">", tagStart);
    if (tagEnd === -1) break;
    const tag = html.substring(tagStart, tagEnd + 1);
    
    if (tag.startsWith("</")) {
      depth--;
    } else {
      const tagName = tag.match(/<(\w+)/)?.[1];
      const dataTestId = tag.match(/data-testid="([^"]*)"/)?.[1] || "";
      const cls = tag.match(/class="([^"]*)"/)?.[1] || "";
      const role = tag.match(/role="([^"]*)"/)?.[1] || "";
      const ariaSelected = tag.match(/aria-selected="([^"]*)"/)?.[1] || "";
      
      if (depth <= maxDepth) {
        let info = "<" + tagName;
        if (cls) info += " cls=" + cls;
        if (dataTestId) info += " testid=" + dataTestId;
        if (role) info += " role=" + role;
        if (ariaSelected) info += " selected=" + ariaSelected;
        lines.push({d: depth, t: "tag", v: info});
      }
      
      const isSelfClosing = tag.endsWith("/>") || ["img","br","hr","input","meta","link"].includes(tagName);
      if (!isSelfClosing) depth++;
    }
    
    i = tagEnd + 1;
  }
  
  // Output as structured text
  let result = "";
  for (const line of lines) {
    result += "  ".repeat(line.d) + line.v + "\n";
  }
  return result;
}

// Process test cases page
const html = fs.readFileSync("Q:/User_Data/Desktop/TestQA/qtest-runner/_zephyr_analysis/zephyr_app.html", "utf-8");
const structure = analyzeStructure(html);
const outPath = "Q:/User_Data/Desktop/TestQA/qtest-runner/_zephyr_analysis/zephyr_structure.txt";
fs.writeFileSync(outPath, structure, "utf-8");
console.log("Written " + outPath + " (" + structure.split("\n").length + " lines)");

// Print key sections
const lines = structure.split("\n");
// Find lines related to filter, sidebar, and testid elements
const keywords = ["filter", "Filter", "sidebar", "folder", "testid", "Фильтр", "критерий", "Конфиг", "tree"];
const matched = [];
for (const line of lines) {
  for (const kw of keywords) {
    if (line.includes(kw)) {
      matched.push(line);
      break;
    }
  }
}
console.log("\n=== Key elements ===");
console.log(matched.join("\n"));
