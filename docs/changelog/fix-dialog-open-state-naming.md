# Changelog — Dialog `onOpenChange`: `o` → `nextOpen`

- Renomeado o parâmetro dos handlers `onOpenChange` de `o` para `nextOpen`
  em 7 pontos (`CardPreviewDialog`, `MembersPage` ×2, `MemberDetailPage`,
  `CardsPage`, `UsersPage` ×2).
- Só legibilidade: nenhuma condição, lógica ou comportamento foi alterado.
  `!nextOpen` lê-se "quando estiver fechando" (estado que o Radix entrega).
