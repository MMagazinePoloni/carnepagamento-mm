const ts = require("typescript");
const fs = require("fs");

const content = fs.readFileSync("./src/lib/obfuscate.ts", "utf8");
const result = ts.transpile(content);
eval(result);

console.log("encode(485):", encodeClientId(485));
console.log("encode('485'):", encodeClientId("485"));
console.log("decode('2db29c1'):", decodeClientId("2db29c1"));
console.log("decode('485'):", decodeClientId("485"));
