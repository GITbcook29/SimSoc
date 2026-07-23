-- Public, unauthenticated projector display.
-- Design: no participant names or any PII are exposed — only region-level
-- counts (already what the in-app Status board shows) and per-round
-- indicators/multiplier. Access is gated by an unguessable per-game share
-- token, not by exposing the tables themselves to the `anon` role. The
-- owner can regenerate the token at any time to revoke a previously shared
-- link (regular `games` UPDATE policy already allows this).

alter table games add column if not exists status_share_token uuid not null default gen_random_uuid();
alter table games add constraint games_status_share_token_key unique (status_share_token);

create or replace function public_status(p_token uuid)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'game_name', g.name,
    'current_round', g.current_round,
    'participants', coalesce((
      select jsonb_agg(jsonb_build_object('region', p.region, 'sessions', p.sessions))
      from participants p
      where p.game_id = g.id
    ), '[]'::jsonb),
    'rounds', coalesce((
      select jsonb_agg(
        jsonb_build_object('round_no', r.round_no, 'closed', r.closed, 'results', r.results)
        order by r.round_no
      )
      from rounds r
      where r.game_id = g.id
    ), '[]'::jsonb)
  )
  from games g
  where g.status_share_token = p_token;
$$;

grant execute on function public_status(uuid) to anon, authenticated;
