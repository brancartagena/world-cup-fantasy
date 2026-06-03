export type DraftPlayer = {
  id: string;
  name: string;
  team: string;
  position: "GK" | "DEF" | "MID" | "FWD";
};

export type DraftValidationResult = {
  valid: boolean;
  reasons: string[];
};

export function validateDraftSelection(
  currentRoster: DraftPlayer[],
  candidate: DraftPlayer,
): DraftValidationResult {
  const reasons: string[] = [];
  const pickNumber = currentRoster.length + 1;
  const teamCount = currentRoster.filter(
    (player) => player.team === candidate.team,
  ).length;
  const rosterWithCandidate = [...currentRoster, candidate];
  const hasGoalkeeper = rosterWithCandidate.some(
    (player) => player.position === "GK",
  );
  const remainingPicks = 6 - rosterWithCandidate.length;

  if (currentRoster.length >= 6) {
    reasons.push("Roster already has 6 players.");
  }

  if (teamCount >= 2) {
    reasons.push("A roster can have at most 2 players from one national team.");
  }

  if (teamCount === 1 && pickNumber !== 6) {
    reasons.push("The second player from the same nation can only be pick 6.");
  }

  if (!hasGoalkeeper && remainingPicks === 0) {
    reasons.push("A completed roster must include at least 1 goalkeeper.");
  }

  return {
    valid: reasons.length === 0,
    reasons,
  };
}

export function getDraftOrder(memberIds: string[], seed: string) {
  return memberIds
    .map((memberId) => ({
      memberId,
      sortKey: hashDraftSeed(`${seed}:${memberId}`),
    }))
    .sort((a, b) => a.sortKey - b.sortKey)
    .map((entry) => entry.memberId);
}

function hashDraftSeed(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash);
}
