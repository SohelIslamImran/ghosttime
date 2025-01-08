const { exec } = require('child_process');

// Replace './path-to-your-executable' with the path to your executable file
exec('./ghostty_animation', (error, stdout, stderr) => {
  if (error) {
    console.error(`Error executing file: ${error.message}`);
    return;
  }

  if (stderr) {
    console.error(`Standard error: ${stderr}`);
    return;
  }

  console.log(`Output:\n${stdout}`);
});
