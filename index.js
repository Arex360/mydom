const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const app = express();
const {exec} = require('child_process');

let project_files = {};

// Function to calculate MD5 hash of a file
function calculateMD5(filePath) {
  const hash = crypto.createHash('md5');
  const data = fs.readFileSync(filePath);
  hash.update(data);
  return hash.digest('hex');
}

// Recursive function to traverse directories and compute file hashes
function traverseDirectory(dirPath, fileHashData) {
  const files = fs.readdirSync(dirPath);

  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      // Skip the node_modules folder
      if (file === 'node_modules' || file == ".git") {
        continue;
      }
      // Recurse into other directories
      traverseDirectory(fullPath, fileHashData);
    } else {
      // If it's a file, calculate hash and save data
      const hash = calculateMD5(fullPath);
      const localPath = path.relative(process.cwd(), fullPath);
      let a = ""
      if(localPath.includes("dominance.zip") || localPath.includes(".gitignore")){
        continue;
    }
      fileHashData[file] = {
        path: localPath,
        md5: hash,
      };
    }
  }
  project_files = fileHashData;
}

// Main function to generate the file hash JSON
function Filehash() {
  const currentDir = __dirname;
  const fileHashData = {};

  traverseDirectory(currentDir, fileHashData);

  // Save the data to file_hash.json
  const outputPath = path.join(currentDir, 'file_hash.json');
  fs.writeFileSync(outputPath, JSON.stringify(fileHashData, null, 2));
  console.log(`File hash data saved to ${outputPath}`);
}

app.get('/', (req, res) => {
  res.send("done");
});

// Endpoint to download the file
app.get('/download', (req, res) => {
  let { filename } = req.query;

  if (!filename) {
    return res.status(400).send('Filename query parameter is required');
  }

  // Refresh file hashes on each download request

  //traverseDirectory(__dirname, fileHashData);
  let fileHashData = JSON.parse(fs.readFileSync('resource.json', 'utf8'))
  // Check if the file exists in the updated file_hash data
  let fileData = fileHashData[filename];

  if (!fileData) {
    return res.status(404).send('File not found');
  }
  res.send(fileData)

  // Send the file for download
  /*res.download(filePath, filename, (err) => {
    if (err) {
      console.error(err);
      res.status(500).send('Error downloading the file');
    }
  });*/
});

// Endpoint to verify file MD5 hash
app.get('/verify', (req, res) => {
  let { filename, md5 } = req.query;

  if (!filename || !md5) {
    return res.status(400).send('Filename and md5 query parameters are required');
  }

  // Refresh file hashes on each verify request
  const fileHashData = JSON.parse(fs.readFileSync('file_hash.json', 'utf8'))
  //traverseDirectory(__dirname, fileHashData);

  // Check if the file exists in the updated file_hash data
  let fileData = fileHashData[filename];

  if (!fileData) {
    return res.status(404).send('File not found');
  }

  // Compare the provided MD5 hash with the actual file's MD5 hash
  const fileMD5 = fileData.md5;

  if (fileMD5 === md5) {
    return res.status(200).send('MD5 hash matches');
  } else {
    return res.status(400).send('MD5 hash does not match');
  }
});
app.get('/hash',(req,res)=>{
  res.sendFile(__dirname+"/file_hash.json")
})
// Call the function to generate file hash data at server startup
app.listen(3003, () => {
    
  
  console.log('Server started on port 3003');
});
