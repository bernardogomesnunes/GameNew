-- Already applied directly against the live database on 2026-09-20, before
-- this file existed — recorded here so the repo's history matches reality
-- from this point on. Do not re-run: the constraint is already this shape.
--
-- worlds_mode_check only ever allowed 'creative' and 'campaign'. Duilt mode
-- has saved worlds under mode = 'duilt' since it shipped, and every single
-- one of those saves was rejected with a 23514 check violation — the
-- constraint was simply never told the value existed. Widening a CHECK
-- constraint is a pure permission grant with no data to migrate; safe on a
-- populated table and, at the time this ran, the table held zero rows
-- anyway.

alter table worlds drop constraint worlds_mode_check;
alter table worlds add constraint worlds_mode_check
  check (mode = any (array['creative', 'campaign', 'duilt']));
