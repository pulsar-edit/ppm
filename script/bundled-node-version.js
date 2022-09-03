const child_process = require('child_process')

module.exports = function(filename, callback) {
  if (process.platform === 'win32') {
    // Due to windows shell handling using spawn here will allow better compatibility
      callback(error);	    // for example if a user has a space in the path name, this causes every aspect of the build process to crash
      return;	
    }	

    let version = null;	    let version = null;
    if (stdout != null) {	    let arch = null;
      version = stdout.toString().trim();	
    }	    const node_shell = child_process.spawn(`"${filename}"`, ['-v'], { shell: true });

    node_shell.stderr.on('data', (error) => {
      callback(error.toString());
    });

    node_shell.stdout.on('data', (data) => {
      if (data != null) {
        version = data.toString().trim();
      }
    });

    node_shell.on('close', (code) => {
      if (code !== 0) {
        callback(`${filename} -v' Exited with: ${code}`);
      }
    });

    const arch_shell = child_process.spawn(`"${filename}"`, ['-p', 'process.arch'], { shell: true });

    arch_shell.stderr.on('data', (error) => {
      callback(error.toString());
    });

    arch_shell.stdout.on('data', (data) => {
      if (data != null) {
        arch = data.toString().trim();
      }

      console.log(`Version: ${version}`);
      console.log(`Arch: ${arch}`);
      callback(null, version, arch);
    });

    arch_shell.on('close', (code) => {
      if (code !== 0) {
        callback(`'${filename} -p process.arch' Exited with: ${code}`);
      }
    });
  } else {
    child_process.exec(filename + ' -v', function(error, stdout) {
      if (error != null) {
        callback(error);
        return;
      }
  
      let version = null;
      if (stdout != null) {
        version = stdout.toString().trim();
      }
  
      child_process.exec(filename + " -p 'process.arch'", function(error, stdout) {
        let arch = null;
        if (stdout != null) {
          arch = stdout.toString().trim();
        }
        callback(error, version, arch);
      })
    });
  }
}
