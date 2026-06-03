"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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

type WorldCupMatch = {
  awayGoals: number | null;
  awayTeam: string;
  awayTeamLogo: string;
  date: string;
  elapsed: number | null;
  fixtureId: number | string;
  homeGoals: number | null;
  homeTeam: string;
  homeTeamLogo: string;
  round: string;
  status: string;
  statusShort: string;
  venue: string;
};

type Tab = "league" | "draft" | "scores";

type AudioWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

const activeLeagueKey = "world-cup-fantasy-active-league";
const activeTabKey = "world-cup-fantasy-active-tab";
const soundEnabledKey = "world-cup-fantasy-sound-enabled";

export function LeagueApp() {
  const [leagueId, setLeagueId] = useState("");
  const [leagueName, setLeagueName] = useState("2026 World Cup Crew");
  const [inviteCode, setInviteCode] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [draftOrder, setDraftOrder] = useState<string[]>([]);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>(() => readSavedTab());
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
  const [matches, setMatches] = useState<WorldCupMatch[]>([]);
  const [liveMatches, setLiveMatches] = useState<WorldCupMatch[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [matchesError, setMatchesError] = useState("");
  const [matchesUpdatedAt, setMatchesUpdatedAt] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(() => readSavedSoundEnabled());
  const previousDraftStarted = useRef(false);
  const autoPickingRef = useRef(false);
  const previousDraftOrderCount = useRef(0);
  const previousPickCount = useRef(0);
  const previousTimerWarningPick = useRef(0);
  const soundUnlockedRef = useRef(false);

  const currentUserMember = members.find((member) => member.userId === userId);
  const isHost = currentUserMember?.isHost ?? false;
  const roundCount = 6;
  const totalPicks = members.length * roundCount;
  const draftComplete = totalPicks > 0 && picks.length >= totalPicks;
  const currentPickNumber = picks.length + 1;
  const currentMemberId =
    draftOrder.length && !draftComplete && currentPickNumber <= totalPicks
      ? getMemberForPick(draftOrder, currentPickNumber)
      : null;
  const currentMember = members.find((member) => member.id === currentMemberId);
  const draftedPlayerIds = new Set(picks.map((pick) => pick.player.id));

  useEffect(() => {
    if (draftComplete) {
      return;
    }

    const interval = window.setInterval(() => {
      setTimer((current) =>
        current > 0 && draftOrder.length ? current - 1 : current,
      );
    }, 1000);

    return () => window.clearInterval(interval);
  }, [draftComplete, draftOrder.length]);

  useEffect(() => {
    if (!draftOrder.length || draftComplete) {
      return;
    }

    const resetTimer = window.setTimeout(() => setTimer(120), 0);

    return () => window.clearTimeout(resetTimer);
  }, [draftComplete, draftOrder.length, picks.length]);

  useEffect(() => {
    window.localStorage.setItem(activeTabKey, activeTab);
  }, [activeTab]);

  useEffect(() => {
    window.localStorage.setItem(soundEnabledKey, String(soundEnabled));
  }, [soundEnabled]);

  useEffect(() => {
    const draftStarted = draftOrder.length > 0;

    if (draftStarted && !previousDraftStarted.current && activeTab === "league") {
      setActiveTab("draft");
    }

    previousDraftStarted.current = draftStarted;
  }, [activeTab, draftOrder.length]);

  useEffect(() => {
    if (previousDraftOrderCount.current === 0 && draftOrder.length > 0) {
      playAppSound("draft-lock", soundEnabled, soundUnlockedRef);
    }

    previousDraftOrderCount.current = draftOrder.length;
  }, [draftOrder.length, soundEnabled]);

  useEffect(() => {
    if (previousPickCount.current > 0 && picks.length > previousPickCount.current) {
      playAppSound(
        picks.length >= totalPicks ? "draft-complete" : "pick-made",
        soundEnabled,
        soundUnlockedRef,
      );
    }

    previousPickCount.current = picks.length;
  }, [picks.length, soundEnabled, totalPicks]);

  useEffect(() => {
    if (
      timer === 10 &&
      draftOrder.length &&
      !draftComplete &&
      previousTimerWarningPick.current !== currentPickNumber
    ) {
      playAppSound("timer-warning", soundEnabled, soundUnlockedRef);
      previousTimerWarningPick.current = currentPickNumber;
    }

    if (timer > 10) {
      previousTimerWarningPick.current = 0;
    }
  }, [
    currentPickNumber,
    draftComplete,
    draftOrder.length,
    soundEnabled,
    timer,
  ]);

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

  async function loadWorldCupMatches() {
    setMatchesLoading((current) => current || !matches.length);

    try {
      const response = await fetch("/api/world-cup/matches");
      const payload = (await response.json()) as {
        error?: string;
        live?: WorldCupMatch[];
        refreshedAt?: string;
        schedule?: WorldCupMatch[];
      };

      setLiveMatches(payload.live ?? []);
      setMatches(payload.schedule ?? []);
      setMatchesUpdatedAt(payload.refreshedAt ?? "");
      setMatchesError(
        payload.error
          ? payload.error
          : response.ok
            ? ""
            : "Could not load World Cup match data.",
      );
    } catch {
      setMatchesError("Could not load World Cup match data.");
    } finally {
      setMatchesLoading(false);
    }
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

  useEffect(() => {
    if (!leagueId) {
      return;
    }

    const interval = window.setInterval(() => {
      void loadMembers(leagueId);
      void loadLeagueState(leagueId);
    }, 3000);

    return () => window.clearInterval(interval);
    // Polling is a fallback for missed Realtime events on mobile/local dev.
  }, [leagueId]);

  useEffect(() => {
    if (!leagueId) {
      return;
    }

    const initialRefresh = window.setTimeout(() => {
      void loadWorldCupMatches();
    }, 0);
    const interval = window.setInterval(() => {
      void loadWorldCupMatches();
    }, 60_000);

    return () => {
      window.clearTimeout(initialRefresh);
      window.clearInterval(interval);
    };
    // API-Football data is routed through Next.js so the key stays private.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueId]);

  useEffect(() => {
    if (
      timer > 0 ||
      !leagueId ||
      !draftOrder.length ||
      draftComplete ||
      !currentMemberId
    ) {
      return;
    }

    void autoPickCurrentTurn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer, leagueId, draftOrder.length, draftComplete, currentMemberId]);

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
    if (!isHost || members.length < 2 || draftOrder.length || draftComplete) {
      return;
    }

    const nextDraftOrder = getDraftOrder(
      members.map((member) => member.id),
      `${leagueId}:${leagueName}`,
    );

    setDraftOrder(nextDraftOrder);
    setPicks([]);
    setTimer(120);
    setActiveTab("draft");
    unlockAppSound(soundUnlockedRef);
    playAppSound("draft-lock", soundEnabled, soundUnlockedRef);
    previousDraftOrderCount.current = nextDraftOrder.length;
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

    clearActiveLeague();
    setStatus("Room deleted.");
    setSaving(false);
  }

  async function leaveLeague() {
    if (!leagueId) {
      clearActiveLeague();
      return;
    }

    if (currentUserMember && !currentUserMember.isHost) {
      setSaving(true);
      setStatus("Leaving room...");

      const { error } = await supabase
        .from("league_members")
        .delete()
        .eq("id", currentUserMember.id)
        .eq("user_id", userId);

      if (error) {
        setStatus(error.message);
        setSaving(false);
        return;
      }
    }

    clearActiveLeague();
    setSaving(false);
  }

  function clearActiveLeague() {
    window.localStorage.removeItem(activeLeagueKey);
    setLeagueId("");
    setInviteCode("");
    setMembers([]);
    setDraftOrder([]);
    setPicks([]);
    setScores({});
    setMatches([]);
    setLiveMatches([]);
    setMatchesError("");
    setMatchesUpdatedAt("");
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

  function toggleSound() {
    const nextSoundEnabled = !soundEnabled;

    setSoundEnabled(nextSoundEnabled);

    if (nextSoundEnabled) {
      unlockAppSound(soundUnlockedRef);
      playAppSound("draft-lock", true, soundUnlockedRef);
    }
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
    playAppSound(
      nextPicks.length >= totalPicks ? "draft-complete" : "pick-made",
      soundEnabled,
      soundUnlockedRef,
    );
    previousPickCount.current = nextPicks.length;
    await saveLeagueState({ picks: nextPicks });
  }

  async function autoPickCurrentTurn() {
    if (autoPickingRef.current || !leagueId) {
      return;
    }

    autoPickingRef.current = true;

    try {
      const { data } = await supabase
        .from("league_states")
        .select("draft_order,picks,scores")
        .eq("league_id", leagueId)
        .single<LeagueStateRow>();
      const latestDraftOrder = data?.draft_order ?? draftOrder;
      const latestPicks = data?.picks ?? picks;

      if (!latestDraftOrder.length || latestPicks.length >= totalPicks) {
        setTimer(120);
        return;
      }

      if (latestPicks.length !== picks.length) {
        setDraftOrder(latestDraftOrder);
        setPicks(latestPicks);
        setScores(data?.scores ?? scores);
        setTimer(120);
        return;
      }

      const nextPickNumber = latestPicks.length + 1;
      const nextMemberId = getMemberForPick(latestDraftOrder, nextPickNumber);
      const draftedIds = new Set(latestPicks.map((pick) => pick.player.id));
      const currentRoster = latestPicks
        .filter((pick) => pick.memberId === nextMemberId)
        .map((pick) => pick.player);
      const autoPick = selectAutoPick(playerPool, draftedIds, currentRoster);

      if (!autoPick) {
        setStatus("No valid auto-pick was available.");
        setTimer(120);
        return;
      }

      const nextPicks = [
        ...latestPicks,
        {
          memberId: nextMemberId,
          pickNumber: nextPickNumber,
          player: autoPick,
        },
      ];

      setPicks(nextPicks);
      setTimer(120);
      await saveLeagueState({ picks: nextPicks });
    } finally {
      autoPickingRef.current = false;
    }
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
                World Cup Fantasy 2026
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
                <button
                  aria-pressed={soundEnabled}
                  className="rounded border border-white/25 px-3 py-2 text-xs font-semibold text-white/82"
                  onClick={toggleSound}
                  type="button"
                >
                  {soundEnabled ? "Sound On" : "Sound Off"}
                </button>
              </div>
            </div>
            <div
              className={`grid gap-2 text-center text-sm ${
                draftComplete ? "grid-cols-2" : "grid-cols-3"
              }`}
            >
              <Stat label="Members" value={`${members.length}/10`} />
              <Stat label="Picks" value={`${picks.length}/${totalPicks}`} />
              {!draftComplete ? (
                <Stat label="Timer" value={formatTimer(timer)} />
              ) : null}
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
            draftComplete={draftComplete}
            draftOrder={draftOrder}
            deleteRoom={deleteRoom}
            inviteCode={inviteCode}
            isHost={isHost}
            lockDraftOrder={lockDraftOrder}
            liveMatches={liveMatches}
            matches={matches}
            matchesError={matchesError}
            matchesLoading={matchesLoading}
            matchesUpdatedAt={matchesUpdatedAt}
            members={members}
            removeMember={removeMember}
            saving={saving}
          />
        ) : null}

        {activeTab === "draft" ? (
          <DraftPanel
            availablePlayers={availablePlayers}
            currentMember={currentMember}
            currentMemberId={currentMemberId}
            currentUserMember={currentUserMember}
            draftOrder={draftOrder}
            draftPlayer={draftPlayer}
            draftComplete={draftComplete}
            isHost={isHost}
            members={members}
            picks={picks}
            playerCount={playerPool.length}
            position={position}
            query={query}
            rosters={rosters}
            setPosition={setPosition}
            setQuery={setQuery}
            timer={timer}
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
            World Cup Fantasy 2026
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
  draftComplete: boolean;
  draftOrder: string[];
  inviteCode: string;
  isHost: boolean;
  lockDraftOrder: () => void;
  liveMatches: WorldCupMatch[];
  matches: WorldCupMatch[];
  matchesError: string;
  matchesLoading: boolean;
  matchesUpdatedAt: string;
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
          <DraftRoomAction
            draftComplete={props.draftComplete}
            draftOrder={props.draftOrder}
            isHost={props.isHost}
            lockDraftOrder={props.lockDraftOrder}
            memberCount={props.members.length}
          />
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
          <CompactRulesList
            rules={draftRules.map((rule) => ({
              label: rule.label,
              value: rule.value,
            }))}
          />
        </Panel>
      </div>

      <div className="grid gap-5">
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
                    {props.draftOrder.includes(member.id)
                      ? "Order set"
                      : "Joined"}
                  </span>
                )}
              </div>
            ))}
          </div>
        </Panel>

        <MatchCenter
          liveMatches={props.liveMatches}
          matches={props.matches}
          matchesError={props.matchesError}
          matchesLoading={props.matchesLoading}
          matchesUpdatedAt={props.matchesUpdatedAt}
        />
      </div>
    </section>
  );
}

