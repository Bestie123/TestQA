Index: qtest-runner/docs/.vitepress/.temp/plugin-vue_export-helper.1tPrXgE0.js
===================================================================
const _export_sfc = (sfc, props) => {
  const target = sfc.__vccOpts || sfc;
  for (const [key, val] of props) {
    target[key] = val;
  }
  return target;
};
export {
  _export_sfc as _
};
