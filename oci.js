const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cliProgress = require('cli-progress');
const common = require('oci-common');
const objectStorage = require('oci-objectstorage');

// Load the OCI config from ~/.oci/config
const provider = new common.ConfigFileAuthenticationDetailsProvider();

// Initialize OCI Object Storage client
const client = new objectStorage.ObjectStorageClient({
  authenticationDetailsProvider: provider,
});

// Replace with your bucket details
const namespaceName = 'lr23jyytzijx'; // Replace with your namespace
const bucketName = 'bucket-20241214-1415';       // Replace with your bucket name
const ignoreList = fs.readFileSync(path.join(__dirname, 'ignore.txt'), 'utf-8')
  .split('\n')
  .map(item => item.trim())
  .filter(item => item !== '');

function shouldIgnore(localPath) {
  const fileName = path.basename(localPath);
  return ignoreList.some(ignorePattern => fileName === ignorePattern);
}

// Function to calculate MD5 hash of a file
function calculateMD5(filePath) {
  const hash = crypto.createHash('md5');
  const data = fs.readFileSync(filePath);
  hash.update(data);
  return hash.digest('hex');
}

// Function to upload a file to OCI Object Storage
async function uploadToOCI(filePath, filename) {
  try {
    const fileBuffer = fs.readFileSync(filePath);

    const putObjectDetails = {
      namespaceName,
      bucketName,
      objectName: filename,
      putObjectBody: fileBuffer,
    };

    const response = await client.putObject(putObjectDetails);
    const fileUrl = `https://objectstorage.uk-london-1.oraclecloud.com/n/${namespaceName}/b/${bucketName}/o/${encodeURIComponent(filename)}`;
    //console.log(provider.getRegion()['_regionId:'])
    //console.log(`Uploaded ${filename} to OCI: ${fileUrl}`);
    return fileUrl;
  } catch (error) {
    console.error(`Error uploading ${filename} to OCI: ${error.message}`);
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

    const fileUrl = await uploadToOCI(fullPath, filename);
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
