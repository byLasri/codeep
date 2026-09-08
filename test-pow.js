const crypto = require('crypto');

// From the HAR file
const challenge = "2d9dae31a881e9a51df1921f8bd43154bdc0d0bb2bc63be973d5327dd1566318";
const salt = "fef1ebf52856856ac4a7";
const difficulty = 144000;
const knownAnswer = 56428;

// Calculate target
const two256 = BigInt(2) ** BigInt(256);
const target = two256 / BigInt(difficulty);

console.log("Target:", target.toString());
console.log("Verifying known answer:", knownAnswer);

// Verify the known answer
const data = `${challenge}${salt}${knownAnswer}`;
const hashBuffer = crypto.createHash('sha256').update(data).digest();
const hashArray = Array.from(new Uint8Array(hashBuffer));
const hashBigInt = BigInt('0x' + hashArray.map(b => b.toString(16).padStart(2, '0')).join(''));

console.log("Hash for nonce 56428:", hashBigInt.toString());
console.log("Hash < Target?", hashBigInt < target);

// Try our computed answer from earlier (168331)
const testData = `${challenge}${salt}168331`;
const testHashBuffer = crypto.createHash('sha256').update(testData).digest();
const testHashArray = Array.from(new Uint8Array(testHashBuffer));
const testHashBigInt = BigInt('0x' + testHashArray.map(b => b.toString(16).padStart(2, '0')).join(''));

console.log("\nHash for nonce 168331:", testHashBigInt.toString());
console.log("Hash < Target?", testHashBigInt < target);