function DraftRoomAction(props: {
  draftComplete: boolean;
  draftOrder: string[];
  isHost: boolean;
  lockDraftOrder: () => void;
  memberCount: number;
}) {
  if (props.draftComplete) {
    return (
      <div className="mt-4 border border-[#103d35]/20 bg-[#eef5ef] px-4 py-3">
        <div className="text-sm font-semibold text-[#103d35]">Draft complete</div>
        <p className="mt-1 text-sm text-black/58">
          Rosters are locked until the next transfer window.
        </p>
      </div>
    );
  }

  if (props.draftOrder.length) {
    return (
      <div className="mt-4 border border-black/10 bg-[#f3f0e8] px-4 py-3">
        <div className="text-sm font-semibold">Draft in progress</div>
        <p className="mt-1 text-sm text-black/58">
          The order is locked and picks are live.
        </p>
      </div>
    );
  }

  return (
    <button
      className="mt-4 min-h-12 w-full bg-[#f4c84b] px-5 py-3 font-semibold text-black disabled:bg-black/15"
      disabled={!props.isHost || props.memberCount < 2}
      onClick={props.lockDraftOrder}
      type="button"
    >
      Lock Draft Order
    </button>
  );
}

function MatchCenter(props: {
  liveMatches: WorldCupMatch[];
  matches: WorldCupMatch[];
  matchesError: string;
  matchesLoading: boolean;
  matchesUpdatedAt: string;
}) {
  const now = props.matchesUpdatedAt
    ? new Date(props.matchesUpdatedAt).getTime()
    : 0;
  const upcomingMatches = props.matches
    .filter((match) => new Date(match.date).getTime() >= now)
    .slice(0, 8);
  const fallbackMatches = upcomingMatches.length
    ? upcomingMatches
    : props.matches.slice(0, 8);

  return (
    <Panel title="World Cup Match Center">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs uppercase tracking-[0.14em] text-black/45">
        <span>
          {props.matchesLoading ? "Loading API-Football data" : "Schedule and live"}
        </span>
        {props.matchesUpdatedAt ? (
          <span>Updated {formatMatchDate(props.matchesUpdatedAt)}</span>
        ) : null}
      </div>

      {props.matchesError ? (
        <div className="mb-4 border border-amber-500/35 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {props.matchesError}
        </div>
      ) : null}

      {props.liveMatches.length ? (
        <div className="mb-5 grid gap-2">
          <div className="text-sm font-semibold">Live now</div>
          {props.liveMatches.map((match) => (
            <MatchRow highlight key={match.fixtureId} match={match} />
          ))}
        </div>
      ) : (
        <div className="mb-5 border border-black/10 bg-[#f3f0e8] px-3 py-2 text-sm text-black/62">
          No World Cup matches are live right now.
        </div>
      )}

      <div className="grid gap-2">
        <div className="text-sm font-semibold">Upcoming fixtures</div>
        {fallbackMatches.length ? (
          fallbackMatches.map((match) => (
            <MatchRow key={match.fixtureId} match={match} />
          ))
        ) : (
          <p className="text-sm text-black/55">
            Fixture data will appear here once API-Football returns the 2026
            schedule for your plan.
          </p>
        )}
      </div>
    </Panel>
  );
}

