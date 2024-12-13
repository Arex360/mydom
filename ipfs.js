import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { create } from 'ipfs-http-client';
import { fileURLToPath } from 'url';
import cliProgress from 'cli-progress'; // Import the progress bar library

// Initialize IPFS client with your custom API address
const ipfs = create({ url: 'http://vpn2.itsarex.com:5002/' });

let project_files = {};
let resource_data = {};

// Function to calculate MD5 hash of a file
function calculateMD5(filePath) {
  const hash = crypto.createHash('md5');
  const data = fs.readFileSync(filePath);
  hash.update(data);
  return hash.digest('hex');
}

// Function to upload a file to IPFS using the custom node
async function uploadToIPFS(filePath, filename) {
  try {
    const fileExists = fs.existsSync(filePath); // Check if file exists

    if (!fileExists) {
      throw new Error(`File not found at path: ${filePath}`);
    }

    // Read the file into buffer
    const fileBuffer = fs.readFileSync(filePath);

    // Upload to IPFS via your custom IPFS node
    const cid = await ipfs.add({
      path: filename,
      content: fileBuffer,
    });
    let ipfsPath = cid.cid.toString();
    const ipfsUrl = `http://vpn2.itsarex.com:8082/ipfs/${ipfsPath}`;
    return ipfsUrl; // Return the IPFS URL
  } catch (error) {
    console.error(`Error uploading ${filename} to IPFS: ${error.message}`);
    return null;
  }
}

// Recursive function to collect file paths
function collectFiles(dirPath, fileList = []) {
  const files = fs.readdirSync(dirPath);

  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      // Skip node_modules and .git directories
      if (file === 'node_modules' || file === '.git') {
        continue;
      }
      collectFiles(fullPath, fileList);
    } else {
      // Skip specific files
      const localPath = path.relative(process.cwd(), fullPath);
      if (
        localPath.includes('dominance.zip') ||
        localPath.includes('.gitignore') ||
        localPath.includes('resource.json') ||
        localPath.includes('package-lock.json') ||
        localPath.includes('file_hash.json') ||
        localPath.includes('upload.js') ||
        localPath.includes('.js') ||
        localPath.includes('node_modules') ||
        localPath.includes('package.json')
      ) {
        continue;
      }
      fileList.push(fullPath);
    }
  }
  return fileList;
}

// Main function to generate file hash JSON and resource JSON with a progress bar
async function Filehash() {
  // Correct way to get the current directory in ES modules
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const fileHashData = {};
  const resourceData = {};

  // Collect all files to process
  const files = collectFiles(currentDir);

  // Initialize the progress bar
  const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
  progressBar.start(files.length, 0);

  for (let i = 0; i < files.length; i++) {
    const fullPath = files[i];
    const filename = path.basename(fullPath);
    const localPath = path.relative(process.cwd(), fullPath);

    // Calculate the hash
    const hash = calculateMD5(fullPath);
    fileHashData[filename] = {
      path: localPath,
      md5: hash,
    };

    // Upload to IPFS and store the URL
    const fileUrl = await uploadToIPFS(fullPath, filename);
    if (fileUrl) {
      resourceData[filename] = fileUrl;
    }

    // Update the progress bar
    progressBar.update(i + 1);
  }

  // Stop the progress bar
  progressBar.stop();

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
