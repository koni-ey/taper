import { serve } from "bun";
import { join } from "node:path";

const port = 3000;

console.log(`Listening on http://127.0.0.1:${port} ...`);

serve({
    port,
    hostname: "127.0.0.1",
    fetch(req) {
        const url = new URL(req.url);
        let path = url.pathname;

        if (path === "/") path = "/index.html";

        const publicDir = join(import.meta.dir, "public");
        const filePath = join(publicDir, path);

        const file = Bun.file(filePath);

        return file.exists().then(exists => {
            if (exists) return new Response(file);
            return new Response("Not found", { status: 404 });
        });
    },
});
