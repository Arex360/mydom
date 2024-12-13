const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {Storage} = require('@apillon/sdk');

// Initialize Apillon with your API key
const storage = new Storage({
    key: '79b1d094-43bb-4714-bc36-be4f9d7d7da8',
    secret: 'd6oCZDY1zd!k'
});
const bucket = storage.bucket('a5ddaf16-2e9b-4c36-99f2-bfc8834c5cd4');
let project_files = {};
let resource_data = {};

// Function to calculate MD5 hash of a file
function calculateMD5(filePath) {
  const hash = crypto.createHash('md5');
  const data = fs.readFileSync(filePath);
  hash.update(data);
  return hash.digest('hex');
}

// Function to upload a file to Apillon
async function uploadToApillon(filePath, filename) {
    let actualPath = filePath;
    //filePath = filePath.replace('/', /\\/g);  // Replace backslashes with forward slashes
    dirs = filePath.split('/');
    // Remove last dir
    dirs.pop();
    // Join them back
    filePath = dirs.join('/') + '/';
    console.log(filePath);
    
    try {
        const fileExists = fs.existsSync(actualPath);  // Check if file exists

        if (!fileExists) {
            throw new Error(`File not found at path: ${actualPath}`);
        }
        console.log(filePath)
        const fileBuffer = fs.readFileSync(actualPath);  // Read the file into buffer
        const data = await bucket.uploadFiles([{
            fileName: filename,
            path: filePath, // Ensure this is an absolute path
            content: fileBuffer
        }]);
        console.log(`File uploaded to Apillon: ${filename}`);
        console.log(data[0].url);
        return data[0].url;  // Assuming the response contains the URL for the file
    } catch (error) {
        console.error(`Error uploading ${filename} to Apillon: ${error.message}`);
        return null;
    }
}

// Recursive function to traverse directories, compute file hashes, and upload to Apillon
async function traverseDirectory(dirPath, fileHashData, resourceData) {
  const files = fs.readdirSync(dirPath);

  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      // Skip node_modules and .git directories
      if (file === 'node_modules' || file === '.git') {
        continue;
      }
      await traverseDirectory(fullPath, fileHashData, resourceData);
    } else {
      // Skip specific files
      const localPath = path.relative(process.cwd(), fullPath);
      if (localPath.includes('dominance.zip') || localPath.includes('.gitignore') || localPath.includes('resource.json') || localPath.includes('package-lock.json') || localPath.includes('file_hash.json') || localPath.includes('upload.js') || localPath.includes('index.js') || localPath.includes('node_modules') || localPath.includes('package.json') || localPath.includes('package-lock.json') || localPath.includes('file_hash.json') || localPath.includes('resource.json') || localPath.includes('upload.js') || localPath.includes('index.js') || localPath.includes('node_modules') || localPath.includes('package.json') || localPath.includes('package.json')) {
        continue;
      }

      // Calculate the hash
      const hash = calculateMD5(fullPath);

      fileHashData[file] = {
        path: localPath,
        md5: hash,
      };

      // Upload to Apillon and store the URL
      const fileUrl = await uploadToApillon(fullPath, file);
      if (fileUrl) {
        resourceData[file] = fileUrl;
      }
    }
  }
  project_files = fileHashData;
}

// Main function to generate file hash JSON and resource JSON
async function Filehash() {
  const currentDir = __dirname;
  const fileHashData = {};
  const resourceData = {};

  await traverseDirectory(currentDir, fileHashData, resourceData);

  // Save file hashes to file_hash.json
  const hashOutputPath = path.join(currentDir, 'file_hash.json');
  fs.writeFileSync(hashOutputPath, JSON.stringify(fileHashData, null, 2));
  console.log(`File hash data saved to ${hashOutputPath}`);

  // Save resource URLs to resource.json
  const resourceOutputPath = path.join(currentDir, 'resource.json');
  fs.writeFileSync(resourceOutputPath, JSON.stringify(resourceData, null, 2));
  console.log(`Resource data saved to ${resourceOutputPath}`);
}

// Call the function to generate file hash data at server startup
Filehash().then(() => {
  console.log('Filehash processing completed');
});
