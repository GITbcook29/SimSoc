-- results should be null until a round is closed and computed.
alter table rounds alter column results drop not null;
alter table rounds alter column results drop default;
