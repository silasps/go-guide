<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Documentação de arquitetura

O arquivo `system.architecture.md` na raiz do projeto documenta a arquitetura completa do sistema (schema do banco, RLS, lógica de negócio, rotas, componentes, convenções de UI) com detalhe suficiente para reconstruir o sistema do zero.

**Sempre que uma mudança relevante for feita no sistema** (nova tabela/coluna/migration, nova rota ou API, novo componente ou fluxo de negócio, nova integração externa, mudança de convenção), **atualize `system.architecture.md`** na seção correspondente e adicione uma linha no seu Changelog (data + o que mudou). Não deixe esse arquivo dessincronizar do código.
