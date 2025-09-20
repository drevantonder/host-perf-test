import { neon } from '@neondatabase/serverless';
import { h, renderSSR } from "nano-jsx";
import { defineEventHandler } from "h3";

export default defineEventHandler(async (event) => {
  const { neonUrl } = useRuntimeConfig(event);

  const sql = neon(neonUrl);

  const posts = await sql`SELECT * FROM posts`;

  const html = renderSSR(() => (
    <div>
      <h1>Neon DB</h1>
      <p>Posts ({posts.length})</p>
      {posts.length === 0 ? (
        <p>No posts found.</p>
      ) : (
        <table border="1" cellPadding="6" cellSpacing="0">
          <thead>
            <tr>
              {Object.keys(posts[0] as any).map((key) => (
                <th>{String(key)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {posts.map((row: any) => (
              <tr>
                {Object.keys(posts[0] as any).map((key) => (
                  <td>{String(row[key])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  ));

  return html;
});
