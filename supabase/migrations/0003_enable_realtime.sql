-- Enable Realtime change broadcasts for the tables the app subscribes to.
alter publication supabase_realtime add table games;
alter publication supabase_realtime add table participants;
alter publication supabase_realtime add table game_heads;
alter publication supabase_realtime add table rounds;