function MatchRow(props: { highlight?: boolean; match: WorldCupMatch }) {
  const { match } = props;
  const hasScore = match.homeGoals !== null || match.awayGoals !== null;

  return (
    <div
      className={`border p-3 ${
        props.highlight
          ? "border-[#103d35] bg-[#103d35] text-white"
          : "border-black/10 bg-white"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs uppercase tracking-[0.14em]">
        <span className={props.highlight ? "text-[#f4c84b]" : "text-black/45"}>
          {match.round}
        </span>
        <span className={props.highlight ? "text-white/70" : "text-black/45"}>
          {match.elapsed ? `${match.elapsed}'` : formatMatchDate(match.date)}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm sm:text-base">
        <TeamName logo={match.homeTeamLogo} name={match.homeTeam} />
        <span
          className={`px-2 py-1 text-center font-semibold ${
            props.highlight ? "bg-white/12" : "bg-[#f3f0e8]"
          }`}
        >
          {hasScore ? `${match.homeGoals ?? 0}-${match.awayGoals ?? 0}` : "vs"}
        </span>
        <TeamName alignRight logo={match.awayTeamLogo} name={match.awayTeam} />
      </div>
      <div
        className={`mt-2 text-xs ${
          props.highlight ? "text-white/65" : "text-black/50"
        }`}
      >
        {match.status}
        {match.venue ? ` - ${match.venue}` : ""}
      </div>
    </div>
  );
}

function TeamName(props: { alignRight?: boolean; logo: string; name: string }) {
  return (
    <span
      className={`flex min-w-0 items-center gap-2 font-semibold ${
        props.alignRight ? "justify-end text-right" : ""
      }`}
    >
      {!props.alignRight ? <TeamLogo logo={props.logo} name={props.name} /> : null}
      <span className="min-w-0 truncate">{props.name}</span>
      {props.alignRight ? <TeamLogo logo={props.logo} name={props.name} /> : null}
    </span>
  );
}

function TeamLogo(props: { logo: string; name: string }) {
  if (!props.logo) {
    return null;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt=""
      className="size-5 shrink-0 rounded-full bg-white object-contain"
      src={props.logo}
      title={props.name}
    />
  );
}

function DraftPanel(props: {
  availablePlayers: DraftPlayer[];
  currentMember?: Member;
  currentMemberId: string | null;
  currentUserMember?: Member;
  draftOrder: string[];
  draftPlayer: (player: DraftPlayer) => void;
  draftComplete: boolean;
  isHost: boolean;
  members: Member[];
  picks: Pick[];
  playerCount: number;
  position: string;
  query: string;
  rosters: Record<string, DraftPlayer[]>;
  setPosition: (value: string) => void;
  setQuery: (value: string) => void;
  timer: number;
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

  const canPick =
    !props.draftComplete && props.currentUserMember?.id === props.currentMember?.id;

  return (
    <section className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr] xl:items-start">
      <div className="grid content-start gap-4 sm:gap-5">
        {props.draftComplete ? (
          <DraftCompleteBanner members={props.members} rosters={props.rosters} />
        ) : null}

        <Panel title="On The Clock">
          <div className="bg-[#103d35] p-4 text-white sm:p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-[#f4c84b]">
              {props.draftComplete ? "Draft status" : "Current pick"}
            </p>
            <h2 className="mt-2 text-2xl font-semibold sm:text-3xl">
              {props.currentMember?.name ?? "Draft complete"}
            </h2>
            <p className="mt-2 text-sm text-white/70">
              {props.draftComplete
                ? "All rosters are complete."
                : `Pick ${props.picks.length + 1} of ${props.totalPicks}`}
            </p>
            {!props.draftComplete ? (
              <div
                className={`mt-4 inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold ${
                  props.timer <= 10 ? "bg-[#f4c84b] text-black" : "bg-white/10"
                }`}
              >
                <span>{formatTimer(props.timer)}</span>
                <span className="text-xs uppercase tracking-[0.14em]">
                  {props.timer <= 10 ? "Pick soon" : "On clock"}
                </span>
              </div>
            ) : null}
          </div>

          <div className="mt-4 grid gap-2">
            {props.draftOrder.map((memberId, index) => {
              const member = props.members.find((item) => item.id === memberId);
              const isCurrentTurn =
                !props.draftComplete && props.currentMemberId === memberId;
              return (
                <div
                  className={`grid grid-cols-[auto_1fr_auto] items-center gap-3 border px-3 py-2 text-sm ${
                    isCurrentTurn
                      ? "border-[#f4c84b] bg-[#fff8dc]"
                      : "border-black/10 bg-white"
                  }`}
                  key={memberId}
                >
                  <span
                    className={`grid size-7 place-items-center text-xs font-semibold ${
                      isCurrentTurn ? "bg-[#f4c84b] text-black" : "bg-[#ede7d8]"
                    }`}
                  >
                    {index + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">
                      {member?.name}
                    </span>
                    {isCurrentTurn ? (
                      <span className="text-xs uppercase tracking-[0.14em] text-[#846400]">
                        On clock
                      </span>
                    ) : null}
                  </span>
                  <span className="text-xs font-semibold text-black/50">
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
              <RosterCard
                isCurrentTurn={!props.draftComplete && props.currentMemberId === member.id}
                key={member.id}
                member={member}
                roster={props.rosters[member.id] ?? []}
              />
            ))}
          </div>
        </Panel>
      </div>

      <Panel title="Player Pool">
        {!canPick && !props.draftComplete ? (
          <p className="mb-4 text-sm text-black/55">
            Waiting for {props.currentMember?.name} to pick.
          </p>
        ) : null}
        {props.draftComplete ? (
          <p className="mb-4 text-sm text-black/55">
            Draft complete. Player selection is closed.
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

function DraftCompleteBanner(props: {
  members: Member[];
  rosters: Record<string, DraftPlayer[]>;
}) {
  return (
    <div className="border border-[#103d35]/20 bg-[#103d35] p-4 text-white shadow-sm sm:p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#f4c84b]">
        Draft complete
      </p>
      <h2 className="mt-2 text-2xl font-semibold leading-tight">
        Rosters are locked
      </h2>
      <p className="mt-2 text-sm text-white/72">
        {props.members.length} squads are ready for the group stage.
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {props.members.map((member) => (
          <div
            className="grid grid-cols-[1fr_auto] items-center gap-3 border border-white/15 px-3 py-2"
            key={member.id}
          >
            <span className="truncate text-sm font-semibold">{member.name}</span>
            <span className="text-xs uppercase tracking-[0.14em] text-white/58">
              {(props.rosters[member.id] ?? []).length}/6
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RosterCard(props: {
  isCurrentTurn: boolean;
  member: Member;
  roster: DraftPlayer[];
}) {
  const slots = Array.from({ length: 6 }, (_, index) => props.roster[index]);

  return (
    <div
      className={`border p-3 ${
        props.isCurrentTurn ? "border-[#f4c84b] bg-[#fff8dc]" : "border-black/10"
      }`}
    >
      <div className="flex items-center justify-between gap-3 text-sm font-semibold">
        <span className="min-w-0 truncate">{props.member.name}</span>
        <span className="text-xs uppercase tracking-[0.14em] text-black/45">
          {props.isCurrentTurn ? "On clock" : `${props.roster.length}/6`}
        </span>
      </div>
      <div className="mt-3 grid gap-2">
        {slots.map((player, index) => (
          <RosterSlot index={index} key={`${props.member.id}-${index}`} player={player} />
        ))}
      </div>
    </div>
  );
}

function RosterSlot(props: { index: number; player?: DraftPlayer }) {
  if (!props.player) {
    return (
      <div className="grid min-h-10 grid-cols-[auto_1fr_auto] items-center gap-2 border border-dashed border-black/15 bg-white/55 px-2 py-2 text-xs text-black/38">
        <span className="grid size-6 place-items-center bg-[#ede7d8] font-semibold">
          {props.index + 1}
        </span>
        <span>Empty slot</span>
        <span>--</span>
      </div>
    );
  }

  return (
    <div className="grid min-h-10 grid-cols-[auto_1fr_auto] items-center gap-2 border border-black/10 bg-white px-2 py-2 text-xs">
      <span className="grid size-6 place-items-center bg-[#103d35] font-semibold text-white">
        {props.index + 1}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-semibold">{props.player.name}</span>
        <span className="text-black/45">{props.player.team}</span>
      </span>
      <span className="bg-[#ede7d8] px-2 py-1 font-semibold">
        {props.player.position}
      </span>
    </div>
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
          <CompactRulesList
            rules={scoringRules.map((rule) => ({
              label: rule.event,
              value: rule.points,
            }))}
          />
        </Panel>
      </div>
    </section>
  );
}

function CompactRulesList(props: { rules: Array<{ label: string; value: string }> }) {
  return (
    <div className="overflow-hidden border border-black/10">
      {props.rules.map((rule) => (
        <div
          className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-black/10 px-3 py-2 text-sm last:border-b-0"
          key={rule.label}
        >
          <span className="min-w-0 text-black/68">{rule.label}</span>
          <span className="rounded bg-[#f3f0e8] px-2 py-1 text-xs font-semibold text-black">
            {rule.value}
          </span>
        </div>
      ))}
    </div>
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

function selectAutoPick(
  playerPool: DraftPlayer[],
  draftedIds: Set<string>,
  currentRoster: DraftPlayer[],
) {
  const needsGoalkeeper =
    currentRoster.length === 5 &&
    !currentRoster.some((player) => player.position === "GK");
  const positionRank: Record<DraftPlayer["position"], number> = {
    GK: needsGoalkeeper ? 0 : 3,
    FWD: 1,
    MID: 2,
    DEF: 4,
  };

  return playerPool
    .filter((player) => !draftedIds.has(player.id))
    .filter((player) => validateDraftSelection(currentRoster, player).valid)
    .sort((a, b) => {
      const positionDiff = positionRank[a.position] - positionRank[b.position];

      if (positionDiff !== 0) {
        return positionDiff;
      }

      return `${a.team} ${a.name}`.localeCompare(`${b.team} ${b.name}`);
    })[0];
}

function unlockAppSound(unlockedRef: React.MutableRefObject<boolean>) {
  if (unlockedRef.current || typeof window === "undefined") {
    return;
  }

  const AudioContextClass = getAudioContextClass();

  if (!AudioContextClass) {
    return;
  }

  const audioContext = new AudioContextClass();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();

  gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.01);
  unlockedRef.current = true;

  window.setTimeout(() => {
    void audioContext.close();
  }, 40);
}

function playAppSound(
  sound: "draft-lock" | "draft-complete" | "pick-made" | "timer-warning",
  enabled: boolean,
  unlockedRef: React.MutableRefObject<boolean>,
) {
  if (!enabled || typeof window === "undefined") {
    return;
  }

  const AudioContextClass = getAudioContextClass();

  if (!AudioContextClass) {
    return;
  }

  const audioContext = new AudioContextClass();
  const notes = getSoundNotes(sound);

  notes.forEach((note) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const startsAt = audioContext.currentTime + note.start;
    const endsAt = startsAt + note.duration;

    oscillator.type = sound === "timer-warning" ? "square" : sound === "pick-made" ? "sine" : "triangle";
    oscillator.frequency.setValueAtTime(note.frequency, startsAt);
    gain.gain.setValueAtTime(0.0001, startsAt);
    gain.gain.exponentialRampToValueAtTime(0.11, startsAt + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, endsAt);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(startsAt);
    oscillator.stop(endsAt);
  });

  unlockedRef.current = true;

  window.setTimeout(() => {
    void audioContext.close();
  }, sound === "draft-complete" ? 1150 : 650);
}

function getSoundNotes(
  sound: "draft-lock" | "draft-complete" | "pick-made" | "timer-warning",
) {
  if (sound === "draft-lock") {
    return [
      { frequency: 392, start: 0, duration: 0.11 },
      { frequency: 523.25, start: 0.1, duration: 0.13 },
      { frequency: 659.25, start: 0.22, duration: 0.18 },
    ];
  }

  if (sound === "draft-complete") {
    return [
      { frequency: 523.25, start: 0, duration: 0.1 },
      { frequency: 659.25, start: 0.09, duration: 0.1 },
      { frequency: 783.99, start: 0.18, duration: 0.12 },
      { frequency: 1046.5, start: 0.32, duration: 0.2 },
      { frequency: 1318.51, start: 0.5, duration: 0.25 },
    ];
  }

  if (sound === "timer-warning") {
    return [
      { frequency: 440, start: 0, duration: 0.06 },
      { frequency: 440, start: 0.13, duration: 0.06 },
      { frequency: 587.33, start: 0.26, duration: 0.08 },
    ];
  }

  return [
    { frequency: 659.25, start: 0, duration: 0.07 },
    { frequency: 880, start: 0.08, duration: 0.09 },
  ];
}

function getAudioContextClass() {
  const audioWindow = window as AudioWindow;

  return audioWindow.AudioContext ?? audioWindow.webkitAudioContext;
}

function formatTimer(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatMatchDate(date: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
    }).format(new Date(`${date}T00:00:00`));
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
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

function readSavedTab(): Tab {
  if (typeof window === "undefined") {
    return "league";
  }

  const saved = window.localStorage.getItem(activeTabKey);

  if (saved === "league" || saved === "draft" || saved === "scores") {
    return saved;
  }

  return "league";
}

function readSavedSoundEnabled() {
  if (typeof window === "undefined") {
    return true;
  }

  return window.localStorage.getItem(soundEnabledKey) !== "false";
}
