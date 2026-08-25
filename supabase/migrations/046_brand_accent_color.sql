-- ============================================================
-- Troca da cor primária da marca: do índigo genérico de SaaS
-- (#6366f1) para um verde-oliva terroso ("Colheita", tom Oliva —
-- oklch(0.33 0.065 116)), com raiz missiológica (Mt 9:37, "a seara
-- é grande"). Ver estudo em design/paleta-missiologica.{html,pdf}.
--
-- O token visual (--primary em globals.css) já foi atualizado no
-- código; aqui só o valor padrão de profiles.accent_color, que é
-- customizável por usuário e usado como cor de identidade do perfil
-- (anel de destaque, capa de post sem imagem, etc.).
-- ============================================================
ALTER TABLE public.profiles ALTER COLUMN accent_color SET DEFAULT '#34390c';

-- Perfis que nunca customizaram a cor (ainda no antigo valor padrão)
-- acompanham a troca — quem já escolheu a própria cor não é afetado.
UPDATE public.profiles SET accent_color = '#34390c' WHERE accent_color = '#6366f1';
