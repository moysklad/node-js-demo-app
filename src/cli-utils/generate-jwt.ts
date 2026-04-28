import { cfg } from "../lib/config/config";
import { buildVendorApiJwt } from "../lib/integrations/vendor-api";

if (!cfg().secretKey) {
  process.stderr.write("APP_SECRET_KEY is required to generate JWT\n");
  process.exit(1);
}

if (!cfg().appUid) {
  process.stderr.write("APP_UID is required to generate JWT\n");
  process.exit(1);
}

process.stdout.write(`${buildVendorApiJwt()}\n`);
