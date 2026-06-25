Index: qtest-runner/_analyze_cycles.js
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
      else if (html.startsWith("</span>", i)) { d--; if (d === 0) { e = i + 7; break; } }
    }
  }
  if (e === -1) return null;
  return html.substring(idx, e);
}

const html = fs.readFileSync("Q:/User_Data/Desktop/TestQA/qtest-runner/_zephyr_analysis/02_test_cycles.html", "utf-8");
const app = extractApp(html);
if (app) {
  fs.writeFileSync("Q:/User_Data/Desktop/TestQA/qtest-runner/_zephyr_analysis/zephyr_cycles_full.html", app, "utf-8");
  
  // Find filter-related content
  const filters = app.match(/[Фф]ильтр[ыа]|[Дд]обавить критерий|expand-filters|isFiltering|css-dg3gvv/g);
  console.log("Filter-related matches:", JSON.stringify(filters));
  
  // Find the class that indicates filtering state
  const dg3gvv = app.match(/css-dg3gvv/g);
  console.log("css-dg3gvv count:", dg3gvv ? dg3gvv.length : 0);
  
  // Find isFiltering
  const isFilter = app.match(/isFiltering/g);
  console.log("isFiltering count:", isFilter ? isFilter.length : 0);
  
  // Find data-testid values
  const testIds = app.match(/data-testid="[^"]*"/g);
  if (testIds) {
    const unique = [...new Set(testIds)];
    console.log("\n=== Cycles page data-testid values ===");
    unique.forEach(id => console.log("  " + id));
  }
} else {
  console.log("Cycles app not found");
}
