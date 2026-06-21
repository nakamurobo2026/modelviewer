# Viral OS MVP TODO

No implementation TODO items remain for the MVP scope defined in `/spec`.

Deployment blockers that require external platform configuration:
- Configure Cloudflare Pages with the `viral-os` project and the environment variables listed in `.env.example`.
- Configure Cloudflare Worker secrets listed in `cloudflare/workers/viral-os/.env.example`.
- Complete Threads API app review and provide a valid single-account `THREADS_ACCESS_TOKEN` before live publishing.
