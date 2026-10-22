-- Área de usuários exclusiva do SuperAdmin (ADR-025): remove as permissões
-- granulares users.* já gravadas nas bases existentes. A lista canônica em
-- `ALL_PERMISSIONS` deixou de aceitá-las, então a limpeza evita valores
-- órfãos no array `permissions`.
UPDATE "users"
SET "permissions" = ARRAY(
  SELECT p FROM unnest("permissions") AS p WHERE p NOT LIKE 'users.%'
);
