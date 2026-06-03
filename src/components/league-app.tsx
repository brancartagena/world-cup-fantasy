"use client";

import { useEffect, useMemo, useState } from "react";

import {
  type DraftPlayer,
  getDraftOrder,
  validateDraftSelection,
} from "@/lib/draft";
import { draftRules, scoringRules } from "@/lib/fantasy-config";
import { sampleFixtures, samplePlayers } from "@/lib/sample-data";

type Member = {
  id: string;
  name: string;
};

type Pick = {
  memberId: string;
  player: DraftPlayer;
  pickNumber: number;
};

type Tab = "league" | "draft" | "scores";
type SavedLeagueState = {
  draftOrder: string[];
  leagueName: string;
  members: Member[];
  picks: Pick[];
  scores: Record<string, number>;
};

const storageKey = "world-cup-fantasy-private-league";

const initialMembers: Member[] = [
  { id: "host", name: "Host" },
  { id: "brandon", name: "Brandon" },
  { id: "alex", name: "Alex" },
  { id: "mike", name: "Mike" },
];

export function LeagueApp() {
  const [leagueName, setLeagueName] = useState(
    () => readSavedLeagueState().leagueName,
  );
  const [members, setMembers] = useState<Member[]>(
    () => readSavedLeagueState().members,
  );
  const [newMember, setNewMember] = useState("");
  const [draftOrder, setDraftOrder] = useState<string[]>(
    () => readSavedLeagueState().draftOrder,
  );
  const [picks, setPicks] = useState<Pick[]>(
    () => readSavedLeagueState().picks,
  );
  const [activeTab, setActiveTab] = useState<Tab>("league");
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState("ALL");
  const [timer, setTimer] = useState(120);
  const [scores, setScores] = useState<Record<string, number>>(
    () => readSavedLeagueState().scores,
  );

  useEffect(() => {
    const interval = window.setInterval(() => {
      setTimer((current) => (current > 0 && draftOrder.length ? current - 1 : current));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [draftOrder.length]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const payload: SavedLeagueState = {
      draftOrder,
      leagueName,
      members,
      picks,
      scores,
    };

    window.localStorage.setItem(storageKey, JSON.stringify(payload));
  }, [draftOrder, leagueName, members, picks, scores]);

  const roundCount = 6;
  const totalPicks = members.length * roundCount;
  const currentPickNumber = picks.length + 1;
  const currentMemberId =
    draftOrder.length && currentPickNumber <= totalPicks
      ? getMemberForPick(draftOrder, currentPickNumber)
      : null;
  const currentMember = members.find((member) => member.id === currentMemberId);
  const draftedPlayerIds = new Set(picks.map((pick) => pick.player.id));

  const rosters = useMemo(() => {
    return Object.fromEntries(
      members.map((member) => [
        member.id,
        picks
          .filter((pick) => pick.memberId === member.id)
          .map((pick) => pick.player),
      ]),
    ) as Record<string, DraftPlayer[]>;
  }, [members, picks]);

  const availablePlayers = samplePlayers.filter((player) => {
    const matchesQuery = `${player.name} ${player.team}`
      .toLowerCase()
      .includes(query.toLowerCase());
    const matchesPosition = position === "ALL" || player.position === position;

    return !draftedPlayerIds.has(player.id) && matchesQuery && matchesPosition;
  });

  const leaderboard = members
    .map((member) => ({
      ...member,
      points: (rosters[member.id] ?? []).reduce(
        (total, player) => total + (scores[player.id] ?? 0),
        0,
      ),
    }))
    .sort((a, b) => b.points - a.points);

  function addMember() {
    const trimmed = newMember.trim();

    if (!trimmed || members.length >= 10) {
      return;
    }

    setMembers((current) => [
      ...current,
      { id: `${trimmed.toLowerCase().replaceAll(" ", "-")}-${Date.now()}`, name: trimmed },
    ]);
    setNewMember("");
  }

  function lockDraftOrder() {
    setDraftOrder(getDraftOrder(members.map((member) => member.id), leagueName));
    setPicks([]);
    setTimer(120);
    setActiveTab("draft");
  }

  function removeMember(memberId: string) {
    if (draftOrder.length || memberId === "host") {
      return;
    }

    setMembers((current) => current.filter((member) => member.id !== memberId));
  }

  function resetLeague() {
    setLeagueName("2026 World Cup Crew");
    setMembers(initialMembers);
    setNewMember("");
    setDraftOrder([]);
    setPicks([]);
    setScores({});
    setTimer(120);
    setActiveTab("league");
    window.localStorage.removeItem(storageKey);
  }

  function draftPlayer(player: DraftPlayer) {
    if (!currentMemberId) {
      return;
    }

    const currentRoster = rosters[currentMemberId] ?? [];
    const validation = validateDraftSelection(currentRoster, player);

    if (!validation.valid) {
      window.alert(validation.reasons.join("\n"));
      return;
    }

    setPicks((current) => [
      ...current,
      { memberId: currentMemberId, player, pickNumber: currentPickNumber },
    ]);
    setTimer(120);
  }

  function nudgeScore(playerId: string, delta: number) {
    setScores((current) => ({
      ...current,
      [playerId]: Math.max(-10, (current[playerId] ?? 0) + delta),
    }));
  }

  return (
    <main className="min-h-screen bg-[#f3f0e8] text-[#141414]">
      <header className="border-b border-black/10 bg-[#103d35] text-white">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#f4c84b]">
                Private World Cup fantasy
              </p>
              <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">
                {leagueName}
              </h1>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <Stat label="Members" value={`${members.length}/10`} />
              <Stat label="Picks" value={`${picks.length}/${totalPicks}`} />
              <Stat label="Timer" value={formatTimer(timer)} />
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto">
            {[
              ["league", "League"],
              ["draft", "Draft"],
              ["scores", "Scores"],
            ].map(([id, label]) => (
              <button
                className={`border px-4 py-2 text-sm font-semibold transition ${
                  activeTab === id
                    ? "border-[#f4c84b] bg-[#f4c84b] text-black"
                    : "border-white/20 text-white/78 hover:border-white/45"
                }`}
                key={id}
                onClick={() => setActiveTab(id as Tab)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-5 sm:px-6 lg:px-8">
        {activeTab === "league" ? (
          <LeaguePanel
            addMember={addMember}
            draftOrder={draftOrder}
            leagueName={leagueName}
            lockDraftOrder={lockDraftOrder}
            members={members}
            newMember={newMember}
            removeMember={removeMember}
            resetLeague={resetLeague}
            setLeagueName={setLeagueName}
            setNewMember={setNewMember}
          />
        ) : null}

        {activeTab === "draft" ? (
          <DraftPanel
            availablePlayers={availablePlayers}
            currentMember={currentMember}
            draftOrder={draftOrder}
            draftPlayer={draftPlayer}
            members={members}
            picks={picks}
            position={position}
            query={query}
            rosters={rosters}
            setPosition={setPosition}
            setQuery={setQuery}
            totalPicks={totalPicks}
          />
        ) : null}

        {activeTab === "scores" ? (
          <ScoresPanel
            leaderboard={leaderboard}
            members={members}
            nudgeScore={nudgeScore}
            rosters={rosters}
            scores={scores}
          />
        ) : null}
      </div>
    </main>
  );
}

function LeaguePanel(props: {
  addMember: () => void;
  draftOrder: string[];
  leagueName: string;
  lockDraftOrder: () => void;
  members: Member[];
  newMember: string;
  removeMember: (memberId: string) => void;
  resetLeague: () => void;
  setLeagueName: (value: string) => void;
  setNewMember: (value: string) => void;
}) {
  return (
    <section className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="grid gap-5">
        <Panel title="Host Setup">
          <label className="grid gap-2 text-sm font-semibold">
            League name
            <input
              className="border border-black/15 bg-white px-3 py-3 font-normal outline-none focus:border-[#103d35]"
              onChange={(event) => props.setLeagueName(event.target.value)}
              value={props.leagueName}
            />
          </label>

          <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
            <input
              className="border border-black/15 bg-white px-3 py-3 outline-none focus:border-[#103d35]"
              onChange={(event) => props.setNewMember(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") props.addMember();
              }}
              placeholder="Friend name"
              value={props.newMember}
            />
            <button
              className="bg-[#103d35] px-5 py-3 font-semibold text-white disabled:bg-black/20"
              disabled={props.members.length >= 10}
              onClick={props.addMember}
              type="button"
            >
              Add
            </button>
          </div>

          <button
            className="mt-4 w-full bg-[#f4c84b] px-5 py-3 font-semibold text-black"
            onClick={props.lockDraftOrder}
            type="button"
          >
            Lock Draft Order
          </button>

          <button
            className="mt-3 w-full border border-black/15 bg-white px-5 py-3 font-semibold text-black"
            onClick={props.resetLeague}
            type="button"
          >
            Reset League
          </button>
        </Panel>

        <Panel title="Rules">
          <div className="grid gap-1">
            {draftRules.map((rule) => (
              <RuleRow key={rule.label} label={rule.label} value={rule.value} />
            ))}
          </div>
        </Panel>
      </div>

      <Panel title="Invited Players">
        <div className="grid gap-2">
          {props.members.map((member, index) => (
            <div
              className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-black/10 py-3"
              key={member.id}
            >
              <span className="grid size-8 place-items-center bg-[#103d35] text-sm font-semibold text-white">
                {index + 1}
              </span>
              <span className="font-semibold">{member.name}</span>
              {member.id === "host" || props.draftOrder.length ? (
                <span className="text-xs uppercase tracking-[0.14em] text-black/45">
                  {props.draftOrder.includes(member.id) ? "Order set" : "Waiting"}
                </span>
              ) : (
                <button
                  className="border border-black/15 px-3 py-2 text-xs font-semibold"
                  onClick={() => props.removeMember(member.id)}
                  type="button"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      </Panel>
    </section>
  );
}

function DraftPanel(props: {
  availablePlayers: DraftPlayer[];
  currentMember?: Member;
  draftOrder: string[];
  draftPlayer: (player: DraftPlayer) => void;
  members: Member[];
  picks: Pick[];
  position: string;
  query: string;
  rosters: Record<string, DraftPlayer[]>;
  setPosition: (value: string) => void;
  setQuery: (value: string) => void;
  totalPicks: number;
}) {
  if (!props.draftOrder.length) {
    return (
      <Panel title="Draft Not Started">
        <p className="text-sm leading-6 text-black/65">
          Go to League and lock the draft order. The host controls this because
          this version is built for one private group of up to 10 people.
        </p>
      </Panel>
    );
  }

  return (
    <section className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
      <div className="grid gap-5">
        <Panel title="On The Clock">
          <div className="bg-[#103d35] p-5 text-white">
            <p className="text-xs uppercase tracking-[0.18em] text-[#f4c84b]">
              Current pick
            </p>
            <h2 className="mt-2 text-3xl font-semibold">
              {props.currentMember?.name ?? "Draft complete"}
            </h2>
            <p className="mt-2 text-sm text-white/70">
              Pick {props.picks.length + 1} of {props.totalPicks}
            </p>
          </div>

          <div className="mt-4 grid gap-2">
            {props.draftOrder.map((memberId, index) => {
              const member = props.members.find((item) => item.id === memberId);
              return (
                <div
                  className="flex items-center justify-between border-b border-black/10 py-2 text-sm"
                  key={memberId}
                >
                  <span>{index + 1}. {member?.name}</span>
                  <span className="text-black/45">
                    {(props.rosters[memberId] ?? []).length}/6
                  </span>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title="Rosters">
          <div className="grid gap-3">
            {props.members.map((member) => (
              <div className="border border-black/10 p-3" key={member.id}>
                <div className="flex justify-between gap-3 text-sm font-semibold">
                  <span>{member.name}</span>
                  <span>{(props.rosters[member.id] ?? []).length}/6</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {(props.rosters[member.id] ?? []).map((player) => (
                    <span
                      className="bg-[#ede7d8] px-2 py-1 text-xs"
                      key={player.id}
                    >
                      {player.name}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel title="Player Pool">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <input
            className="border border-black/15 bg-white px-3 py-3 outline-none focus:border-[#103d35]"
            onChange={(event) => props.setQuery(event.target.value)}
            placeholder="Search player or nation"
            value={props.query}
          />
          <select
            className="border border-black/15 bg-white px-3 py-3 outline-none focus:border-[#103d35]"
            onChange={(event) => props.setPosition(event.target.value)}
            value={props.position}
          >
            <option value="ALL">All</option>
            <option value="GK">GK</option>
            <option value="DEF">DEF</option>
            <option value="MID">MID</option>
            <option value="FWD">FWD</option>
          </select>
        </div>

        <div className="mt-4 grid gap-2">
          {props.availablePlayers.map((player) => (
            <button
              className="grid grid-cols-[1fr_auto] items-center gap-4 border border-black/10 bg-white p-4 text-left transition hover:border-[#103d35]"
              key={player.id}
              onClick={() => props.draftPlayer(player)}
              type="button"
            >
              <span>
                <span className="block font-semibold">{player.name}</span>
                <span className="text-sm text-black/55">
                  {player.team} - {player.position}
                </span>
              </span>
              <span className="bg-[#103d35] px-3 py-2 text-sm font-semibold text-white">
                Pick
              </span>
            </button>
          ))}
        </div>
      </Panel>
    </section>
  );
}

function ScoresPanel(props: {
  leaderboard: Array<Member & { points: number }>;
  members: Member[];
  nudgeScore: (playerId: string, delta: number) => void;
  rosters: Record<string, DraftPlayer[]>;
  scores: Record<string, number>;
}) {
  return (
    <section className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
      <Panel title="Leaderboard">
        <div className="grid gap-2">
          {props.leaderboard.map((member, index) => (
            <div
              className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-black/10 py-3"
              key={member.id}
            >
              <span className="grid size-8 place-items-center bg-[#103d35] text-sm font-semibold text-white">
                {index + 1}
              </span>
              <span className="font-semibold">{member.name}</span>
              <span className="text-lg font-semibold">{member.points}</span>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid gap-5">
        <Panel title="Admin Score Adjustments">
          <p className="mb-4 text-sm leading-6 text-black/62">
            Until free APIs are connected, the host can adjust player totals
            here. This is the same place we will show goals, assists, saves,
            clean sheets, red cards, and team-win points.
          </p>
          <div className="grid gap-2">
            {Object.entries(props.rosters).flatMap(([memberId, roster]) =>
              roster.map((player) => (
                <div
                  className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 border-b border-black/10 py-2"
                  key={`${memberId}-${player.id}`}
                >
                  <span>
                    <span className="block text-sm font-semibold">
                      {player.name}
                    </span>
                    <span className="text-xs text-black/50">
                      {props.members.find((member) => member.id === memberId)?.name} -{" "}
                      {player.team}
                    </span>
                  </span>
                  <button
                    className="size-9 border border-black/15 bg-white font-semibold"
                    onClick={() => props.nudgeScore(player.id, -1)}
                    type="button"
                  >
                    -
                  </button>
                  <span className="w-8 text-center font-semibold">
                    {props.scores[player.id] ?? 0}
                  </span>
                  <button
                    className="size-9 border border-black/15 bg-white font-semibold"
                    onClick={() => props.nudgeScore(player.id, 1)}
                    type="button"
                  >
                    +
                  </button>
                </div>
              )),
            )}
          </div>
        </Panel>

        <Panel title="Opening Fixtures">
          <div className="grid gap-2">
            {sampleFixtures.map((fixture) => (
              <div className="border border-black/10 p-3" key={fixture.id}>
                <div className="font-semibold">
                  {fixture.home} vs {fixture.away}
                </div>
                <div className="mt-1 text-sm text-black/55">
                  {fixture.date} - {fixture.venue}
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Scoring Rules">
          <div className="grid gap-1">
            {scoringRules.map((rule) => (
              <RuleRow key={rule.event} label={rule.event} value={rule.points} />
            ))}
          </div>
        </Panel>
      </div>
    </section>
  );
}

function Panel(props: { children: React.ReactNode; title: string }) {
  return (
    <section className="rounded-lg border border-black/10 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-semibold">{props.title}</h2>
      <div className="mt-4">{props.children}</div>
    </section>
  );
}

function RuleRow(props: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-black/10 py-3 text-sm">
      <span className="text-black/60">{props.label}</span>
      <span className="text-right font-semibold">{props.value}</span>
    </div>
  );
}

function Stat(props: { label: string; value: string }) {
  return (
    <div className="min-w-20 border border-white/18 px-3 py-2">
      <div className="text-lg font-semibold">{props.value}</div>
      <div className="text-xs uppercase tracking-[0.14em] text-white/55">
        {props.label}
      </div>
    </div>
  );
}

function getMemberForPick(order: string[], pickNumber: number) {
  const roundIndex = Math.floor((pickNumber - 1) / order.length);
  const pickIndex = (pickNumber - 1) % order.length;
  const roundOrder = roundIndex % 2 === 0 ? order : [...order].reverse();

  return roundOrder[pickIndex];
}

function formatTimer(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function readSavedLeagueState(): SavedLeagueState {
  const fallback = {
    draftOrder: [],
    leagueName: "2026 World Cup Crew",
    members: initialMembers,
    picks: [],
    scores: {},
  };

  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const saved = window.localStorage.getItem(storageKey);
    return saved ? (JSON.parse(saved) as SavedLeagueState) : fallback;
  } catch {
    return fallback;
  }
}
