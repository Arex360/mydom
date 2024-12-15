const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { fileURLToPath } = require('url');
const cliProgress = require('cli-progress');
const AWS = require('aws-sdk');

// Configure the R2 client for Cloudflare
const s3 = new AWS.S3({
  endpoint: 'https://86169eb179c7276af217867c3bffc9d2.r2.cloudflarestorage.com', // Replace <account_id> with your Cloudflare account ID
  accessKeyId: '4f629e154e286665ee5200b4841fd9d6', // Replace with your R2 access key
  secretAccessKey: '26bbaeb5912bd62d2528e7089c9e4f2612238c93562439dd527fa9a1a480710d', // Replace with your R2 secret key
  region: 'auto', // Cloudflare R2 region
  s3ForcePathStyle: true, // Required for Cloudflare R2 compatibility
  ACL: 'public-read',
});

const ignoreList = fs.readFileSync(path.join(__dirname, 'ignore.txt'), 'utf-8')
  .split('\n')
  .map(item => item.trim())  // Trim any extra spaces or newlines
  .filter(item => item !== '');  // Remove any empty lines

function shouldIgnore(localPath) {
    const fileName = path.basename(localPath); // Get just the filename
    return ignoreList.some(ignorePattern => fileName === ignorePattern);
}

const BUCKET_NAME = 'storage'; // Replace with your Cloudflare R2 bucket name

// Function to calculate MD5 hash of a file
function calculateMD5(filePath) {
  const hash = crypto.createHash('md5');
  const data = fs.readFileSync(filePath);
  hash.update(data);
  return hash.digest('hex');
}

// Function to upload a file to Cloudflare R2
async function uploadToR2(filePath, filename) {
  try {
    const fileBuffer = fs.readFileSync(filePath);

    // Upload to Cloudflare R2 bucket
    const params = {
      Bucket: BUCKET_NAME,
      Key: filename,
      Body: fileBuffer,
    };

    const data = await s3.upload(params).promise();
    const fileUrl = `https://r2.itsarex.com/${filename}`; // URL to the uploaded file
    return fileUrl;
  } catch (error) {
    console.error(`Error uploading ${filename} to Cloudflare R2: ${error.message}`);
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
  const currentDir = __dirname;
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

    const fileUrl = await uploadToR2(fullPath, filename);
    if (fileUrl) {
      resourceData[filename] = fileUrl;
    }

    progressBar.update(i + 1);
  }

  progressBar.stop();

  const hashOutputPath = path.join(currentDir, 'file_hash.json');
  fs.writeFileSync(hashOutputPath, JSON.stringify(fileHashData, null, 2));
  console.log(`File hash data saved to ${hashOutputPath}`);

  const resourceOutputPath = path.join(currentDir, 'resource.json');
  fs.writeFileSync(resourceOutputPath, JSON.stringify(resourceData, null, 2));
  console.log(`Resource data saved to ${resourceOutputPath}`);
}

// Run the script
Filehash().then(() => {
  console.log('Filehash processing completed');
});
