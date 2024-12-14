const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { fileURLToPath } = require('url');
const cliProgress = require('cli-progress');
const AWS = require('aws-sdk');

// Configure the S3 client for Storj
const s3 = new AWS.S3({
  endpoint: 'https://gateway.storjshare.io', // Replace with your specific Storj endpoint
  accessKeyId: 'jwhq5tw6usk2zl7tn4whjjrztnpq',         // Replace with your access key
  secretAccessKey: 'j2fynonpfqskmvo5zpdq7rs7ugsuaffe3ph7knaa6ue7vhkqoadne', // Replace with your secret key
  s3ForcePathStyle: true,                    // Required for Storj compatibility
  signatureVersion: 'v4',
});
const ignoreList = fs.readFileSync(path.join(__dirname, 'ignore.txt'), 'utf-8')
  .split('\n')
  .map(item => item.trim())  // Trim any extra spaces or newlines
  .filter(item => item !== '');  // Remove any empty lines
function shouldIgnore(localPath) {
    const fileName = path.basename(localPath); // Get just the filename
    return ignoreList.some(ignorePattern => fileName === ignorePattern);
}
const BUCKET_NAME = 'owais'; // Replace with your bucket name

// Function to calculate MD5 hash of a file
function calculateMD5(filePath) {
  const hash = crypto.createHash('md5');
  const data = fs.readFileSync(filePath);
  hash.update(data);
  return hash.digest('hex');
}

// Function to upload a file to Storj S3
async function uploadToStorj(filePath, filename) {
  try {
    const fileBuffer = fs.readFileSync(filePath);

    // Upload to Storj S3 bucket
    const params = {
      Bucket: BUCKET_NAME,
      Key: filename,
      Body: fileBuffer,
    };

    const data = await s3.upload(params).promise();
    let myUrl = `https://link.storjshare.io/s/jugoc3efmulq7bm66fryepklbieq/owais/${filename}?download=1`
    return myUrl; // URL to the uploaded file
  } catch (error) {
    console.error(`Error uploading ${filename} to Storj: ${error.message}`);
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
      if (file === 'node_modules' || file === '.git') {
        continue;
      }
      collectFiles(fullPath, fileList);
    } else {
      const localPath = path.relative(process.cwd(), fullPath);
      if (shouldIgnore(localPath)) {
        continue;
      }
      fileList.push(fullPath);
    }
  }
  return fileList;
}

// Main function to generate file hash JSON and resource JSON with a progress bar
async function Filehash() {
  const currentDir =__dirname;
  const fileHashData = {};
  const resourceData = {};

  const files = collectFiles(currentDir);

  const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
  progressBar.start(files.length, 0);

  for (let i = 0; i < files.length; i++) {
    const fullPath = files[i];
    const filename = path.basename(fullPath);
    const localPath = path.relative(process.cwd(), fullPath);

    const hash = calculateMD5(fullPath);
    fileHashData[filename] = {
      path: localPath,
      md5: hash,
    };

    const fileUrl = await uploadToStorj(fullPath, filename);
    if (fileUrl) {
        
      resourceData[filename] = fileUrl;
    }

    progressBar.update(i + 1);
  }

  progressBar.stop();

  const hashOutputPath = path.join(currentDir, 'file_hash.json');
  fs.writeFileSync(hashOutputPath, JSON.stringify(fileHashData, null, 2));
  console.log(`File hash data saved to ${hashOutputPath}`);
  console.log("updating filehash")
  const resourceOutputPath = path.join(currentDir, 'resource.json');
  fs.writeFileSync(resourceOutputPath, JSON.stringify(resourceData, null, 2));
  console.log(`Resource data saved to ${resourceOutputPath}`);
}

// Run the script
Filehash().then(() => {
  console.log('Filehash processing completed');
});
