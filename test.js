import {create} from 'ipfs-http-client'
//upload file_hash.json
import fs from 'fs'
const ipfs = create('http://vpn2.itsarex.com:5002')
const file = fs.readFileSync('file_hash.json')
const fileHash = JSON.parse(file)
const fileHashData = JSON.stringify(fileHash)
const fileHashCid = await ipfs.add(fileHashData)
console.log(`file_hash.json uploaded to IPFS: ${fileHashCid.path}`)
