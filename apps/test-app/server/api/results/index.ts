

import { neon } from '@neondatabase/serverless';
import { defineEventHandler } from "h3";

export default defineEventHandler(async (event) => {
  const { neonUrl } = useRuntimeConfig(event);

  const sql = neon(neonUrl);

  const results = await sql`SELECT * FROM results`;

  return results;
});
