import { Task, ParticipantAllocation } from '../types';
export { Task, ParticipantAllocation };

/**
 * Allocates tasks to participants as fairly and evenly as possible.
 * Strives to make the sum of weights (difficulty/load) assigned to each participant
 * as close as possible to all others.
 * 
 * Uses LPT (Longest Processing Time) Greedy heuristic followed by Local Search (Hill Climbing)
 * to refine the balance.
 */
export function allocateTasksFairly(
  participants: { id: string; name: string }[],
  tasks: Task[],
  history?: Record<string, string[]>
): ParticipantAllocation[] {
  if (participants.length === 0) return [];

  // Initialize allocation structure
  const allocations: ParticipantAllocation[] = participants.map(p => ({
    participantId: p.id,
    name: p.name,
    tasks: [],
    totalWeight: 0,
  }));

  if (tasks.length === 0) return allocations;

  // 1. Sort tasks in descending order of weight (LPT)
  // We add a tiny bit of randomness to equal-weight tasks to avoid bias
  const sortedTasks = [...tasks].sort((a, b) => {
    if (b.weight !== a.weight) {
      return b.weight - a.weight;
    }
    return Math.random() - 0.5;
  });

  // 2. Greedy initial assignment
  for (const task of sortedTasks) {
    // Find the participant with the minimum total weight
    // If weights are equal, choose randomly to make it fair/dynamic
    let minWeight = Infinity;
    let minCandidates: ParticipantAllocation[] = [];

    for (const alloc of allocations) {
      const hasHadTask = history && history[alloc.participantId] && history[alloc.participantId].includes(task.id);
      const effectiveWeight = alloc.totalWeight + (hasHadTask ? 1000 : 0);
      if (effectiveWeight < minWeight) {
        minWeight = effectiveWeight;
        minCandidates = [alloc];
      } else if (effectiveWeight === minWeight) {
        minCandidates.push(alloc);
      }
    }

    const chosen = minCandidates[Math.floor(Math.random() * minCandidates.length)];
    chosen.tasks.push(task);
    chosen.totalWeight += task.weight;
  }

  // 3. Local Search Refinement (Hill Climbing)
  // We try to minimize variance and maximum difference of loads.
  const getScore = (allocs: ParticipantAllocation[]) => {
    const weights = allocs.map(a => a.totalWeight);
    const max = Math.max(...weights);
    const min = Math.min(...weights);
    const mean = weights.reduce((sum, w) => sum + w, 0) / weights.length;
    const variance = weights.reduce((sum, w) => sum + Math.pow(w - mean, 2), 0) / weights.length;
    
    // Calculate history penalty
    let historyPenalty = 0;
    if (history) {
      for (const alloc of allocs) {
        const pHistory = history[alloc.participantId] || [];
        for (const t of alloc.tasks) {
          if (pHistory.includes(t.id)) {
            historyPenalty += 100; // Large penalty for matching history
          }
        }
      }
    }

    // Minimize maximum gap, secondary focus on variance, and history penalty
    return (max - min) + variance * 0.1 + historyPenalty;
  };

  let bestScore = getScore(allocations);

  const cloneAllocations = (allocs: ParticipantAllocation[]): ParticipantAllocation[] => {
    return allocs.map(a => ({
      ...a,
      tasks: [...a.tasks],
    }));
  };

  let currentAllocs = cloneAllocations(allocations);

  // Up to 1000 iterations to find local optimum
  for (let iter = 0; iter < 1000; iter++) {
    let improved = false;

    // A. Try moving a task from a heavily-loaded participant to a lighter-loaded participant
    for (let i = 0; i < currentAllocs.length; i++) {
      for (let j = 0; j < currentAllocs.length; j++) {
        if (i === j) continue;
        const source = currentAllocs[i];
        const target = currentAllocs[j];

        if (source.tasks.length === 0) continue;

        for (let tIdx = 0; tIdx < source.tasks.length; tIdx++) {
          const task = source.tasks[tIdx];

          const newSourceWeight = source.totalWeight - task.weight;
          const newTargetWeight = target.totalWeight + task.weight;

          const tempAllocs = cloneAllocations(currentAllocs);
          tempAllocs[i].tasks.splice(tIdx, 1);
          tempAllocs[i].totalWeight = newSourceWeight;
          tempAllocs[j].tasks.push(task);
          tempAllocs[j].totalWeight = newTargetWeight;

          const newScore = getScore(tempAllocs);
          if (newScore < bestScore - 1e-6) {
            bestScore = newScore;
            currentAllocs = tempAllocs;
            improved = true;
            break;
          }
        }
        if (improved) break;
      }
      if (improved) break;
    }

    // B. Try swapping one task from participant A with one task from participant B
    if (!improved) {
      for (let i = 0; i < currentAllocs.length; i++) {
        for (let j = i + 1; j < currentAllocs.length; j++) {
          const allocA = currentAllocs[i];
          const allocB = currentAllocs[j];

          if (allocA.tasks.length === 0 || allocB.tasks.length === 0) continue;

          for (let aIdx = 0; aIdx < allocA.tasks.length; aIdx++) {
            for (let bIdx = 0; bIdx < allocB.tasks.length; bIdx++) {
              const taskA = allocA.tasks[aIdx];
              const taskB = allocB.tasks[bIdx];

              if (taskA.weight === taskB.weight) continue;

              const newWeightA = allocA.totalWeight - taskA.weight + taskB.weight;
              const newWeightB = allocB.totalWeight - taskB.weight + taskA.weight;

              const tempAllocs = cloneAllocations(currentAllocs);
              tempAllocs[i].tasks[aIdx] = taskB;
              tempAllocs[i].totalWeight = newWeightA;
              tempAllocs[j].tasks[bIdx] = taskA;
              tempAllocs[j].totalWeight = newWeightB;

              const newScore = getScore(tempAllocs);
              if (newScore < bestScore - 1e-6) {
                bestScore = newScore;
                currentAllocs = tempAllocs;
                improved = true;
                break;
              }
            }
            if (improved) break;
          }
          if (improved) break;
        }
        if (improved) break;
      }
    }

    if (!improved) {
      break;
    }
  }

  // Sort participant allocations by participant name or total weight for nicer output
  return currentAllocs;
}
