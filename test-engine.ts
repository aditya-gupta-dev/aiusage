import { report } from "./server/engine";
report("daily").then(res => console.log(JSON.stringify(res.slice(-5), null, 2))).catch(console.error);
