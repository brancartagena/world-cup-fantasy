"use client";

import { useEffect, useMemo, useState } from "react";

import {
  type DraftPlayer,
  getDraftOrder,
  validateDraftSelection,
} from "@/lib/draft";
import { draftRules, scoringRules } from "@/lib/fantasy-config";
import { sampleFixtures, samplePlayers } from "@/lib/sample-data";
import { supabase } from "@/lib/supabase";

type Member = {
  id: string;
  name: string;
  userId: string;
  isHost: boolean;
};

type Pick = {
  memberId: string;
  player: DraftPlayer;
  pickNumber: number;
};

type LeagueRow = {
  id: string;
  name: string;
  invite_code: string;
  host_user_id: string;
};

type MemberRow = {
  id: string;
  display_name: string;
  user_id: string;
  is_host: boolean;
};

type PlayerRow = {
  id: string;
  name: string;
  position: string;
  teams: { name: string } | null;
};

type LeagueStateRow = {
  draft_order: string[] | null;
  picks: Pick[] | null;
  scores: Record<string, number> | null;
};

type Tab = "league" | "draft" | "scores";

const activeLeagueKey = "world-cup-fantasy-active-league";

export function LeagueApp() {
  const [leagueId, setLeagueId] = useState("");
  const [leagueName, setLeagueName] = useState("2026 World Cup Crew");
  const [inviteCode, setInviteCode] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [draftOrder, setDraftOrder] = useState<string[]>([]);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("league");
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState("ALL");
  const [playerPool, setPlayerPool] = useState<DraftPlayer[]>(samplePlayers);
  const [timer, setTimer] = useState(120);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("Connecting to Supabase...");
  const [copiedInvite, setCopiedInvite] = useState(false);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setTimer((current) =>
        current > 0 && draftOrder.length ? current - 1 : current,
      );
    }, 1000);

    return () => window.clearInterval(interval);
  }, [draftOrder.length]);

  const currentUserMember = members.find((member) => member.userId === userId);
  const isHost = currentUserMember?.isHost ?? false;
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

  const availablePlayers = playerPool.filter((player) => {
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

  async function createLeague() {
    const trimmedName = leagueName.trim();
    const trimmedDisplayName = displayName.trim() || "Host";
    const code = createInviteCode();

    setSaving(true);
    setStatus("Creating league...");

    const { data: league, error: leagueError } = await supabase
      .from("leagues")
      .insert({
        name: trimmedName || "2026 World Cup Crew",
        invite_code: code,
        host_user_id: userId,
      })
      .select("id,name,invite_code,host_user_id")
      .single<LeagueRow>();

    if (leagueError || !league) {
      setStatus(leagueError?.message ?? "Could not create league.");
      setSaving(false);
      return;
    }

    const { data: hostMember, error: memberError } = await supabase
      .from("league_members")
      .insert({
        league_id: league.id,
        user_id: userId,
        display_name: trimmedDisplayName,
        is_host: true,
      })
      .select("id,display_name,user_id,is_host")
      .single<MemberRow>();

    const { error: stateError } = await supabase.from("league_states").insert({
      league_id: league.id,
      draft_order: [],
      picks: [],
      scores: {},
    });

    if (memberError || !hostMember || stateError) {
      setStatus(memberError?.message ?? stateError?.message ?? "Setup failed.");
      setSaving(false);
      return;
    }

    window.localStorage.setItem(activeLeagueKey, league.id);
    setLeagueId(league.id);
    setLeagueName(league.name);
    setInviteCode(league.invite_code);
    setMembers([
      {
        id: hostMember.id,
        isHost: true,
        name: hostMember.display_name,
        userId: hostMember.user_id,
      },
    ]);
    setDraftOrder([]);
    setPicks([]);
    setScores({});
    setStatus("League created. Share the invite code.");
    setSaving(false);
  }

  async function joinLeague() {
    const trimmedName = displayName.trim();

    if (!trimmedName || !joinCode.trim()) {
      setStatus("Enter your name and invite code.");
      return;
    }

    setSaving(true);
    setStatus("Joining league...");

    const { data, error } = await supabase.rpc("join_league", {
      join_code: joinCode,
      member_name: trimmedName,
    });

    if (error || !data) {
      setStatus(error?.message ?? "Could not join league.");
      setSaving(false);
      return;
    }

    window.localStorage.setItem(activeLeagueKey, data);
    await loadLeague(data);
    setStatus("Joined league.");
    setSaving(false);
  }

  async function loadLeague(targetLeagueId: string) {
    const { data: league } = await supabase
      .from("leagues")
      .select("id,name,invite_code,host_user_id")
      .eq("id", targetLeagueId)
      .single<LeagueRow>();

    if (!league) {
      window.localStorage.removeItem(activeLeagueKey);
      return;
    }

    setLeagueId(league.id);
    setLeagueName(league.name);
    setInviteCode(league.invite_code);
    await loadMembers(league.id);
    await loadLeagueState(league.id);
  }

  async function loadMembers(targetLeagueId: string) {
    const { data } = await supabase
      .from("league_members")
      .select("id,display_name,user_id,is_host")
      .eq("league_id", targetLeagueId)
      .order("joined_at", { ascending: true })
      .returns<MemberRow[]>();

    if (data) {
      setMembers(
        data.map((member) => ({
          id: member.id,
          isHost: member.is_host,
          name: member.display_name,
          userId: member.user_id,
        })),
      );
    }
  }

  async function loadLeagueState(targetLeagueId: string) {
    const { data } = await supabase
      .from("league_states")
      .select("draft_order,picks,scores")
      .eq("league_id", targetLeagueId)
      .single<LeagueStateRow>();

    if (data) {
      setDraftOrder(data.draft_order ?? []);
      setPicks(data.picks ?? []);
      setScores(data.scores ?? {});
    }
  }

  async function loadPlayers() {
    const { data, error } = await supabase
      .from("players")
      .select("id,name,position,teams(name)")
      .order("name", { ascending: true })
      .returns<PlayerRow[]>();

    if (error || !data?.length) {
      setPlayerPool(samplePlayers);
      return;
    }

    setPlayerPool(
      data.map((player) => ({
        id: player.id,
        name: player.name,
        position: normalizePosition(player.position),
        team: player.teams?.name ?? "Unknown",
      })),
    );
  }

  useEffect(() => {
    async function boot() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const activeSession =
        session ?? (await supabase.auth.signInAnonymously()).data.session;

      if (!activeSession?.user) {
        setStatus("Could not start anonymous Supabase session.");
        setLoading(false);
        return;
      }

      setUserId(activeSession.user.id);
      await loadPlayers();

      const savedLeagueId = window.localStorage.getItem(activeLeagueKey);
      if (savedLeagueId) {
        await loadLeague(savedLeagueId);
      }

      setStatus("");
      setLoading(false);
    }

    void boot();
    // Runs once on app start to restore the anonymous session and active room.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!leagueId) {
      return;
    }

    const channel = supabase
      .channel(`league-room-${leagueId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "league_members",
          filter: `league_id=eq.${leagueId}`,
        },
        () => {
          void loadMembers(leagueId);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "league_states",
          filter: `league_id=eq.${leagueId}`,
        },
        () => {
          void loadLeagueState(leagueId);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [leagueId]);

  async function saveLeagueState(nextState: {
    draftOrder?: string[];
    picks?: Pick[];
    scores?: Record<string, number>;
  }) {
    if (!leagueId) {
      return;
    }

    await supabase
      .from("league_states")
      .update({
        draft_order: nextState.draftOrder ?? draftOrder,
        picks: nextState.picks ?? picks,
        scores: nextState.scores ?? scores,
      })
      .eq("league_id", leagueId);
  }

  async function lockDraftOrder() {
    const nextDraftOrder = getDraftOrder(
      members.map((member) => member.id),
      `${leagueId}:${leagueName}`,
    );

    setDraftOrder(nextDraftOrder);
    setPicks([]);
    setTimer(120);
    setActiveTab("draft");
    await saveLeagueState({ draftOrder: nextDraftOrder, picks: [] });
    await supabase
      .from("leagues")
      .update({ draft_order_locked_at: new Date().toISOString() })
      .eq("id", leagueId);
  }

  async function removeMember(memberId: string) {
    if (!isHost || draftOrder.length) {
      return;
    }

    await supabase.from("league_members").delete().eq("id", memberId);
  }

  async function deleteRoom() {
    if (!isHost || !leagueId) {
      return;
    }

    const confirmed = window.confirm(
      "Delete this room for everyone? This removes the league, members, draft picks, and scores.",
    );

    if (!confirmed) {
      return;
    }

    setSaving(true);
    setStatus("Deleting room...");

    const { error } = await supabase.from("leagues").delete().eq("id", leagueId);

    if (error) {
      setStatus(error.message);
      setSaving(false);
      return;
    }

    leaveLeague();
    setStatus("Room deleted.");
    setSaving(false);
  }

  function leaveLeague() {
    window.localStorage.removeItem(activeLeagueKey);
    setLeagueId("");
    setInviteCode("");
    setMembers([]);
    setDraftOrder([]);
    setPicks([]);
    setScores({});
    setTimer(120);
    setActiveTab("league");
    setStatus("");
  }

  async function copyInviteCode() {
    if (!inviteCode) {
      return;
    }

    await navigator.clipboard.writeText(inviteCode);
    setCopiedInvite(true);
    window.setTimeout(() => setCopiedInvite(false), 1800);
  }

  async function draftPlayer(player: DraftPlayer) {
    if (!currentMemberId) {
      return;
    }

    if (currentUserMember?.id !== currentMemberId) {
      window.alert("It is not your pick.");
      return;
    }

    const currentRoster = rosters[currentMemberId] ?? [];
    const validation = validateDraftSelection(currentRoster, player);

    if (!validation.valid) {
      window.alert(validation.reasons.join("\n"));
      return;
    }

    const nextPicks = [
      ...picks,
      { memberId: currentMemberId, player, pickNumber: currentPickNumber },
    ];

    setPicks(nextPicks);
    setTimer(120);
    await saveLeagueState({ picks: nextPicks });
  }

  async function nudgeScore(playerId: string, delta: number) {
    if (!isHost) {
      window.alert("Only the host can adjust scores.");
      return;
    }

    const nextScores = {
      ...scores,
      [playerId]: Math.max(-10, (scores[playerId] ?? 0) + delta),
    };

    setScores(nextScores);
    await saveLeagueState({ scores: nextScores });
  }

  if (loading) {
    return <LoadingScreen status={status} />;
  }

  if (!leagueId) {
    return (
      <RoomGate
        createLeague={createLeague}
        displayName={displayName}
        joinCode={joinCode}
        joinLeague={joinLeague}
        leagueName={leagueName}
        saving={saving}
        setDisplayName={setDisplayName}
        setJoinCode={setJoinCode}
        setLeagueName={setLeagueName}
        status={status}
      />
    );
  }

  return (
    <main className="min-h-screen bg-[#f3f0e8] text-[#141414]">
      <header className="border-b border-black/10 bg-[#103d35] text-white">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 py-4 sm:gap-6 sm:px-6 sm:py-5 lg:px-8">
          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#f4c84b]">
                Private World Cup fantasy
              </p>
              <h1 className="mt-2 text-2xl font-semibold leading-tight sm:text-4xl">
                {leagueName}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="rounded border border-white/20 px-3 py-2 font-mono text-sm font-semibold tracking-[0.16em] text-white">
                  {inviteCode}
                </span>
                <button
                  className="rounded border border-white/25 px-3 py-2 text-xs font-semibold text-white/82"
                  onClick={copyInviteCode}
                  type="button"
                >
                  {copiedInvite ? "Copied" : "Copy Code"}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <Stat label="Members" value={`${members.length}/10`} />
              <Stat label="Picks" value={`${picks.length}/${totalPicks}`} />
              <Stat label="Timer" value={formatTimer(timer)} />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 sm:flex sm:flex-wrap">
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
            <button
              className="border border-white/20 px-4 py-2 text-sm font-semibold text-white/78"
              onClick={leaveLeague}
              type="button"
            >
              Leave
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-4 px-4 py-4 sm:gap-5 sm:px-6 sm:py-5 lg:px-8">
        {status ? (
          <div className="rounded border border-black/10 bg-white px-4 py-3 text-sm">
            {status}
          </div>
        ) : null}

        {activeTab === "league" ? (
          <LeaguePanel
            draftOrder={draftOrder}
            deleteRoom={deleteRoom}
            inviteCode={inviteCode}
            isHost={isHost}
            lockDraftOrder={lockDraftOrder}
            members={members}
            removeMember={removeMember}
            saving={saving}
          />
        ) : null}

        {activeTab === "draft" ? (
          <DraftPanel
            availablePlayers={availablePlayers}
            currentMember={currentMember}
            currentUserMember={currentUserMember}
            draftOrder={draftOrder}
            draftPlayer={draftPlayer}
            isHost={isHost}
            members={members}
            picks={picks}
            playerCount={playerPool.length}
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
            isHost={isHost}
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

function RoomGate(props: {
  createLeague: () => void;
  displayName: string;
  joinCode: string;
  joinLeague: () => void;
  leagueName: string;
  saving: boolean;
  setDisplayName: (value: string) => void;
  setJoinCode: (value: string) => void;
  setLeagueName: (value: string) => void;
  status: string;
}) {
  return (
    <main className="min-h-screen bg-[#f3f0e8] text-[#141414]">
      <section className="bg-[#103d35] px-4 py-7 text-white sm:py-10">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#f4c84b]">
            Private World Cup fantasy
          </p>
          <h1 className="mt-3 max-w-3xl text-3xl font-semibold leading-tight sm:text-5xl">
            Create a room or join your friends.
          </h1>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-4 px-4 py-4 sm:gap-5 sm:py-5 md:grid-cols-2">
        <Panel title="Create Room">
          <label className="grid gap-2 text-sm font-semibold">
            Your name
            <input
              className="min-h-12 border border-black/15 px-3 py-3 text-base font-normal"
              onChange={(event) => props.setDisplayName(event.target.value)}
              placeholder="Host name"
              value={props.displayName}
            />
          </label>
          <label className="mt-4 grid gap-2 text-sm font-semibold">
            League name
            <input
              className="min-h-12 border border-black/15 px-3 py-3 text-base font-normal"
              onChange={(event) => props.setLeagueName(event.target.value)}
              value={props.leagueName}
            />
          </label>
          <button
            className="mt-4 min-h-12 w-full bg-[#f4c84b] px-5 py-3 font-semibold text-black disabled:bg-black/15"
            disabled={props.saving}
            onClick={props.createLeague}
            type="button"
          >
            Create Room
          </button>
        </Panel>

        <Panel title="Join Room">
          <label className="grid gap-2 text-sm font-semibold">
            Your name
            <input
              className="min-h-12 border border-black/15 px-3 py-3 text-base font-normal"
              onChange={(event) => props.setDisplayName(event.target.value)}
              placeholder="Your name"
              value={props.displayName}
            />
          </label>
          <label className="mt-4 grid gap-2 text-sm font-semibold">
            Invite code
            <input
              className="min-h-12 border border-black/15 px-3 py-3 text-base font-normal uppercase"
              onChange={(event) => props.setJoinCode(event.target.value)}
              placeholder="WC2026"
              value={props.joinCode}
            />
          </label>
          <button
            className="mt-4 min-h-12 w-full bg-[#103d35] px-5 py-3 font-semibold text-white disabled:bg-black/15"
            disabled={props.saving}
            onClick={props.joinLeague}
            type="button"
          >
            Join Room
          </button>
        </Panel>

        {props.status ? (
          <div className="rounded border border-black/10 bg-white px-4 py-3 text-sm md:col-span-2">
            {props.status}
          </div>
        ) : null}
      </section>
    </main>
  );
}

function LeaguePanel(props: {
  deleteRoom: () => void;
  draftOrder: string[];
  inviteCode: string;
  isHost: boolean;
  lockDraftOrder: () => void;
  members: Member[];
  removeMember: (memberId: string) => void;
  saving: boolean;
}) {
  return (
    <section className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="grid gap-5">
        <Panel title="Room">
          <div className="border border-black/10 bg-[#f3f0e8] p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-black/50">
              Invite code
            </div>
            <div className="mt-2 break-all font-mono text-3xl font-semibold tracking-[0.12em] sm:text-4xl">
              {props.inviteCode}
            </div>
          </div>
          <button
            className="mt-4 min-h-12 w-full bg-[#f4c84b] px-5 py-3 font-semibold text-black disabled:bg-black/15"
            disabled={!props.isHost || props.members.length < 2}
            onClick={props.lockDraftOrder}
            type="button"
          >
            Lock Draft Order
          </button>
          {!props.isHost ? (
            <p className="mt-3 text-sm text-black/55">
              Waiting for the host to manage the draft.
            </p>
          ) : null}
          {props.isHost ? (
            <button
              className="mt-3 min-h-12 w-full border border-red-800/30 bg-white px-5 py-3 font-semibold text-red-800 disabled:opacity-45"
              disabled={props.saving}
              onClick={props.deleteRoom}
              type="button"
            >
              Delete Room
            </button>
          ) : null}
        </Panel>

        <Panel title="Rules">
          <div className="grid gap-1">
            {draftRules.map((rule) => (
              <RuleRow key={rule.label} label={rule.label} value={rule.value} />
            ))}
          </div>
        </Panel>
      </div>

      <Panel title="League Members">
        <div className="grid gap-2">
          {props.members.map((member, index) => (
            <div
              className="grid grid-cols-[auto_1fr] gap-3 border-b border-black/10 py-3 sm:grid-cols-[auto_1fr_auto] sm:items-center"
              key={member.id}
            >
              <span className="grid size-8 place-items-center bg-[#103d35] text-sm font-semibold text-white">
                {index + 1}
              </span>
              <span>
                <span className="block font-semibold">{member.name}</span>
                {member.isHost ? (
                  <span className="text-xs uppercase tracking-[0.14em] text-black/45">
                    Host
                  </span>
                ) : null}
              </span>
              {props.isHost && !member.isHost && !props.draftOrder.length ? (
                <button
                  className="col-span-2 min-h-10 border border-black/15 px-3 py-2 text-xs font-semibold sm:col-span-1"
                  onClick={() => props.removeMember(member.id)}
                  type="button"
                >
                  Remove
                </button>
              ) : (
                <span className="text-xs uppercase tracking-[0.14em] text-black/45">
                  {props.draftOrder.includes(member.id) ? "Order set" : "Joined"}
                </span>
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
  currentUserMember?: Member;
  draftOrder: string[];
  draftPlayer: (player: DraftPlayer) => void;
  isHost: boolean;
  members: Member[];
  picks: Pick[];
  playerCount: number;
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
          The host needs to lock the draft order before picks can begin.
        </p>
      </Panel>
    );
  }

  const canPick = props.currentUserMember?.id === props.currentMember?.id;

  return (
    <section className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
      <div className="grid gap-4 sm:gap-5">
        <Panel title="On The Clock">
          <div className="bg-[#103d35] p-4 text-white sm:p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-[#f4c84b]">
              Current pick
            </p>
            <h2 className="mt-2 text-2xl font-semibold sm:text-3xl">
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
                  <span>
                    {index + 1}. {member?.name}
                  </span>
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
        {!canPick ? (
          <p className="mb-4 text-sm text-black/55">
            Waiting for {props.currentMember?.name} to pick.
          </p>
        ) : null}
        <p className="mb-4 text-sm text-black/55">
          {props.playerCount} players loaded.
        </p>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <input
            className="min-h-12 border border-black/15 bg-white px-3 py-3 text-base outline-none focus:border-[#103d35]"
            onChange={(event) => props.setQuery(event.target.value)}
            placeholder="Search player or nation"
            value={props.query}
          />
          <select
            className="min-h-12 border border-black/15 bg-white px-3 py-3 text-base outline-none focus:border-[#103d35]"
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
              className="grid grid-cols-[1fr_auto] items-center gap-3 border border-black/10 bg-white p-3 text-left transition enabled:hover:border-[#103d35] disabled:opacity-45 sm:gap-4 sm:p-4"
              disabled={!canPick}
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
  isHost: boolean;
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
        <Panel title="Host Score Adjustments">
          <p className="mb-4 text-sm leading-6 text-black/62">
            Free live data will plug into this same score store later. For now,
            the host can correct points and everyone sees the change live.
          </p>
          <div className="grid gap-2">
            {Object.entries(props.rosters).flatMap(([memberId, roster]) =>
              roster.map((player) => (
                <div
                  className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 border-b border-black/10 py-3"
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
                    className="size-10 border border-black/15 bg-white font-semibold disabled:opacity-40"
                    disabled={!props.isHost}
                    onClick={() => props.nudgeScore(player.id, -1)}
                    type="button"
                  >
                    -
                  </button>
                  <span className="w-8 text-center font-semibold">
                    {props.scores[player.id] ?? 0}
                  </span>
                  <button
                    className="size-10 border border-black/15 bg-white font-semibold disabled:opacity-40"
                    disabled={!props.isHost}
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

function LoadingScreen(props: { status: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f3f0e8] px-4 text-[#141414]">
      <div className="rounded-lg border border-black/10 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">World Cup Fantasy</h1>
        <p className="mt-2 text-sm text-black/60">{props.status}</p>
      </div>
    </main>
  );
}

function Panel(props: { children: React.ReactNode; title: string }) {
  return (
    <section className="rounded-lg border border-black/10 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="text-lg font-semibold sm:text-xl">{props.title}</h2>
      <div className="mt-4">{props.children}</div>
    </section>
  );
}

function RuleRow(props: { label: string; value: string }) {
  return (
    <div className="grid gap-1 border-b border-black/10 py-3 text-sm sm:flex sm:items-center sm:justify-between sm:gap-4">
      <span className="text-black/60">{props.label}</span>
      <span className="font-semibold sm:text-right">{props.value}</span>
    </div>
  );
}

function Stat(props: { label: string; value: string }) {
  return (
    <div className="min-w-0 border border-white/18 px-2 py-2 sm:min-w-20 sm:px-3">
      <div className="text-base font-semibold sm:text-lg">{props.value}</div>
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

function createInviteCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";

  for (let index = 0; index < 6; index += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return code;
}

function normalizePosition(position: string): DraftPlayer["position"] {
  const normalized = position.toUpperCase();

  if (["GK", "DEF", "MID", "FWD"].includes(normalized)) {
    return normalized as DraftPlayer["position"];
  }

  if (normalized.includes("GOAL")) return "GK";
  if (normalized.includes("DEF")) return "DEF";
  if (normalized.includes("MID")) return "MID";
  return "FWD";
}
