#!/usr/bin/env node

import("../dist/cli/index.js").catch((err) => {
  if (err.code === "ERR_MODULE_NOT_FOUND") {
    console.error(
      "PUIUX Pilot is not built yet. Run: npm run build\n" +
        "Or use: npx puiux-pilot"
    );
    process.exit(1);
  }
  throw err;
});
