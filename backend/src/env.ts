import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Use the same root .env regardless of which workspace starts the backend.
dotenv.config({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });
