## Test

### Test Rules

- Jangan Full running test
- Jalankan test related only dengan perubahan yang dibuat — prefer per-file test yang menyentuh perubahan (bun test src/<folders>/<modul-name>/_test/<nama-file>.test.ts), kalau perubahan menyebar baru pakai folder (bun test src/modules/<modul-name>/_test)

### Test Structure

describe(<module-name>/<file-name> <integrations,services,or unit test>, () => {
describe('success ', () => { ... })
describe(GET/POST/PATCH/DELETE <descriptive route name> absolute/route/name, () => { ... })
(must) it('should return correct response', async () => { ... })
(if exist) it('should return correct response with query params', async () => { ... })
(if exist) it('should return correct response with body params', async () => { ... })
(if exist) it('should return correct response with path params', async () => { ... })
describe(VALIDATION absolute/route/name)
(if exists) it(should [descriptive test] , () => { ... })

## Git

### Commit

Selalu commit menggunakan convential message dan bagi per cases agar mudah di rollback dan tidak breaking changes
