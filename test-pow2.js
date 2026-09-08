const crypto = require('crypto');

// From the HAR file - FIRST request
const challenge1 = "2d9dae31a881e9a51df1921f8bd43154bdc0d0bb2bc63be973d5327dd1566318";
const salt1 = "fef1ebf52856856ac4a7";
const difficulty1 = 144000;
const knownAnswer1 = 56428;

// From our live test - SECOND request (different challenge)
const challenge2 = "9a68080c1a2900c5855e2b83ae577485ee4ddb78b7ce84b1766268de92cee373";
const salt2 = "44d021e7ab562eb94d17";
const difficulty2 = 144000;

const two256 = BigInt(2) ** BigInt(256);
const target = two256 / BigInt(difficulty1);

console.log("=== Testing ORIGINAL challenge from HAR ===");
console.log("Challenge:", challenge1);
console.log("Salt:", salt1);

// Brute force to find the real answer for original challenge
let found = false;
for (let nonce = 0; nonce < 200000 && !found; nonce++) {
  const data = `${challenge1}${salt1}${nonce}`;
  const hashBuffer = crypto.createHash('sha256').update(data).digest();
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashBigInt = BigInt('0x' + hashArray.map(b => b.toString(16).padStart(2, '0')).join(''));
  
  if (hashBigInt < target) {
    console.log(`FOUND! Nonce: ${nonce}`);
    console.log("Hash:", hashBigInt.toString());
    console.log("Target:", target.toString());
    console.log("Valid?", hashBigInt < target);
    found = true;
    break;
  }
}

if (!found) {
  console.log("Not found in first 200k nonces");
}
