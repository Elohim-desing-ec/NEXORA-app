-- NEXORA · Seguridad: cerrar el pago simulado.
-- comprar_plan() creaba una licencia «activa» SIN cobrar y sin fecha de vencimiento, y cualquier
-- usuario con sesión podía llamarla en /rest/v1/rpc/comprar_plan. La app ya cobra con Payphone
-- (función payphone), así que nadie desde la API debe poder ejecutarla. Las licencias existentes no cambian.
-- Ejecutar en Supabase → SQL Editor. Para deshacer: grant execute on function ... to authenticated;
revoke execute on function public.comprar_plan(text, text, text, text, text) from public, anon, authenticated;
