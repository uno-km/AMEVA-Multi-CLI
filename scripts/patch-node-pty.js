const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, '..', 'node_modules', 'node-pty', 'lib', 'windowsConoutConnection.js');

if (fs.existsSync(targetFile)) {
  let content = fs.readFileSync(targetFile, 'utf8');
  
  // node-pty on Windows only replaces node_modules.asar, but electron-builder uses app.asar.
  // We need to add a replacement for app.asar as well.
  if (!content.includes("'app.asar', 'app.asar.unpacked'")) {
    content = content.replace(
      "__dirname.replace('node_modules.asar', 'node_modules.asar.unpacked');",
      "__dirname.replace('app.asar', 'app.asar.unpacked').replace('node_modules.asar', 'node_modules.asar.unpacked');"
    );
    fs.writeFileSync(targetFile, content, 'utf8');
    console.log('Successfully patched node-pty windowsConoutConnection.js for app.asar');
  } else {
    console.log('node-pty windowsConoutConnection.js is already patched');
  }
} else {
  console.log('node-pty windowsConoutConnection.js not found, skipping patch.');
}
