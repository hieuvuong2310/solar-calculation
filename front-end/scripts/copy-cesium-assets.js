const fs = require("fs");
const path = require("path");

const sourceDir = path.join(__dirname, "../node_modules/cesium/Build/Cesium");
const targetDir = path.join(__dirname, "../public/cesium");

// Directories to copy
const dirsToCopy = ["Workers", "ThirdParty", "Assets", "Widgets"];

function copyDir(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Check if source exists
if (!fs.existsSync(sourceDir)) {
  console.warn(`Warning: Cesium source directory not found at ${sourceDir}`);
  console.warn("Skipping Cesium assets copy. Run npm install first.");
  process.exit(0);
}

// Create target directory
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

// Copy each directory
console.log("Copying Cesium assets to public/cesium...");
dirsToCopy.forEach((dir) => {
  const src = path.join(sourceDir, dir);
  const dest = path.join(targetDir, dir);

  if (fs.existsSync(src)) {
    console.log(`  Copying ${dir}...`);
    copyDir(src, dest);
  } else {
    console.warn(`  Warning: ${dir} not found in Cesium build directory`);
  }
});

console.log("Cesium assets copied successfully!");
