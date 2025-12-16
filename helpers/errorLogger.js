import fs from "fs";

const ERROR_FILE = "outputs/failed_products.json";

export function logFailedProduct(url, error) {
  let data = [];

  if (fs.existsSync(ERROR_FILE)) {
    data = JSON.parse(fs.readFileSync(ERROR_FILE, "utf-8"));
  }

  data.push({
    url,
    error: error.message || String(error),
    time: new Date().toISOString()
  });

  fs.mkdirSync("outputs", { recursive: true });
  fs.writeFileSync(ERROR_FILE, JSON.stringify(data, null, 2));
}
